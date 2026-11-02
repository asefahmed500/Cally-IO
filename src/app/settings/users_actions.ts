'use server';

import { prisma } from '@/lib/prisma';
import { getLoggedInUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

const RESET_TOKEN_DURATION_MS = 1000 * 60 * 60; // 1 hour

// Shared user creation logic. Lead/contact creation moves to workspace
// onboarding in Phase 1 (leads require a workspace).
export async function _createNewUserAndLead({
  name,
  email,
  password,
  isAdmin,
}: {
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  assignToSelf?: boolean;
}) {
  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : await bcrypt.hash(randomBytes(16).toString('hex'), 12);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: isAdmin ? 'SUPER_ADMIN' : 'USER',
    },
  });

  return newUser;
}

export type UserSummary = {
  $id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  emailVerification: boolean;
  createdAt: string;
};

// Helper to check for admin
async function requireAdmin() {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return user;
}

export async function listUsers(): Promise<UserSummary[]> {
  await requireAdmin();
  try {
    const users = await prisma.user.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => ({
      $id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.role === 'SUPER_ADMIN',
      emailVerification: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error('Failed to list users:', e);
    return [];
  }
}

const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  isAdmin: z.boolean().default(false),
});

export async function createUser(prevState: any, formData: FormData) {
  const adminUser = await requireAdmin();

  const validatedFields = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    isAdmin: formData.get('isAdmin') === 'on',
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Invalid data.', errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password, isAdmin: makeAdmin } = validatedFields.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { status: 'error', message: 'A user with this email already exists.' };
    }

    await _createNewUserAndLead({
      name,
      email,
      password,
      isAdmin: makeAdmin,
      assignToSelf: true,
    });

    await logAudit({
      userId: adminUser.$id,
      action: 'platform.user.created',
      entityType: 'User',
      metadata: { email, isAdmin: makeAdmin },
    });

    revalidatePath('/settings');
    revalidatePath('/leads');
    return { status: 'success', message: `User "${name}" created successfully.` };
  } catch (e) {
    console.error('Failed to create user:', e);
    return { status: 'error', message: 'An unexpected error occurred.' };
  }
}

export async function deleteUser(userId: string) {
  const adminUser = await requireAdmin();
  if (adminUser.$id === userId) {
    return { status: 'error', message: 'You cannot delete your own account.' };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });

    await logAudit({
      userId: adminUser.$id,
      action: 'platform.user.deleted',
      entityType: 'User',
      entityId: userId,
    });

    revalidatePath('/settings');
    revalidatePath('/leads');
    return { status: 'success', message: 'User deleted successfully.' };
  } catch (e) {
    console.error('Failed to delete user:', e);
    return { status: 'error', message: 'An unexpected error occurred while deleting the user.' };
  }
}

export async function updateUserRole(userId: string, makeAdmin: boolean) {
  const adminUser = await requireAdmin();
  if (adminUser.$id === userId) {
    return { status: 'error', message: 'You cannot change your own role.' };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: makeAdmin ? 'SUPER_ADMIN' : 'USER' },
    });

    await logAudit({
      userId: adminUser.$id,
      action: 'platform.user.role_changed',
      entityType: 'User',
      entityId: userId,
      metadata: { makeAdmin },
    });

    revalidatePath('/settings');
    return { status: 'success', message: 'User role updated.' };
  } catch (e) {
    console.error('Failed to update user role:', e);
    return { status: 'error', message: 'An unexpected error occurred while updating the role.' };
  }
}

export async function sendPasswordReset(email: string) {
  await requireAdmin();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { status: 'error', message: 'No user found with that email.' };
    }

    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        // Stored hashed — resetPassword hashes the incoming token to match.
        token: createHash('sha256').update(token).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MS),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_BASE_URL is not set. Cannot build password reset link.');
      return { status: 'error', message: 'Application base URL is not configured.' };
    }

    const resetUrl = `${baseUrl}/reset-password?userId=${user.id}&token=${token}`;
    // No email provider is configured (free tier), so the link is returned to the admin.
    return {
      status: 'success',
      message: `Reset link generated for ${email}: ${resetUrl}`,
    };
  } catch (e) {
    console.error('Failed to generate password reset:', e);
    return { status: 'error', message: 'An unexpected error occurred.' };
  }
}
