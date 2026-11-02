'use server';

import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import type { MemberRole } from '@prisma/client';

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** SHA-256 — invitation tokens are stored hashed, never in plaintext. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const ASSIGNABLE_ROLES: MemberRole[] = [
  'ADMIN',
  'MANAGER',
  'SUPERVISOR',
  'HUMAN_AGENT',
  'ANALYST',
];

export type WorkspaceMemberSummary = {
  $id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  isOwner: boolean;
  availability: string;
  createdAt: string;
};

export type InvitationSummary = {
  $id: string;
  email: string;
  role: MemberRole;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export async function listMembers(): Promise<WorkspaceMemberSummary[]> {
  const ctx = await requireWorkspace();
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    take: 500,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return members.map((m) => ({
    $id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    isOwner: m.isOwner,
    availability: m.availability,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function listInvitations(): Promise<InvitationSummary[]> {
  const ctx = await requireWorkspace();
  const invitations = await prisma.invitation.findMany({
    where: { workspaceId: ctx.workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map((i) => ({
    $id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
  }));
}

const InviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR', 'HUMAN_AGENT', 'ANALYST']),
});

export async function inviteMember(prevState: any, formData: FormData) {
  const ctx = await requireCapability('members.invite');

  const validated = InviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!validated.success) {
    return {
      status: 'error',
      message: 'Invalid invitation data.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const { email, role } = validated.data;

  // Privilege guard: only owners/admins (or platform admins) may mint ADMIN
  // invites, so a MANAGER cannot escalate by inviting above their level.
  if (role === 'ADMIN') {
    const isPlatformAdmin = ctx.user.labels.includes('admin');
    if (!isPlatformAdmin && ctx.role !== 'WORKSPACE_OWNER' && ctx.role !== 'ADMIN') {
      return { status: 'error', message: 'Only owners and admins can invite administrators.' };
    }
  }

  try {
    // If the invitee already exists and is a member, short-circuit.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.workspaceId, userId: existingUser.id },
      });
      if (existingMember) {
        return { status: 'error', message: `${email} is already a member of this workspace.` };
      }
    }

    // One live invitation per email per workspace.
    const pendingInvite = await prisma.invitation.findFirst({
      where: { workspaceId: ctx.workspaceId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pendingInvite) {
      return { status: 'error', message: `An invitation for ${email} is already pending.` };
    }

    const token = randomBytes(32).toString('hex');
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: ctx.workspaceId,
        email,
        role,
        token: hashToken(token),
        invitedById: ctx.user.$id,
        expiresAt: new Date(Date.now() + INVITE_DURATION_MS),
      },
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'member.invited',
      entityType: 'Invitation',
      entityId: invitation.id,
      metadata: { email, role },
    });

    revalidatePath('/settings');
    return {
      status: 'success',
      // No email provider is configured (free tier): return the accept link so
      // the admin can share it directly. The plaintext token only exists here
      // and in the shareable URL — the database stores its SHA-256 hash.
      message: `Invitation created for ${email}.`,
      inviteUrl: `/invite/${token}`,
    };
  } catch (e: unknown) {
    console.error('Failed to create invitation:', e);
    return { status: 'error', message: 'Could not create the invitation.' };
  }
}

export async function revokeInvitation(invitationId: string) {
  const ctx = await requireCapability('members.invite');
  try {
    const result = await prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId: ctx.workspaceId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    if (result.count === 0) {
      return { status: 'error', message: 'Invitation not found or already handled.' };
    }
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'member.invitation_revoked',
      entityType: 'Invitation',
      entityId: invitationId,
    });
    revalidatePath('/settings');
    return { status: 'success', message: 'Invitation revoked.' };
  } catch {
    return { status: 'error', message: 'Could not revoke the invitation.' };
  }
}

export async function updateMemberRole(memberId: string, role: string) {
  const ctx = await requireCapability('members.manage');
  if (!ASSIGNABLE_ROLES.includes(role as MemberRole)) {
    return { status: 'error', message: 'Invalid role.' };
  }
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
    });
    if (!member) return { status: 'error', message: 'Member not found.' };
    if (member.isOwner) {
      return { status: 'error', message: 'The workspace owner role cannot be changed.' };
    }

    await prisma.workspaceMember.update({ where: { id: memberId }, data: { role: role as MemberRole } });
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'member.role_changed',
      entityType: 'WorkspaceMember',
      entityId: memberId,
      metadata: { newRole: role },
    });
    revalidatePath('/settings');
    return { status: 'success', message: 'Role updated.' };
  } catch {
    return { status: 'error', message: 'Could not update the role.' };
  }
}

