'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability, TenantError } from '@/lib/tenant';
import { logAudit } from '@/lib/audit';
import { enqueueJob } from '@/lib/jobs/engine';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CampaignStatus } from '@prisma/client';

export type CampaignDto = {
  $id: string;
  name: string;
  objective?: string;
  status: CampaignStatus;
  timezone: string;
  callingWindow: string;
  maxAttempts: number;
  concurrency: number;
  aiAgentName?: string;
  totals: { total: number; pending: number; queued: number; calling: number; completed: number; failed: number; skipped: number };
  createdAt: string;
};

export async function listCampaigns(): Promise<CampaignDto[]> {
  const ctx = await requireWorkspace();
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      aiAgent: { select: { name: true } },
      contacts: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return campaigns.map((c) => {
    const totals = { total: c.contacts.length, pending: 0, queued: 0, calling: 0, completed: 0, failed: 0, skipped: 0 };
    for (const entry of c.contacts) {
      switch (entry.status) {
        case 'PENDING': totals.pending++; break;
        case 'QUEUED': totals.queued++; break;
        case 'CALLING': totals.calling++; break;
        case 'COMPLETED': totals.completed++; break;
        case 'FAILED': totals.failed++; break;
        case 'SKIPPED': totals.skipped++; break;
      }
    }
    return {
      $id: c.id,
      name: c.name,
      objective: c.objective ?? undefined,
      status: c.status,
      timezone: c.timezone,
      callingWindow: `${c.callingWindowStart}–${c.callingWindowEnd}`,
      maxAttempts: c.maxAttempts,
      concurrency: c.concurrency,
      aiAgentName: c.aiAgent?.name,
      totals,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getCampaignContacts(campaignId: string, page = 1) {
  const ctx = await requireWorkspace();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: ctx.workspaceId, deletedAt: null },
  });
  if (!campaign) return null;

  const pageSize = 50;
  const [contacts, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where: { campaignId },
      include: { contact: { select: { id: true, name: true, phone: true, company: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaignContact.count({ where: { campaignId } }),
  ]);

  return { contacts, total, page, pageSize };
}

const CreateCampaignSchema = z.object({
  name: z.string().min(2).max(80),
  objective: z.string().max(300).optional(),
  aiAgentId: z.string().optional(),
  contactIds: z.array(z.string()).min(1, 'Select at least one contact.').max(500),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  timezone: z.string().default('UTC'),
  callingDays: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
  callingWindowStart: z.string().default('09:00'),
  callingWindowEnd: z.string().default('17:00'),
  maxAttempts: z.number().min(1).max(10).default(3),
  retryDelayMinutes: z.number().min(5).max(1440).default(60),
  concurrency: z.number().min(1).max(10).default(2),
});

export async function createCampaign(raw: unknown) {
  const ctx = await requireCapability('campaigns.manage');

  const validated = CreateCampaignSchema.safeParse(raw);
  if (!validated.success) {
    return {
      status: 'error' as const,
      message: 'Please check the campaign settings.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const data = validated.data;

  try {
    // All contacts must belong to this workspace.
    const contactCount = await prisma.contact.count({
      where: { id: { in: data.contactIds }, workspaceId: ctx.workspaceId, deletedAt: null, phone: { not: null } },
    });
    if (contactCount !== data.contactIds.length) {
      return { status: 'error' as const, message: 'Some selected contacts are invalid or lack phone numbers.' };
    }

    // AI agent must be workspace-bound and active.
    if (data.aiAgentId) {
      const agent = await prisma.aIAgent.findFirst({
        where: { id: data.aiAgentId, workspaceId: ctx.workspaceId, status: 'ACTIVE', deletedAt: null },
      });
      if (!agent) {
        return { status: 'error' as const, message: 'The selected AI agent must exist and be ACTIVE.' };
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        objective: data.objective || null,
        status: 'DRAFT',
        scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : null,
        scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : null,
        timezone: data.timezone,
        callingDays: data.callingDays,
        callingWindowStart: data.callingWindowStart,
        callingWindowEnd: data.callingWindowEnd,
        maxAttempts: data.maxAttempts,
        retryDelayMinutes: data.retryDelayMinutes,
        concurrency: data.concurrency,
        aiAgentId: data.aiAgentId || null,
        createdById: ctx.user.$id,
        contacts: {
          create: data.contactIds.map((contactId) => ({ contactId, status: 'PENDING' })),
        },
      },
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'campaign.created',
      entityType: 'Campaign',
      entityId: campaign.id,
      metadata: { name: data.name, audience: data.contactIds.length },
    });

    revalidatePath('/campaigns');
    return { status: 'success' as const, message: `Campaign "${data.name}" created.`, campaignId: campaign.id };
  } catch (e: any) {
    console.error('Failed to create campaign:', e);
    return { status: 'error' as const, message: 'Could not create the campaign. Please try again.' };
  }
}

export async function setCampaignStatus(campaignId: string, status: CampaignStatus) {
  const ctx = await requireCapability('campaigns.manage');
  const allowed: CampaignStatus[] = ['RUNNING', 'PAUSED', 'STOPPED'];
  if (!allowed.includes(status)) {
    return { status: 'error' as const, message: 'Invalid status.' };
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!campaign) return { status: 'error' as const, message: 'Campaign not found.' };

    if (status === 'RUNNING') {
      if (campaign.scheduleEnd && campaign.scheduleEnd < new Date()) {
        return { status: 'error' as const, message: 'The schedule has already ended — extend it first.' };
      }
      // Seed the scheduler so the tick loop starts.
      await enqueueJob('campaign.scheduleNext', {}, { runAt: new Date() });
    }

    if (status === 'STOPPED') {
      // Reset in-flight rows and flip the campaign atomically — a partial
      // state (rows reset, campaign still running) would double-dial.
      await prisma.$transaction([
        prisma.campaignContact.updateMany({
          where: { campaignId, status: 'CALLING' },
          data: { status: 'QUEUED' },
        }),
        prisma.campaign.update({ where: { id: campaignId }, data: { status } }),
      ]);
    } else {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'campaign.status_changed',
      entityType: 'Campaign',
      entityId: campaignId,
      metadata: { status },
    });

    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    return { status: 'success' as const, message: `Campaign ${status.toLowerCase()}.` };
  } catch (e: unknown) {
    console.error('Failed to update campaign status:', e);
    return { status: 'error' as const, message: 'Could not update the campaign. Please try again.' };
  }
}

export async function deleteCampaign(campaignId: string) {
  const ctx = await requireCapability('campaigns.manage');
  try {
    const result = await prisma.campaign.updateMany({
      where: { id: campaignId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'STOPPED' },
    });
    if (result.count === 0) return { status: 'error' as const, message: 'Campaign not found.' };
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'campaign.deleted',
      entityType: 'Campaign',
      entityId: campaignId,
    });
    revalidatePath('/campaigns');
    return { status: 'success' as const, message: 'Campaign deleted.' };
  } catch (e: any) {
    return { status: 'error' as const, message: 'Could not delete the campaign. Please try again.' };
  }
}

export async function listActiveAgentsForCampaign() {
  const ctx = await requireWorkspace();
  const agents = await prisma.aIAgent.findMany({
    where: { workspaceId: ctx.workspaceId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return agents;
}

export async function listCampaignAudience(search?: string) {
  const ctx = await requireWorkspace();
  return prisma.contact.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      phone: { not: null },
      consentStatus: { notIn: ['DENIED', 'OPTED_OUT'] },
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    },
    select: { id: true, name: true, phone: true, company: true, consentStatus: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
