'use server';

import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import {
  requireWorkspace,
  switchWorkspace,
  listUserWorkspaces,
  TenantError,
} from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters.').max(60),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  timezone: z.string().min(1, 'Timezone is required.'),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'workspace'
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.workspace.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createWorkspace(prevState: any, formData: FormData) {
  const user = await getLoggedInUser();
  if (!user) {
    return { status: 'error', message: 'Please log in first.' };
  }

  const validated = CreateWorkspaceSchema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry') || undefined,
    companySize: formData.get('companySize') || undefined,
    timezone: formData.get('timezone'),
  });

  if (!validated.success) {
    return {
      status: 'error',
      message: 'Please check the form.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { name, industry, companySize, timezone } = validated.data;

  try {
    const slug = await uniqueSlug(slugify(name));

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        industry: industry ?? null,
        companySize: companySize ?? null,
        timezone,
        ownerId: user.$id,
        members: {
          create: {
            userId: user.$id,
            role: 'WORKSPACE_OWNER',
            isOwner: true,
            availability: 'AVAILABLE',
          },
        },
        settings: { create: {} },
        subscription: { create: { plan: 'FREE', status: 'TRIALING', seats: 3 } },
      },
      select: { id: true, name: true },
    });

    await switchWorkspace(workspace.id);

    revalidatePath('/dashboard');
    revalidatePath('/onboarding');
    return { status: 'success', message: `Workspace "${name}" created.`, workspaceId: workspace.id };
  } catch (e: any) {
    console.error('Failed to create workspace:', e);
    return { status: 'error', message: 'Could not create the workspace. Please try again.' };
  }
}

export async function switchWorkspaceAction(workspaceId: string) {
  try {
    const ok = await switchWorkspace(workspaceId);
    if (!ok) {
      return { status: 'error', message: 'You are not a member of that workspace.' };
    }
    revalidatePath('/', 'layout');
    return { status: 'success' };
  } catch (e: any) {
    if (e instanceof TenantError) {
      return { status: 'error', message: 'Please log in first.' };
    }
    return { status: 'error', message: 'Could not switch workspace.' };
  }
}

export async function getMyWorkspaces() {
  const user = await getLoggedInUser();
  if (!user) return [];
  const memberships = await listUserWorkspaces(user.$id);
  return memberships.map((m) => ({
    id: m.workspaceId,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logoUrl: m.workspace.logoUrl,
    role: m.role,
    isOwner: m.isOwner,
  }));
}

/** Used by the layout to decide whether onboarding is required. */
export async function hasAnyWorkspace(): Promise<boolean> {
  const user = await getLoggedInUser();
  if (!user) return false;
  const count = await prisma.workspaceMember.count({
    where: { userId: user.$id, workspace: { deletedAt: null } },
  });
  return count > 0;
}