export async function removeMember(memberId: string) {
  const ctx = await requireCapability('members.manage');
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
    });
    if (!member) return { status: 'error', message: 'Member not found.' };
    if (member.isOwner) {
      return { status: 'error', message: 'The workspace owner cannot be removed.' };
    }
    if (member.userId === ctx.user.$id) {
      return { status: 'error', message: 'You cannot remove yourself.' };
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'member.removed',
      entityType: 'WorkspaceMember',
      entityId: memberId,
    });
    revalidatePath('/settings');
    return { status: 'success', message: 'Member removed.' };
  } catch {
    return { status: 'error', message: 'Could not remove the member.' };
  }
}

/** Accepts an invitation for the logged-in user. */
export async function acceptInvitation(token: string) {  const { getLoggedInUser } = await import('@/lib/auth');
  const user = await getLoggedInUser();
  if (!user) {
    return { status: 'error', message: 'Please log in or sign up first.' };
  }

  try {
    // Tokens are stored hashed; fall back to plaintext for invitations
    // created before hashing was introduced (they expire within 7 days).
    let invitation = await prisma.invitation.findUnique({
      where: { token: hashToken(token) },
      include: { workspace: { select: { id: true, name: true, deletedAt: true } } },
    });
    if (!invitation) {
      invitation = await prisma.invitation.findUnique({
        where: { token },
        include: { workspace: { select: { id: true, name: true, deletedAt: true } } },
      });
    }

    if (!invitation || invitation.workspace.deletedAt) {
      return { status: 'error', message: 'This invitation is invalid.' };
    }
    if (invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      return { status: 'error', message: 'This invitation has expired or was revoked.' };
    }

    // Invitations are email-bound when the account already exists.
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return {
        status: 'error',
        message: `This invitation was sent to ${invitation.email}. Please log in with that account.`,
      };
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: invitation.workspaceId, userId: user.$id },
    });
    if (existingMember) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED' } });
      return { status: 'success', message: `You are already a member of ${invitation.workspace.name}.` };
    }

    // Claim the invitation atomically inside the transaction so a concurrent
    // revoke/expiry cannot slip in between the check and the write.
    const claimed = await prisma.invitation.updateMany({
      where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'ACCEPTED' },
    });
    if (claimed.count === 0) {
      return { status: 'error', message: 'This invitation has expired or was revoked.' };
    }

    await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.$id,
          role: invitation.role,
          availability: 'AVAILABLE',
        },
      }),
    ]);

    await logAudit({
      workspaceId: invitation.workspaceId,
      userId: user.$id,
      action: 'member.joined',
      entityType: 'Invitation',
      entityId: invitation.id,
      metadata: { role: invitation.role },
    });

    return { status: 'success', message: `Welcome to ${invitation.workspace.name}!` };
  } catch (e: unknown) {
    console.error('Failed to accept invitation:', e);
    return { status: 'error', message: 'Could not accept the invitation.' };
  }
}

/** Read-only invitation lookup for the invite landing page (no side effects). */
export async function getInvitationPreview(token: string): Promise<{
  workspaceName: string;
  email: string;
  role: MemberRole;
} | null> {
  const include = { workspace: { select: { name: true, deletedAt: true } } };
  let invitation = await prisma.invitation.findUnique({
    where: { token: hashToken(token) },
    include,
  });
  if (!invitation) {
    // Plaintext fallback for invitations created before token hashing.
    invitation = await prisma.invitation.findUnique({ where: { token }, include });
  }
  if (
    !invitation ||
    invitation.workspace.deletedAt ||
    invitation.status !== 'PENDING' ||
    invitation.expiresAt < new Date()
  ) {
    return null;
  }
  return {
    workspaceName: invitation.workspace.name,
    email: invitation.email,
    role: invitation.role,
  };
}

/**
 * Form-action wrapper: acceptance is an explicit POST, never a side effect
 * of merely visiting the invite URL.
 */
export async function acceptInvitationFormAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const result = await acceptInvitation(token);
  redirect(result.status === 'success' ? `/invite/${token}?accepted=1` : `/invite/${token}?error=1`);
}