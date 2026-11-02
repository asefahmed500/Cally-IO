'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCapability, TenantError } from '@/lib/tenant';
import { updateWorkspaceSettingsData } from '@/lib/settings';

const AISettingsSchema = z.object({
  personality: z.string().max(2000).default(''),
  style: z.string().max(2000).default(''),
  instructions: z.string().max(5000).default(''),
  businessHoursEnabled: z.boolean().default(false),
  businessHoursStart: z.string().max(10).default('09:00'),
  businessHoursEnd: z.string().max(10).default('17:00'),
  businessHoursTimezone: z.string().max(64).default('UTC'),
  awayMessage: z.string().max(2000).default(''),
  scriptTemplate: z.string().max(10000).default(''),
});

export async function updateAISettings(prevState: unknown, formData: FormData) {
  // Settings belong to the active workspace; the capability map decides who
  // may change them — never a client-supplied workspace or global flag.
  let workspaceId: string;
  try {
    const ctx = await requireCapability('integrations.manage');
    workspaceId = ctx.workspaceId;
  } catch (e) {
    if (e instanceof TenantError) {
      return { error: 'Unauthorized access.' };
    }
    throw e;
  }

  const parsed = AISettingsSchema.safeParse({
    personality: formData.get('ai_personality'),
    style: formData.get('ai_style'),
    instructions: formData.get('ai_instructions'),
    businessHoursEnabled: formData.get('business_hours_enabled') === 'on',
    businessHoursStart: formData.get('business_hours_start'),
    businessHoursEnd: formData.get('business_hours_end'),
    businessHoursTimezone: formData.get('business_hours_timezone'),
    awayMessage: formData.get('away_message'),
    scriptTemplate: formData.get('call_script_template'),
  });
  if (!parsed.success) {
    return { error: 'Invalid settings data. Please check the form and try again.' };
  }

  try {
    await updateWorkspaceSettingsData(workspaceId, parsed.data);
  } catch (e: unknown) {
    console.error('Failed to update AI settings:', e);
    return { error: 'Failed to update settings. Please try again.' };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard'); // To update business hours status
  revalidatePath('/leads'); // To ensure new scripts are used
  return { success: true, message: 'Settings updated successfully!' };
}
