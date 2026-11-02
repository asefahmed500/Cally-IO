import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export type RetentionSettings = {
  callRetentionDays: number;
  recordingRetentionDays: number;
  transcriptRetentionDays: number;
  auditLogRetentionDays: number;
  purgeCompletedCampaigns: boolean;
  allowRecordingDownload: boolean;
};

export const DEFAULT_RETENTION: RetentionSettings = {
  callRetentionDays: 365,
  recordingRetentionDays: 180,
  transcriptRetentionDays: 365,
  auditLogRetentionDays: 730,
  purgeCompletedCampaigns: true,
  allowRecordingDownload: true,
};

export async function getRetentionPolicy(workspaceId: string): Promise<RetentionSettings> {
  const policy = await prisma.retentionPolicy.findUnique({ where: { workspaceId } });
  if (!policy) return DEFAULT_RETENTION;
  return {
    callRetentionDays: policy.callRetentionDays,
    recordingRetentionDays: policy.recordingRetentionDays,
    transcriptRetentionDays: policy.transcriptRetentionDays,
    auditLogRetentionDays: policy.auditLogRetentionDays,
    purgeCompletedCampaigns: policy.purgeCompletedCampaigns,
    allowRecordingDownload: policy.allowRecordingDownload,
  };
}

export async function updateRetentionPolicy(
  workspaceId: string,
  userId: string,
  input: RetentionSettings
): Promise<{ error?: string }> {
  try {
    await prisma.retentionPolicy.upsert({
      where: { workspaceId },
      create: { workspaceId, ...input },
      update: input,
    });
    await logAudit({
      workspaceId,
      userId,
      action: 'retention.updated',
      entityType: 'RetentionPolicy',
      metadata: input as unknown as Record<string, unknown>,
    });
    return {};
  } catch (e: any) {
    return { error: 'Retention operation failed. Please try again.' };
  }
}

export type RetentionPreview = {
  expiredCalls: number;
  expiredRecordings: number;
  expiredTranscripts: number;
  expiredAuditLogs: number;
  completedCampaigns: number;
};

/** Counts exactly what a purge would remove — no deletions happen here. */
export async function previewRetentionPurge(
  workspaceId: string,
  policy: RetentionSettings
): Promise<RetentionPreview> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  const [expiredCalls, expiredRecordings, expiredTranscripts, expiredAuditLogs, completedCampaigns] =
    await Promise.all([
      prisma.call.count({ where: { workspaceId, createdAt: { lt: daysAgo(policy.callRetentionDays) } } }),
      prisma.callRecording.count({
        where: {
          call: { workspaceId },
          createdAt: { lt: daysAgo(policy.recordingRetentionDays) },
        },
      }),
      prisma.conversationSummary.count({
        where: { call: { workspaceId }, createdAt: { lt: daysAgo(policy.transcriptRetentionDays) } },
      }),
      prisma.auditLog.count({
        where: { workspaceId, createdAt: { lt: daysAgo(policy.auditLogRetentionDays) } },
      }),
      prisma.campaign.count({ where: { workspaceId, status: 'COMPLETED', deletedAt: null } }),
    ]);

  return { expiredCalls, expiredRecordings, expiredTranscripts, expiredAuditLogs, completedCampaigns };
}

/** Executes the retention purge. Irreversible — always preview first. */
export async function runRetentionPurge(
  workspaceId: string,
  userId: string,
  policy: RetentionSettings
): Promise<RetentionPreview & { error?: string }> {
  try {
    const preview = await previewRetentionPurge(workspaceId, policy);
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

    const [calls, recordings, transcripts, auditLogs, campaigns] = await prisma.$transaction([
      prisma.call.deleteMany({
        where: { workspaceId, createdAt: { lt: daysAgo(policy.callRetentionDays) } },
      }),
      prisma.callRecording.deleteMany({
        where: {
          call: { workspaceId },
          createdAt: { lt: daysAgo(policy.recordingRetentionDays) },
        },
      }),
      prisma.conversationSummary.deleteMany({
        where: { call: { workspaceId }, createdAt: { lt: daysAgo(policy.transcriptRetentionDays) } },
      }),
      prisma.auditLog.deleteMany({
        where: { workspaceId, createdAt: { lt: daysAgo(policy.auditLogRetentionDays) } },
      }),
      policy.purgeCompletedCampaigns
        ? prisma.campaign.deleteMany({ where: { workspaceId, status: 'COMPLETED' } })
        : prisma.campaign.updateMany({
            where: { workspaceId, status: 'COMPLETED' },
            data: { deletedAt: now },
          }),
    ]);

    await logAudit({
      workspaceId,
      userId,
      action: 'retention.purge_executed',
      entityType: 'RetentionPolicy',
      metadata: {
        calls: calls.count,
        recordingsCleared: recordings.count,
        transcripts: transcripts.count,
        auditLogs: auditLogs.count,
        campaigns: campaigns.count,
      },
    });

    return { ...preview, calls: calls.count } as RetentionPreview;
  } catch (e: any) {
    return { ...(await previewRetentionPurge(workspaceId, policy)), error: 'Retention preview failed. Please try again.' };
  }
}