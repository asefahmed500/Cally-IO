import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'cally_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Session user shape. `$id` / `labels` are kept for compatibility with the
 * existing UI layer (labels[0] === 'admin' is the admin check used everywhere).
 */
export type SessionUser = {
  $id: string;
  name: string;
  email: string;
  labels: ('user' | 'admin')[];
  emailVerified: boolean;
  createdAt: string;
};

function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
}): SessionUser {
  const labels: ('user' | 'admin')[] = ['user'];
  if (user.role === 'SUPER_ADMIN') labels.push('admin');
  return {
    $id: user.id,
    name: user.name,
    email: user.email,
    labels,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Returns the currently logged-in user based on the session cookie,
 * or null when unauthenticated / session expired.
 */
export async function getLoggedInUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;

    const session = await prisma.session.findUnique({
      where: { token: hashToken(sessionToken) },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return toSessionUser(session.user);
  } catch (error) {
    console.error('getLoggedInUser failed:', error);
    return null;
  }
}

/** Creates a DB-backed session and sets the httpOnly session cookie. */
export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      token: hashToken(rawToken),
      userId,
      expiresAt,
    },
  });

  cookies().set(SESSION_COOKIE_NAME, rawToken, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  });
}

/** Deletes the current DB session and clears the cookie. */
export async function destroySession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    await prisma.session
      .delete({ where: { token: hashToken(sessionToken) } })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
