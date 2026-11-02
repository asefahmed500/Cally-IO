'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSession, destroySession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { _createNewUserAndLead } from '../settings/users_actions';

const RESET_TOKEN_DURATION_MS = 1000 * 60 * 60; // 1 hour

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(200),
});

const EmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

/** SHA-256 hash — reset/invite tokens are stored hashed, never in plaintext. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function authRateLimit(scope: string, email: string): Promise<boolean> {
  const headerList = headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`auth:${scope}:${ip}`, 'auth'),
    rateLimit(`auth:${scope}:${email}`, 'auth'),
  ]);
  return byIp.ok && byEmail.ok;
}

export async function signup(prevState: unknown, formData: FormData) {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const field = parsed.error.flatten().fieldErrors;
    return {
      errors: {
        email: field.email?.[0],
        password: field.password?.[0] ?? 'Password must be at least 8 characters long.',
      },
    };
  }

  const { email, password } = parsed.data;
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);

  if (!(await authRateLimit('signup', email))) {
    return { message: 'Too many attempts. Please try again later.' };
  }

  try {
    const isAdmin = !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL;

    const user = await _createNewUserAndLead({
      name,
      email,
      password,
      isAdmin,
      assignToSelf: false, // Public signup leads are unassigned
    });

    await createSession(user.id);
  } catch (e: unknown) {
    // P2002 = unique constraint violation on email (concurrent signup).
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { message: 'A user with this email already exists. Please try logging in.' };
    }
    console.error(e);
    return { message: 'An unexpected error occurred during signup. Please try again.' };
  }
  redirect('/dashboard');
}

export async function login(prevState: unknown, formData: FormData) {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { message: 'Invalid email or password. Please try again.' };
  }

  const { email, password } = parsed.data;

  if (!(await authRateLimit('login', email))) {
    return { message: 'Too many attempts. Please try again later.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return { message: 'Invalid email or password. Please try again.' };
    }
    await createSession(user.id);
  } catch (e: unknown) {
    console.error(e);
    return { message: 'An unexpected error occurred. Please try again later.' };
  }
  redirect('/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function forgotPassword(prevState: unknown, formData: FormData) {
  const parsed = EmailSchema.safeParse({ email: formData.get('email') });
  // Same generic response for invalid input — no email enumeration.
  if (!parsed.success) {
    return { message: 'If an account with that email exists, a reset link will be sent.' };
  }
  const { email } = parsed.data;

  if (!(await authRateLimit('forgot', email))) {
    return { message: 'If an account with that email exists, a reset link will be sent.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return a generic message to prevent email enumeration.
    if (!user) {
      return { message: 'If an account with that email exists, a reset link will be sent.' };
    }

    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        token: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MS),
      },
    });

    const headersList = headers();
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_BASE_URL;
    const resetUrl = `${origin}/reset-password?userId=${user.id}&token=${token}`;

    // Never expose the reset URL to the client (account-takeover vector).
    // With no email provider configured, log it outside production so the
    // flow stays testable in development.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev] Password reset link for ${email}: ${resetUrl}`);
    }

    return {
      success: true,
      message: 'If an account with that email exists, a reset link will be sent.',
    };
  } catch (e: unknown) {
    console.error(e);
    return { message: 'An unexpected error occurred. Please try again later.' };
  }
}

export async function resetPassword(prevState: unknown, formData: FormData) {
  const userId = formData.get('userId') as string;
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;
  const passwordConfirm = formData.get('passwordConfirm') as string;

  if (!userId || !token) {
    return { message: 'Invalid request. Missing user ID or token.' };
  }

  if (password !== passwordConfirm) {
    return { message: 'Passwords do not match.' };
  }

  if (!password || password.length < 8 || password.length > 200) {
    return { message: 'Password must be between 8 and 200 characters long.' };
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
    });

    if (!resetToken || resetToken.userId !== userId || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return { message: 'This reset link is invalid or has expired. Please request a new one.' };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // Any existing session for this user is revoked after a password reset.
      prisma.session.deleteMany({ where: { userId } }),
    ]);
  } catch (e: unknown) {
    console.error(e);
    return { message: 'Failed to reset password. Please try again.' };
  }

  redirect('/login');
}
