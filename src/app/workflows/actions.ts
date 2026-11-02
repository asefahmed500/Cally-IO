'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { WorkflowStatus } from '@prisma/client';
import type { WorkflowDefinition } from '@/lib/workflows/engine';

const DefinitionSchema = z.object({
  trigger: z.object({
    type: z.enum(['CALL_COMPLETED', 'CALL_MISSED', 'LEAD_CREATED', 'FOLLOW_UP_DUE']),
  }),
  conditions: z
    .array(
      z.object({
        field: z.enum([
          'call.outcome',
          'call.direction',
          'call.durationGtSec',
          'lead.stage',
          'contact.hasTag',
        ]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .default([]),
  actions: z
    .array(
      z.object({
        type: z.enum(['CREATE_TASK', 'SCHEDULE_CALLBACK', 'UPDATE_LEAD_STAGE', 'NOTIFY_TEAM', 'AI_SUMMARY']),
        params: z
          .object({
            title: z.string().max(160).optional(),
            assignToOwner: z.boolean().optional(),
            dueInHours: z.number().min(1).max(720).optional(),
            stage: z.string().max(20).optional(),
            message: z.string().max(400).optional(),
          })
          .default({}),
      })
    )
    .min(1, 'Add at least one action.'),
});

export type WorkflowDto = {
  $id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  runCount: number;
  triggerType?: string;
  actionCount: number;
  versionCount: number;
  updatedAt: string;
};

export async function listWorkflows(): Promise<WorkflowDto[]> {
  const ctx = await requireWorkspace();
  const workflows = await prisma.workflow.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    take: 200,
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });
  return workflows.map((w) => {
    const def = w.versions[0]?.definition as WorkflowDefinition | undefined;
    return {
      $id: w.id,
      name: w.name,
      description: w.description ?? undefined,
      status: w.status,
      runCount: w.runCount,
      triggerType: def?.trigger?.type,
      actionCount: def?.actions?.length ?? 0,
      versionCount: w.versions.length,
      updatedAt: w.updatedAt.toISOString(),
    };
  });
}

export async function getWorkflow(id: string) {
  const ctx = await requireWorkspace();
  const workflow = await prisma.workflow.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      versions: { orderBy: { version: 'desc' } },
      executions: { orderBy: { startedAt: 'desc' }, take: 20 },
    },
  });
  if (!workflow) return null;

  const currentVersion = workflow.versions[0];
  return {
    $id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? '',
    status: workflow.status,
    runCount: workflow.runCount,
    definition: (currentVersion?.definition as WorkflowDefinition | undefined) ?? null,
    versionCount: workflow.versions.length,
    executions: workflow.executions.map((e) => ({
      $id: e.id,
      status: e.status,
      trigger: e.trigger as { trigger?: { type?: string } } | null,
      steps: (e.steps as { step: string; status: string; detail?: string }[] | null) ?? [],
      error: e.error ?? undefined,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString(),
    })),
  };
}

const SaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  definition: DefinitionSchema,
});

export async function saveWorkflow(raw: unknown) {
  const ctx = await requireCapability('workflows.manage');

  const validated = SaveSchema.safeParse(raw);
  if (!validated.success) {
    return {
      status: 'error' as const,
      message: 'Please check the workflow configuration.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const { id, name, description, definition } = validated.data;

  try {
    if (id) {
      const workflow = await prisma.workflow.findFirst({
        where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (!workflow) return { status: 'error' as const, message: 'Workflow not found.' };

      const nextVersion = (workflow.versions[0]?.version ?? 0) + 1;
      await prisma.$transaction([
        prisma.workflowVersion.create({
          data: {
            workflowId: workflow.id,
            version: nextVersion,
            definition: definition as object,
            createdById: ctx.user.$id,
          },
        }),
        prisma.workflow.update({
          where: { id: workflow.id },
          data: { name, description: description || null },
        }),
      ]);

      await logAudit({
        workspaceId: ctx.workspaceId,
        userId: ctx.user.$id,
        action: 'workflow.updated',
        entityType: 'Workflow',
        entityId: workflow.id,
        metadata: { version: nextVersion },
      });
    } else {
      const workflow = await prisma.workflow.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: description || null,
          status: 'DRAFT',
          versions: {
            create: {
              version: 1,
              definition: definition as object,
              createdById: ctx.user.$id,
            },
          },
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      await prisma.workflow
        .update({
          where: { id: workflow.id },
          data: { currentVersionId: workflow.versions[0]?.id ?? null },
        })
        .catch(() => {});
      await logAudit({
        workspaceId: ctx.workspaceId,
        userId: ctx.user.$id,
        action: 'workflow.created',
        entityType: 'Workflow',
        entityId: workflow.id,
        metadata: { name },
      });
      revalidatePath('/workflows');
      return { status: 'success' as const, message: `Workflow "${name}" created as draft.`, workflowId: workflow.id };
    }

    revalidatePath('/workflows');
    revalidatePath(`/workflows/${id}`);
    return { status: 'success' as const, message: 'Workflow saved as a new version.' };
  } catch (e: any) {
    console.error('Failed to save workflow:', e);
    return { status: 'error' as const, message: 'Could not save the workflow. Please try again.' };
  }
}

export async function setWorkflowStatus(workflowId: string, status: WorkflowStatus) {
  const ctx = await requireCapability('workflows.manage');
  const allowed: WorkflowStatus[] = ['PUBLISHED', 'DISABLED', 'DRAFT'];
  if (!allowed.includes(status)) {
    return { status: 'error' as const, message: 'Invalid status.' };
  }
  try {
    const result = await prisma.workflow.updateMany({
      where: { id: workflowId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { status },
    });
    if (result.count === 0) return { status: 'error' as const, message: 'Workflow not found.' };
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'workflow.status_changed',
      entityType: 'Workflow',
      entityId: workflowId,
      metadata: { status },
    });
    revalidatePath('/workflows');
    revalidatePath(`/workflows/${workflowId}`);
    return { status: 'success' as const, message: `Workflow ${status.toLowerCase()}.` };
  } catch (e: any) {
    return { status: 'error' as const, message: 'Could not update the workflow. Please try again.' };
  }
}

export async function deleteWorkflow(workflowId: string) {
  const ctx = await requireCapability('workflows.manage');
  try {
    const result = await prisma.workflow.updateMany({
      where: { id: workflowId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
    if (result.count === 0) return { status: 'error' as const, message: 'Workflow not found.' };
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'workflow.deleted',
      entityType: 'Workflow',
      entityId: workflowId,
    });
    revalidatePath('/workflows');
    return { status: 'success' as const, message: 'Workflow deleted.' };
  } catch (e: any) {
    return { status: 'error' as const, message: 'Could not delete the workflow. Please try again.' };
  }
}
