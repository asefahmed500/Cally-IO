import { prisma } from '@/lib/prisma';
import { enqueueJob } from '@/lib/jobs/engine';

/**
 * Workflow execution engine — see ARCHITECTURE.md and PRD §14.
 * Definitions are versioned JSON node lists:
 *   { trigger, conditions[], actions[] }
 * Execution is queue-backed (workflow.execute job), idempotent per
 * (workflow, trigger, entity), and every step is logged on the execution row.
 */

export const TRIGGER_TYPES = [
  'CALL_COMPLETED',
  'CALL_MISSED',
  'LEAD_CREATED',
  'FOLLOW_UP_DUE',
] as const;
export type WorkflowTriggerType = (typeof TRIGGER_TYPES)[number];

export const CONDITION_FIELDS = [
  'call.outcome',
  'call.direction',
  'call.durationGtSec',
  'lead.stage',
  'contact.hasTag',
] as const;
export type WorkflowConditionField = (typeof CONDITION_FIELDS)[number];

export const ACTION_TYPES = [
  'CREATE_TASK',
  'SCHEDULE_CALLBACK',
  'UPDATE_LEAD_STAGE',
  'NOTIFY_TEAM',
  'AI_SUMMARY',
] as const;
export type WorkflowActionType = (typeof ACTION_TYPES)[number];

export type WorkflowDefinition = {
  trigger: { type: WorkflowTriggerType };
  conditions: { field: WorkflowConditionField; value: string | number }[];
  actions: {
    type: WorkflowActionType;
    params: {
      title?: string;
      assignToOwner?: boolean;
      dueInHours?: number;
      stage?: string;
      message?: string;
    };
  }[];
};

export type WorkflowEventContext = {
  workspaceId: string;
  trigger: WorkflowTriggerType;
  entityType: 'Call' | 'Lead' | 'Contact';
  entityId: string;
  call?: {
    outcome?: string | null;
    direction?: string | null;
    durationSec?: number | null;
    contactId?: string | null;
    leadId?: string | null;
  };
  lead?: { stage?: string | null; contactId?: string | null };
  contact?: { id: string; tags: string[]; ownerId?: string | null; name: string };
};

async function evaluateConditions(
  conditions: WorkflowDefinition['conditions'],
  ctx: WorkflowEventContext
): Promise<boolean> {
  for (const condition of conditions) {
    let actual: string | number | undefined;
    switch (condition.field) {
      case 'call.outcome':
        actual = ctx.call?.outcome ?? undefined;
        break;
      case 'call.direction':
        actual = ctx.call?.direction ?? undefined;
        break;
      case 'call.durationGtSec':
        actual = ctx.call?.durationSec ?? 0;
        break;
      case 'lead.stage':
        actual = ctx.lead?.stage ?? undefined;
        break;
      case 'contact.hasTag':
        actual = ctx.contact?.tags.includes(String(condition.value)) ? condition.value : undefined;
        break;
    }

    if (condition.field === 'call.durationGtSec') {
      if (!((actual as number) > Number(condition.value))) return false;
    } else if (String(actual ?? '').toUpperCase() !== String(condition.value).toUpperCase()) {
      return false;
    }
  }
  return true;
}

