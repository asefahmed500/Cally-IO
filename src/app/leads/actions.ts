'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability, TenantError } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Lead, LeadStage } from './types';
import type { Lead as PrismaLead, Contact as PrismaContact } from '@prisma/client';

const VALID_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'PROPOSAL', 'WON', 'LOST'];

function toLead(record: PrismaLead & { contact: PrismaContact }): Lead {
  const contact = record.contact;
  return {
    $id: record.id,
    contactId: contact.id,
    userId: contact.ownerId,
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? undefined,
    company: contact.company ?? undefined,
    jobTitle: contact.jobTitle ?? undefined,
    notes: contact.notes ?? undefined,
    status: record.stage,
    score: record.score,
    lastActivity: record.updatedAt.toISOString(),
    agentId: record.agentId,
    followUpDate: record.followUpDate ? record.followUpDate.toISOString() : undefined,
    followUpNotes: record.followUpNotes ?? undefined,
    $createdAt: record.createdAt.toISOString(),
  };
}

export async function getLeads(): Promise<{ leads: Lead[]; error: string | null }> {
  try {
    const ctx = await requireWorkspace();
    const leads = await prisma.lead.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        // Non-managers see their assigned leads plus unclaimed ones.
        ...(canViewAll(ctx.role)
          ? {}
          : { OR: [{ agentId: ctx.user.$id }, { agentId: null }] }),
      },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return { leads: leads.map(toLead), error: null };
  } catch (e) {
    if (e instanceof TenantError && e.message === 'NO_WORKSPACE') {
      return { leads: [], error: null };
    }
    console.error('Failed to fetch leads:', e);
    return { leads: [], error: 'An unexpected error occurred while fetching leads.' };
  }
}

function canViewAll(role: import('@prisma/client').MemberRole): boolean {
  return ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'ANALYST'].includes(role);
}

const LeadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
});

export async function saveLead(prevState: any, formData: FormData) {
  let ctx;
  try {
    ctx = await requireCapability('leads.write');
  } catch {
    return { status: 'error', message: 'Unauthorized. Please log in.' };
  }
  const user = ctx.user;
  const isAdmin = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER'].includes(ctx.role);

  const validatedFields = LeadSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    company: formData.get('company'),
    jobTitle: formData.get('jobTitle'),
    notes: formData.get('notes'),
    followUpDate: formData.get('followUpDate'),
    followUpNotes: formData.get('followUpNotes'),
  });

  if (!validatedFields.success) {
    return {
      status: 'error',
      message: 'Invalid data provided.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { id, followUpDate, ...leadDataFromForm } = validatedFields.data;
  const agentIdFromForm = formData.get('agentId') as string | null;

  const contactPayload = {
    name: leadDataFromForm.name,
    email: leadDataFromForm.email,
    phone: leadDataFromForm.phone || null,
    company: leadDataFromForm.company || null,
    jobTitle: leadDataFromForm.jobTitle || null,
    notes: leadDataFromForm.notes || null,
  };

  const followUp = followUpDate ? new Date(followUpDate) : null;

  try {
    if (id) {
      // Updating an existing lead — tenant-scoped
      const existingLead = await prisma.lead.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
        include: { contact: true },
      });
      if (!existingLead) {
        return { status: 'error', message: 'Lead not found.' };
      }
      if (!isAdmin && existingLead.agentId !== user.$id) {
        return { status: 'error', message: "You don't have permission to edit this lead." };
      }

      const updateData: Record<string, unknown> = {
        followUpDate: followUp,
        followUpNotes: leadDataFromForm.followUpNotes || null,
      };
      // Only admins can change the agent assignment during an edit.
      if (isAdmin) {
        updateData.agentId = agentIdFromForm || null;
      }

      await prisma.$transaction([
        prisma.contact.update({ where: { id: existingLead.contactId }, data: contactPayload }),
        prisma.lead.update({ where: { id }, data: updateData as any }),
      ]);
    } else {
      // Creating a new lead (contact + pipeline entry) in the active workspace
      const agentForNewLead = isAdmin ? agentIdFromForm || null : user.$id;
      const membership = { workspaceId: ctx.workspaceId };

      const contact = await prisma.contact.create({
        data: {
          workspaceId: membership.workspaceId,
          ...contactPayload,
          phone: contactPayload.phone,
          email: contactPayload.email,
          ownerId: user.$id,
        },
      });
      const lead = await prisma.lead.create({
        data: {
          workspaceId: membership.workspaceId,
          contactId: contact.id,
          stage: 'NEW',
          score: Math.floor(Math.random() * 21) + 10,
          agentId: agentForNewLead,
          followUpDate: followUp,
          followUpNotes: leadDataFromForm.followUpNotes || null,
        },
      });

      // Workflow trigger: LEAD_CREATED (best-effort, non-blocking). Kept
      // outside any transaction — it makes AI calls and uses the global
      // client, so it must not hold a DB transaction open.
      try {
        const { triggerWorkflows } = await import('@/lib/workflows/engine');
        await triggerWorkflows({
          workspaceId: membership.workspaceId,
          trigger: 'LEAD_CREATED',
          entityType: 'Lead',
          entityId: lead.id,
          lead: { stage: 'NEW', contactId: contact.id },
          contact: { id: contact.id, tags: [], ownerId: user.$id, name: contact.name },
        });
      } catch (e) {
        console.error('Workflow trigger failed:', e);
      }
    }

    revalidatePath('/leads');
    revalidatePath('/dashboard');
    return { status: 'success', message: `Lead ${id ? 'updated' : 'created'} successfully.` };
  } catch (e: any) {
    console.error('Failed to save lead:', e);
    return { status: 'error', message: 'A database error occurred. Please try again.' };
  }
}

