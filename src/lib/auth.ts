'use server';

import { cookies } from 'next/headers';
import { Account, Client } from 'appwrite';

export async function getLoggedInUser() {
  try {
    const session = cookies().get('appwrite-session');
    if (!session) return null;

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
      .setSession(session.value);
    
    const account = new Account(client);
    return await account.get();
  } catch (error) {
    return null;
  }
}

export async function setSessionCookie(secret: string, expire: string) {
    cookies().set('appwrite-session', secret, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(expire),
    });
}

export async function deleteSessionCookie() {
    cookies().delete('appwrite-session');
}
