'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type TeamDto = {
  $id: string;
  name: string;
  description?: string;
  members: { userId: string; name: string; role: string }[];
  createdAt: string;
};

export async function listTeams(): Promise<TeamDto[]> {
  const ctx = await requireWorkspace();
  const teams = await prisma.team.findMany({
    where: { workspaceId: ctx.workspaceId },
    take: 200,
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return teams.map((team) => ({
    $id: team.id,
    name: team.name,
    description: team.description ?? undefined,
    members: team.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: 'member',
    })),
    createdAt: team.createdAt.toISOString(),
  }));
}

const TeamSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Team name must be at least 2 characters.').max(60),
  description: z.string().optional(),
  memberIds: z.string().optional(), // comma-separated user ids
});

export async function saveTeam(prevState: any, formData: FormData) {
  const ctx = await requireCapability('members.manage');

  const validated = TeamSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    memberIds: formData.get('memberIds') || undefined,
  });
  if (!validated.success) {
    return {
      status: 'error',
      message: 'Please check the form.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { id, memberIds, ...data } = validated.data;
  const userIds = memberIds ? memberIds.split(',').map((s) => s.trim()).filter(Boolean) : [];

  try {
    // Validate all members belong to this workspace.
    if (userIds.length > 0) {
      const memberCount = await prisma.workspaceMember.count({
        where: { workspaceId: ctx.workspaceId, userId: { in: userIds } },
      });
      if (memberCount !== userIds.length) {
        return { status: 'error', message: 'One or more selected people are not workspace members.' };
      }
    }

    if (id) {
      const team = await prisma.team.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!team) return { status: 'error', message: 'Team not found.' };

      await prisma.$transaction([
        prisma.team.update({ where: { id }, data }),
        prisma.teamMember.deleteMany({ where: { teamId: id } }),
        ...userIds.map((userId) =>
          prisma.teamMember.create({ data: { teamId: id, userId } })
        ),
      ]);
    } else {
      await prisma.team.create({
        data: {
          workspaceId: ctx.workspaceId,
          ...data,
          members: { create: userIds.map((userId) => ({ userId })) },
        },
      });
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: id ? 'team.updated' : 'team.created',
      entityType: 'Team',
      entityId: id,
      metadata: { name: data.name, memberCount: userIds.length },
    });

    revalidatePath('/teams');
    return { status: 'success', message: `Team ${id ? 'updated' : 'created'}.` };
  } catch (e: any) {
    console.error('Failed to save team:', e);
    return { status: 'error', message: 'A database error occurred. Please try again.' };
  }
}

export async function deleteTeam(teamId: string) {
  const ctx = await requireCapability('members.manage');
  try {
    const result = await prisma.team.deleteMany({
      where: { id: teamId, workspaceId: ctx.workspaceId },
    });
    if (result.count === 0) return { error: 'Team not found.' };
    await logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.$id,
      action: 'team.deleted',
      entityType: 'Team',
      entityId: teamId,
    });
    revalidatePath('/teams');
    return { success: true };
  } catch (e: any) {
    return { error: 'A database error occurred. Please try again.' };
  }
}
