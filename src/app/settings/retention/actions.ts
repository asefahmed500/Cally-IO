'use server'

import { requireCapability, TenantError } from '@/lib/tenant';
import { z } from 'zod';
import {
  DEFAULT_RETENTION,
  getRetentionPolicy,
  previewRetentionPurge,
  runRetentionPurge,
  type RetentionSettings,
} from '@/lib/retention';

const RetentionSchema = z.object({
  callRetentionDays: z.coerce.number().int().min(7).max(3650),
  recordingRetentionDays: z.coerce.number().int().min(7).max(3650),
  transcriptRetentionDays: z.coerce.number().int().min(7).max(3650),
  auditLogRetentionDays: z.coerce.number().int().min(30).max(3650),
  purgeCompletedCampaigns: z.coerce.boolean(),
  allowRecordingDownload: z.coerce.boolean(),
});

export async function loadRetentionState() {
  const ctx = await requireCapability('audit.view').catch((e) => e);
  if (ctx instanceof TenantError) {
    return { error: 'Not authorized.', policy: DEFAULT_RETENTION, preview: null, canManage: false };
  }
  const policy = await getRetentionPolicy(ctx.workspaceId);
  return {
    error: undefined as string | undefined,
    policy,
    preview: await previewRetentionPurge(ctx.workspaceId, policy),
    canManage: true,
  };
}

export async function saveRetention(input: RetentionSettings) {
  const ctx = await requireCapability('audit.view').catch((e) => e);
  if (ctx instanceof TenantError) return { error: 'Not authorized.' };

  const parsed = RetentionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid values: ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const { updateRetentionPolicy } = await import('@/lib/retention');
  const result = await updateRetentionPolicy(ctx.workspaceId, ctx.user.$id, parsed.data);
  if (result.error) return { error: result.error };
  return {
    error: undefined,
    policy: parsed.data,
    preview: await previewRetentionPurge(ctx.workspaceId, parsed.data),
  };
}

export async function purgeNow() {
  const ctx = await requireCapability('audit.view').catch((e) => e);
  if (ctx instanceof TenantError) return { error: 'Not authorized.' };

  const policy = await getRetentionPolicy(ctx.workspaceId);
  const result = await runRetentionPurge(ctx.workspaceId, ctx.user.$id, policy);
  return { error: result.error, preview: await previewRetentionPurge(ctx.workspaceId, policy) };
}