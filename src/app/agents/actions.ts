'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability, TenantError } from '@/lib/tenant';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AgentConfigSchema, type AgentConfig } from './agent-config';
import type { AgentStatus } from '@prisma/client';

export type AgentDto = {
  $id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  language: string;
  versionCount: number;
  callCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getAgents(): Promise<AgentDto[]> {
  const ctx = await requireWorkspace();
    const agents = await prisma.aIAgent.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      take: 200,
      include: {
        _count: { select: { versions: true, calls: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return agents.map((agent) => ({
    $id: agent.id,
    name: agent.name,
    description: agent.description ?? undefined,
    status: agent.status,
    language: agent.language,
    versionCount: agent._count.versions,
    callCount: agent._count.calls,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  }));
}

export async function getAgent(id: string) {
  const ctx = await requireWorkspace();
  const agent = await prisma.aIAgent.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      versions: { orderBy: { version: 'desc' } },
      knowledgeSources: {
        where: { deletedAt: null },
        select: { id: true, name: true, type: true, status: true },
      },
    },
  });
  if (!agent) return null;

  const currentVersion = agent.versions[0];
  const config = currentVersion
    ? AgentConfigSchema.safeParse(currentVersion.config)
    : null;

  return {
    $id: agent.id,
    name: agent.name,
    description: agent.description ?? '',
    purpose: agent.purpose ?? '',
    department: agent.department ?? '',
    language: agent.language,
    status: agent.status,
    config: config?.success ? config.data : null,
    versionCount: agent.versions.length,
    knowledgeSources: agent.knowledgeSources,
    updatedAt: agent.updatedAt.toISOString(),
  };
}

/** Lists READY knowledge sources available for binding in the active workspace. */
export async function listKnowledgeSourcesForAgent(): Promise<
  { id: string; name: string; type: string; status: string }[]
> {
  const ctx = await requireWorkspace();
  const sources = await prisma.knowledgeSource.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return sources;
}

const CreateAgentSchema = z.object({
  config: AgentConfigSchema,
});

export async function createAgent(prevState: any, formDataOrConfig: any) {
  const ctx = await requireCapability('agents.manage');

  // The wizard submits the config as JSON (client-side state), not FormData.
  let rawConfig: unknown;
  if (formDataOrConfig instanceof FormData) {
    try {
      rawConfig = JSON.parse(formDataOrConfig.get('config') as string);
    } catch {
      return { status: 'error', message: 'Invalid agent configuration.' };
    }
  } else {
    rawConfig = formDataOrConfig;
  }

  const validated = CreateAgentSchema.safeParse({ config: rawConfig });
  if (!validated.success) {
    return {
      status: 'error',
      message: 'Agent configuration is incomplete.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const config = validated.data.config;

  try {
    const agent = await prisma.aIAgent.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: config.identity.name,
        description: config.identity.description || null,
        purpose: config.identity.purpose || null,
        department: config.identity.department || null,
        language: config.identity.language,
        status: 'DRAFT',
        createdById: ctx.user.$id,
        versions: {
          create: {
            version: 1,
            config: config as object,
            createdById: ctx.user.$id,
            changelog: 'Initial configuration',
          },
        },
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    // Bind selected knowledge sources to this agent.
    if (config.knowledge.sourceIds.length > 0) {
      await prisma.knowledgeSource.updateMany({
        where: {
          id: { in: config.knowledge.sourceIds },
          workspaceId: ctx.workspaceId,
        },
        data: { agentId: agent.id },
      });
    }

    await prisma.aIAgent.update({
      where: { id: agent.id },
      data: { currentVersionId: agent.versions[0].id },
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'agent.created',
      entityType: 'AIAgent',
      entityId: agent.id,
      metadata: { name: agent.name },
    });

    revalidatePath('/agents');
    return { status: 'success', message: `Agent "${agent.name}" created as draft.`, agentId: agent.id };
  } catch (e: any) {
    console.error('Failed to create agent:', e);
    return { status: 'error', message: 'Could not create the agent. Please try again.' };
  }
}

export async function updateAgentConfig(agentId: string, rawConfig: unknown, changelog?: string) {
  const ctx = await requireCapability('agents.manage');

  const validated = AgentConfigSchema.safeParse(rawConfig);
  if (!validated.success) {
    return { status: 'error', message: 'Agent configuration is incomplete.' };
  }
  const config = validated.data;

  try {
    const agent = await prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId: ctx.workspaceId, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!agent) return { status: 'error', message: 'Agent not found.' };

    const nextVersion = (agent.versions[0]?.version ?? 0) + 1;

    const [, updated] = await prisma.$transaction([
      prisma.aIAgentVersion.create({
        data: {
          agentId: agent.id,
          version: nextVersion,
          config: config as object,
          createdById: ctx.user.$id,
          changelog: changelog || `Updated to v${nextVersion}`,
        },
      }),
      prisma.aIAgent.update({
        where: { id: agent.id },
        data: {
          name: config.identity.name,
          description: config.identity.description || null,
          purpose: config.identity.purpose || null,
          department: config.identity.department || null,
          language: config.identity.language,
          status: agent.status === 'ACTIVE' ? 'ACTIVE' : agent.status,
        },
      }),
    ]);

    // Re-sync knowledge bindings.
    await prisma.knowledgeSource.updateMany({
      where: { agentId: agent.id },
      data: { agentId: null },
    });
    if (config.knowledge.sourceIds.length > 0) {
      await prisma.knowledgeSource.updateMany({
        where: { id: { in: config.knowledge.sourceIds }, workspaceId: ctx.workspaceId },
        data: { agentId: agent.id },
      });
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'agent.updated',
      entityType: 'AIAgent',
      entityId: agent.id,
      metadata: { version: nextVersion },
    });

    revalidatePath('/agents');
    revalidatePath(`/agents/${agentId}`);
    return { status: 'success', message: `Agent saved as v${nextVersion}.` };
  } catch (e: any) {
    console.error('Failed to update agent:', e);
    return { status: 'error', message: 'Could not update the agent. Please try again.' };
  }
}

export async function setAgentStatus(agentId: string, status: AgentStatus) {
  const ctx = await requireCapability('ai.manage');
  const allowed: AgentStatus[] = ['DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
  if (!allowed.includes(status)) {
    return { status: 'error', message: 'Invalid status.' };
  }

  try {
    // Activating requires at least one knowledge source or FAQ knowledge.
    if (status === 'ACTIVE') {
      const agent = await prisma.aIAgent.findFirst({
        where: { id: agentId, workspaceId: ctx.workspaceId },
        include: {
          knowledgeSources: { where: { status: 'READY' }, select: { id: true } },
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });
      if (!agent) return { status: 'error', message: 'Agent not found.' };
      const parsed = agent.versions[0]
        ? AgentConfigSchema.safeParse(agent.versions[0].config)
        : null;
      const useFaqs = parsed?.success ? parsed.data.knowledge.useWorkspaceFaqs : false;
      if (agent.knowledgeSources.length === 0 && !useFaqs) {
        return {
          status: 'error',
          message: 'Cannot activate: bind at least one READY knowledge source or enable FAQs first.',
        };
      }
    }

    const result = await prisma.aIAgent.updateMany({
      where: { id: agentId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { status },
    });
    if (result.count === 0) return { status: 'error', message: 'Agent not found.' };

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'agent.status_changed',
      entityType: 'AIAgent',
      entityId: agentId,
      metadata: { status },
    });

    revalidatePath('/agents');
    revalidatePath(`/agents/${agentId}`);
    return { status: 'success', message: `Agent ${status.toLowerCase()}.` };
  } catch (e: any) {
    return { status: 'error', message: 'Could not update the agent. Please try again.' };
  }
}

export async function deleteAgent(agentId: string) {
  const ctx = await requireCapability('agents.manage');
  try {
    // Soft delete so call history stays intact.
    const result = await prisma.aIAgent.updateMany({
      where: { id: agentId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    if (result.count === 0) return { status: 'error', message: 'Agent not found.' };
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'agent.deleted',
      entityType: 'AIAgent',
      entityId: agentId,
    });
    revalidatePath('/agents');
    return { status: 'success', message: 'Agent archived.' };
  } catch (e: any) {
    return { status: 'error', message: 'Could not delete the agent. Please try again.' };
  }
}

/** Generates a short TTS preview of the selected voice reading the greeting. */
export async function previewAgentVoice(
  voiceName: string,
  text: string
): Promise<{ audioDataUri?: string; error?: string }> {
  try {
    const ctx = await requireCapability('agents.manage');
    // AI spend is rate limited per workspace member.
    const limit = await rateLimit(ctx.user.$id, 'tts');
    if (!limit.ok) {
      return { error: 'Too many previews. Please wait a moment and try again.' };
    }
    const { generateSpeech } = await import('@/ai/flows/text-to-speech');
    const result = await generateSpeech(
      `Say in a friendly professional tone: ${text.slice(0, 300)}`
    );
    return { audioDataUri: result.audioDataUri };
  } catch (e: unknown) {
    console.error('Voice preview failed:', e);
    return { error: 'Voice preview failed. Please try again.' };
  }
}

/** Runs a text-simulation turn for the test console. Returns the reply + retrieved sources. */
export async function testAgentText(
  agentId: string,
  userMessage: string
): Promise<{ reply: string; sources: { fileName: string }[]; error?: string }> {
  try {
    const ctx = await requireCapability('agents.manage');

    const agent = await prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId: ctx.workspaceId, deletedAt: null },
      include: {
        knowledgeSources: { where: { status: 'READY' }, select: { id: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!agent || agent.versions.length === 0) {
      return { reply: '', sources: [], error: 'Agent not found or has no configuration.' };
    }
    const parsed = AgentConfigSchema.safeParse(agent.versions[0].config);
    if (!parsed.success) {
      return { reply: '', sources: [], error: 'Agent configuration is invalid.' };
    }
    const config = parsed.data;

    const { getChatModel, isAIConfigured } = await import('@/ai/models');
    if (!isAIConfigured()) {
      return { reply: '', sources: [], error: 'GOOGLE_API_KEY is not configured on the server.' };
    }
    const { searchKnowledge, getFaqContext } = await import('@/ai/retrieval');

    const [docContext, faqContext] = await Promise.all([
      searchKnowledge(userMessage, {
        workspaceId: ctx.workspaceId,
        sourceIds: agent.knowledgeSources.map((s) => s.id),
      }),
      config.knowledge.useWorkspaceFaqs ? getFaqContext(ctx.workspaceId) : Promise.resolve(''),
    ]);

    const systemPrompt = `You are "${config.identity.name}", an AI voice agent. ${config.identity.description}

Personality: ${config.personality.tone}. Style: ${config.personality.style}.
Speaking speed: ${config.personality.speakingSpeed}.
Greeting: "${config.personality.greeting}"
If you cannot answer, do this: ${config.personality.escalationBehavior}

Business instructions: ${config.identity.purpose || 'Be helpful and concise.'}

FREQUENTLY ASKED QUESTIONS:
${faqContext || 'None.'}
---
DOCUMENT CONTEXT:
${docContext.context || 'None.'}

Source files: ${docContext.sources.map((s) => s.fileName).join(', ') || 'N/A'}

Answer the user's message. Cite file names when using document context.`;

    // AI spend is rate limited per workspace member.
    const limit = await rateLimit(ctx.user.$id, 'agentTest');
    if (!limit.ok) {
      return { reply: '', sources: [], error: 'Too many test messages. Please wait a moment.' };
    }

    const { getAISettings } = await import('@/lib/settings');
    const settings = await getAISettings(ctx.workspaceId);

    const model = getChatModel();
    const response = await model.invoke([
      { role: 'system', content: `${systemPrompt}\n\nGlobal style: ${settings.style}` },
      { role: 'user', content: userMessage },
    ]);

    const reply = typeof response.content === 'string' ? response.content : String(response.content);
    return { reply, sources: docContext.sources };
  } catch (e: unknown) {
    console.error('Agent test failed:', e);
    return { reply: '', sources: [], error: 'Test failed. Please try again.' };
  }
}