export async function deleteLead(leadId: string) {
  let ctx;
  try {
    ctx = await requireCapability('leads.write');
  } catch {
    return { error: 'Unauthorized. Please log in.' };
  }
  const isAdmin = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER'].includes(ctx.role);

  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: ctx.workspaceId },
    });
    if (!lead) {
      return { error: 'Lead not found.' };
    }
    if (!isAdmin && lead.agentId !== ctx.user.$id) {
      return { error: "You don't have permission to delete this lead." };
    }
    // Contact deletion cascades to the pipeline entry.
    await prisma.contact.delete({ where: { id: lead.contactId } });
    revalidatePath('/leads');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete lead:', e);
    return { error: 'A database error occurred. Please try again.' };
  }
}

export async function updateLeadStatus(leadId: string, stage: string) {
  let ctx;
  try {
    ctx = await requireCapability('leads.write');
  } catch {
    return { error: 'Unauthorized access.' };
  }
  if (!VALID_STAGES.includes(stage as LeadStage)) {
    return { error: 'Invalid pipeline stage.' };
  }
  const isAdmin = ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER'].includes(ctx.role);

  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: ctx.workspaceId },
    });
    if (!lead) {
      return { error: 'Lead not found.' };
    }

    // SECURITY CHECK: Only admin or assigned agent (or anyone if unassigned) can update
    if (!isAdmin && lead.agentId && lead.agentId !== ctx.user.$id) {
      return { error: 'You do not have permission to update this lead.' };
    }

    const wasClaimed = !lead.agentId;

    const updateData: { stage: LeadStage; agentId?: string } = {
      stage: stage as LeadStage,
    };

    // If the lead is unassigned, assign it to the current user ("claim" it).
    if (!lead.agentId) {
      updateData.agentId = ctx.user.$id;
    }

    await prisma.lead.update({ where: { id: leadId }, data: updateData });

    revalidatePath('/leads');
    revalidatePath('/dashboard'); // To update agent stats
    return { success: true, claimed: wasClaimed };
  } catch (e: any) {
    console.error('Failed to update lead status:', e);
    return { error: 'Failed to update lead status in the database.' };
  }
}

export async function initiateCall(leadData: Lead) {
  let ctx;
  try {
    ctx = await requireCapability('calls.initiate');
  } catch {
    return { error: 'Unauthorized access.' };
  }
  const user = ctx.user;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { error: 'Twilio is not configured on the server. Please contact an administrator.' };
  }
  if (!baseUrl) {
    return {
      error:
        "The application's public URL (NEXT_PUBLIC_BASE_URL) is not configured. Please contact an administrator.",
    };
  }
  if (!leadData.phone) {
    return { error: 'This lead does not have a phone number.' };
  }

  // SECURITY: verify the lead belongs to the caller's workspace before dialing.
  const leadRecord = await prisma.lead.findFirst({
    where: { id: leadData.$id, workspaceId: ctx.workspaceId },
  });
  if (!leadRecord) {
    return { error: 'Lead not found in this workspace.' };
  }

  try {
    const { twilioProvider } = await import('@/lib/telephony/twilio');
    if (!twilioProvider.isConfigured()) {
      return { error: 'Twilio is not configured on the server. Please contact an administrator.' };
    }

    const webhookUrl = new URL(`/api/twilio/call?leadId=${leadData.$id}`, baseUrl);
    const statusCallbackUrl = new URL('/api/twilio/status', baseUrl);

    const { providerCallSid } = await twilioProvider.initiateCall({
      to: leadData.phone,
      from: TWILIO_PHONE_NUMBER,
      webhookUrl: webhookUrl.toString(),
      statusCallbackUrl: statusCallbackUrl.toString(),
    });

    // Log the call, mark the pipeline stage, in one transaction.
    await prisma.$transaction([
      prisma.call.create({
        data: {
          workspaceId: ctx.workspaceId,
          direction: 'OUTBOUND',
          status: 'QUEUED',
          providerCallSid,
          toNumber: leadData.phone,
          contactId: leadRecord.contactId,
          assignedUserId: user.$id,
          initiatedById: user.$id,
        },
      }),
      prisma.lead.update({
        where: { id: leadRecord.id },
        data: { stage: 'CONTACTED' },
      }),
      prisma.contact.update({
        where: { id: leadRecord.contactId },
        data: { lastContactedAt: new Date() },
      }),
    ]);

    revalidatePath('/leads');
    revalidatePath('/dashboard');

    return { success: true, callSid: providerCallSid };
  } catch (e: any) {
    console.error('Failed to initiate Twilio call:', e);
    if (e.code === 21211) {
      // Invalid 'To' phone number
      return { error: `Invalid phone number for lead: ${leadData.phone}. Please check the format.` };
    }
    return { error: 'Failed to initiate the call. Please try again.' };
  }
}
