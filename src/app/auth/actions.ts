'use server'

import { users, account } from '@/lib/appwrite-server';
import { setSessionCookie, deleteSessionCookie } from '@/lib/auth';
import { ID } from 'node-appwrite';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signup(prevState: any, formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const isAdmin = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL;
    const labels = isAdmin ? ['user', 'admin'] : ['user'];
    
    await users.create(ID.unique(), email, '', password, name, labels);
    const session = await account.createEmailPasswordSession(email, password);
    await setSessionCookie(session.secret, session.expire);
  } catch (e: any) {
    console.error(e);
    return { message: e.message };
  }
  redirect('/dashboard');
}

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const session = await account.createEmailPasswordSession(email, password);
    await setSessionCookie(session.secret, session.expire);
  } catch (e: any) {
    console.error(e);
    return { message: e.message };
  }
  redirect('/dashboard');
}

export async function logout() {
  const session = headers().get('X-Appwrite-Session');
  if (session) {
    try {
        await account.deleteSession(session);
    } catch(e) {
        // session might be invalid, but we want to delete cookie anyway
    }
  }
  await deleteSessionCookie();
  redirect('/');
}
