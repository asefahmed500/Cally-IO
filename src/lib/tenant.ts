import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getLoggedInUser, type SessionUser } from '@/lib/auth';
import { can, type Capability } from '@/lib/permissions';
import type { MemberRole } from '@prisma/client';

/**
 * Tenant guard — the single entry point every workspace-scoped server action
 * and route handler must pass through. See ARCHITECTURE.md §2.
 */

export const WORKSPACE_COOKIE = 'cally_ws';

export type WorkspaceContext = {
  user: SessionUser;
  workspaceId: string;
  workspaceName: string;
  role: MemberRole;
  isOwner: boolean;
};

export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Lists workspaces the current user is a member of (id + name). */
export async function listUserWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      workspaceId: true,
      role: true,
      isOwner: true,
      workspace: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
}

/**
 * Resolves the active workspace membership. Throws TenantError when the user
 * is unauthenticated, has no workspaces, or the cookie points at a workspace
 * they do not belong to.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await getLoggedInUser();
  if (!user) throw new TenantError('Unauthorized', 401);

  const cookieStore = cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const memberships = await listUserWorkspaces(user.$id);
  if (memberships.length === 0) {
    throw new TenantError('NO_WORKSPACE', 404);
  }

  const membership = activeId
    ? memberships.find((m) => m.workspaceId === activeId)
    : memberships[0];

  if (!membership) {
    // Cookie pointed at a foreign/removed workspace — fall back to first.
    const first = memberships[0];
    return {
      user,
      workspaceId: first.workspaceId,
      workspaceName: first.workspace.name,
      role: first.role,
      isOwner: first.isOwner,
    };
  }

  return {
    user,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    role: membership.role,
    isOwner: membership.isOwner,
  };
}

/** requireWorkspace + capability check in one call. */
export async function requireCapability(capability: Capability): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (!can(ctx.role, capability)) {
    throw new TenantError(`Forbidden: missing capability "${capability}"`, 403);
  }
  return ctx;
}

/** Sets the active workspace cookie after validating membership. */
export async function switchWorkspace(workspaceId: string): Promise<boolean> {
  const user = await getLoggedInUser();
  if (!user) throw new TenantError('Unauthorized', 401);

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.$id, workspaceId, workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });
  if (!membership) return false;

  cookies().set(WORKSPACE_COOKIE, workspaceId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
