import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { WORKSPACE_COOKIE, listUserWorkspaces } from '@/lib/tenant';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Cap concurrent SSE streams per user — each connection polls the DB. */
const MAX_STREAMS_PER_USER = 3;
const activeStreams = new Map<string, number>();

/**
 * Live Operations SSE stream — workspace-scoped snapshots of active calls,
 * the call queue, and agent availability. Data is derived from persisted
 * provider events; the UI never asserts state the provider hasn't confirmed.
 */
export async function GET() {
  const user = await getLoggedInUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const cookieStore = cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const memberships = await listUserWorkspaces(user.$id);
  const membership = memberships.find((m) => m.workspaceId === activeId) ?? memberships[0];
  if (!membership) {
    return new Response('No workspace', { status: 404 });
  }
  if (!can(membership.role, 'calls.view')) {
    return new Response('Forbidden', { status: 403 });
  }

  const openStreams = activeStreams.get(user.$id) ?? 0;
  if (openStreams >= MAX_STREAMS_PER_USER) {
    return new Response('Too many concurrent streams', { status: 429 });
  }
  activeStreams.set(user.$id, openStreams + 1);

  const workspaceId = membership.workspaceId;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let released = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const snapshot = async () => {
        const [activeCalls, queueItems, agents, members] = await Promise.all([
          prisma.call.findMany({
            where: {
              workspaceId,
              status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS', 'ON_HOLD', 'ANSWERED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
            include: {
              contact: { select: { name: true } },
              aiAgent: { select: { name: true } },
              assignedUser: { select: { name: true } },
            },
          }),
          prisma.callQueueItem.findMany({
            where: { workspaceId, state: { in: ['WAITING', 'ROUTING'] } },
            orderBy: [{ priority: 'desc' }, { enqueuedAt: 'asc' }],
            take: 25,
          }),
          prisma.aIAgent.findMany({
            where: { workspaceId, deletedAt: null, status: { in: ['ACTIVE', 'PAUSED', 'ERROR'] } },
            select: { id: true, name: true, status: true },
            take: 200,
          }),
          prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: {
              userId: true,
              availability: true,
              role: true,
              user: { select: { name: true } },
            },
            take: 500,
          }),
        ]);

        send('snapshot', {
          activeCalls: activeCalls.map((call) => ({
            id: call.id,
            contactName: call.contact?.name ?? call.toNumber ?? 'Unknown',
            agent: call.aiAgent?.name ?? call.assignedUser?.name ?? 'Unassigned',
            isAI: !!call.aiAgentId,
            status: call.status,
            startedAt: call.startedAt?.toISOString() ?? call.createdAt.toISOString(),
          })),
          queue: queueItems.length,
          agents,
          members: members.map((m) => ({
            name: m.user.name,
            availability: m.availability,
            role: m.role,
          })),
          generatedAt: new Date().toISOString(),
        });
      };

      await snapshot();
      const interval = setInterval(async () => {
        try {
          await snapshot();
        } catch (error) {
          console.error('Live snapshot failed:', error);
        }
      }, 4000);

      // Close after 10 minutes — the client reconnects automatically.
      const timeout = setTimeout(() => {
        release();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, 10 * 60_000);

      const release = () => {
        if (released) return;
        released = true;
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
        const n = (activeStreams.get(user.$id) ?? 1) - 1;
        if (n <= 0) activeStreams.delete(user.$id);
        else activeStreams.set(user.$id, n);
      };
      cleanup = release;
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