async function executeActions(
  executionId: string,
  workflowId: string,
  definition: WorkflowDefinition,
  ctx: WorkflowEventContext,
  steps: { step: string; status: string; detail?: string }[]
) {
  const { getChatModel, isAIConfigured } = await import('@/ai/models');

  for (let i = 0; i < definition.actions.length; i++) {
    const action = definition.actions[i];
    const label = `${i + 1}. ${action.type}`;
    try {
      const contactId = ctx.contact?.id ?? ctx.call?.contactId ?? ctx.lead?.contactId ?? null;
      const ownerId = ctx.contact?.ownerId ?? null;

      switch (action.type) {
        case 'CREATE_TASK': {
          if (!contactId) throw new Error('No contact linked to this trigger');
          await prisma.task.create({
            data: {
              workspaceId: ctx.workspaceId,
              type: 'CALL_BACK',
              title: action.params.title ?? `Workflow follow-up: ${ctx.contact?.name ?? ctx.entityType}`,
              assigneeId: action.params.assignToOwner ? ownerId : null,
              contactId,
              dueDate: new Date(Date.now() + (action.params.dueInHours ?? 24) * 3_600_000),
              priority: 'MEDIUM',
              status: 'TODO',
              source: 'WORKFLOW',
              createdById: null,
            },
          });
          steps.push({ step: label, status: 'OK' });
          break;
        }
        case 'SCHEDULE_CALLBACK': {
          if (!contactId) throw new Error('No contact linked to this trigger');
          await prisma.task.create({
            data: {
              workspaceId: ctx.workspaceId,
              type: 'CALL_BACK',
              title: action.params.title ?? `Callback: ${ctx.contact?.name ?? 'contact'}`,
              contactId,
              dueDate: new Date(Date.now() + (action.params.dueInHours ?? 4) * 3_600_000),
              priority: 'HIGH',
              status: 'TODO',
              source: 'WORKFLOW',
            },
          });
          steps.push({ step: label, status: 'OK' });
          break;
        }
        case 'UPDATE_LEAD_STAGE': {
          if (!ctx.lead) throw new Error('No lead linked to this trigger');
          const stage = String(action.params.stage ?? '').toUpperCase();
          const valid = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'PROPOSAL', 'WON', 'LOST'];
          if (!valid.includes(stage)) throw new Error(`Invalid stage "${stage}"`);
          await prisma.lead.update({ where: { id: ctx.entityId }, data: { stage: stage as any } });
          steps.push({ step: label, status: 'OK' });
          break;
        }
        case 'NOTIFY_TEAM': {
          const members = await prisma.workspaceMember.findMany({
            where: {
              workspaceId: ctx.workspaceId,
              role: { in: ['WORKSPACE_OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'] },
            },
            select: { userId: true },
          });
          if (members.length > 0) {
            await prisma.notification.createMany({
              data: members.map((m) => ({
                workspaceId: ctx.workspaceId,
                userId: m.userId,
                kind: 'WORKFLOW',
                title: action.params.title ?? 'Workflow notification',
                body:
                  action.params.message ??
                  `${definition.trigger.type} on ${ctx.contact?.name ?? ctx.entityType}`,
                link: contactId ? `/contacts/${contactId}` : null,
              })),
            });
          }
          steps.push({ step: label, status: 'OK' });
          break;
        }
        case 'AI_SUMMARY': {
          if (!isAIConfigured()) throw new Error('GOOGLE_API_KEY not configured');
          if (!ctx.call) throw new Error('AI summary requires a call trigger');
          const call = await prisma.call.findUnique({
            where: { id: ctx.entityId },
            include: { transcript: true, contact: { select: { name: true } } },
          });
          const source = call?.transcript?.text || call?.notes || call?.disposition;
          if (!source) throw new Error('No transcript or notes to summarize');
          const response = await getChatModel().invoke(
            `Summarize this call in 2 sentences, note the customer intent and any follow-up needed.\n\nCall with ${call?.contact?.name ?? 'contact'}:\n${source.slice(0, 4000)}`
          );
          const content =
            typeof response.content === 'string' ? response.content : String(response.content);
          await prisma.conversationSummary.upsert({
            where: { callId: ctx.entityId },
            update: { summary: content, processingStatus: 'READY', model: 'workflow-ai-summary' },
            create: {
              callId: ctx.entityId,
              summary: content,
              processingStatus: 'READY',
              model: 'workflow-ai-summary',
            },
          });
          steps.push({ step: label, status: 'OK' });
          break;
        }
        default:
          throw new Error(`Unknown action type`);
      }
    } catch (error: any) {
      steps.push({ step: label, status: 'FAILED', detail: String(error?.message ?? error) });
      throw error;
    }
  }
  void workflowId;
}

/**
 * Entry point: evaluate all PUBLISHED workflows for a trigger, enqueue
 * executions. Idempotent per (workflow, trigger, entity).
 */
export async function triggerWorkflows(ctx: WorkflowEventContext) {
  const workflows = await prisma.workflow.findMany({
    where: { workspaceId: ctx.workspaceId, status: 'PUBLISHED', deletedAt: null },
    take: 100,
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });

  let triggered = 0;
  for (const workflow of workflows) {
    const version = workflow.versions[0];
    if (!version) continue;
    let definition: WorkflowDefinition;
    try {
      const parsed = version.definition as WorkflowDefinition;
      if (parsed.trigger?.type !== ctx.trigger) continue;
      definition = parsed;
    } catch {
      continue;
    }

    const conditionsMet = await evaluateConditions(definition.conditions ?? [], ctx);
    if (!conditionsMet) continue;

    const idempotencyKey = `${workflow.id}:${ctx.trigger}:${ctx.entityType}:${ctx.entityId}`;
    const existing = await prisma.workflowExecution.findUnique({
      where: { idempotencyKey },
    });
    if (existing) continue;

    const execution = await prisma.workflowExecution.create({
      data: {
        workspaceId: ctx.workspaceId,
        workflowId: workflow.id,
        versionId: version.id,
        status: 'RUNNING',
        trigger: ctx as unknown as object,
        idempotencyKey,
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: { runCount: { increment: 1 } },
    });

    await enqueueJob(
      'workflow.execute',
      { executionId: execution.id },
      { workspaceId: ctx.workspaceId }
    );
    triggered++;
  }

  return triggered;
}

/** Runs a queued workflow execution (invoked by the job worker). */
export async function runWorkflowExecution(executionId: string) {
  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: { workflow: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
  });
  if (!execution || execution.status !== 'RUNNING') return;

  const version = execution.workflow.versions[0];
  const definition = version?.definition as WorkflowDefinition | undefined;
  const ctx = execution.trigger as unknown as WorkflowEventContext;

  if (!definition) {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'FAILED', error: 'Missing workflow definition', finishedAt: new Date() },
    });
    return;
  }

  const steps: { step: string; status: string; detail?: string }[] = [];
  try {
    await executeActions(executionId, execution.workflowId, definition, ctx, steps);
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'SUCCEEDED', steps: steps as unknown as object[], finishedAt: new Date() },
    });
  } catch (error: any) {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        steps: steps as unknown as object[],
        error: String(error?.message ?? error).slice(0, 500),
        finishedAt: new Date(),
      },
    });
  }
}
