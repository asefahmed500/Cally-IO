'use server'

import { account } from '@/lib/appwrite-server';
import { setSessionCookie, deleteSessionCookie } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { Client, Account as UserAccount } from 'appwrite';
import { _createNewUserAndLead } from '../settings/users_actions';

export async function signup(prevState: any, formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const isAdmin = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL;
    
    await _createNewUserAndLead({
      name,
      email,
      password,
      labels: isAdmin ? ['user', 'admin'] : ['user'],
      assignToSelf: false, // Public signup leads are unassigned
    });
    
    const session = await account.createEmailPasswordSession(email, password);
    await setSessionCookie(session.secret, session.expire);
  } catch (e: any) {
    console.error(e);
    // If user already exists, Appwrite throws a specific error.
    // We can check for that and provide a friendlier message.
    if (e.code === 409) {
        return { message: 'A user with this email already exists. Please try logging in.'}
    }
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
  try {
    const session = cookies().get('appwrite-session');
    if (session) {
        const client = new Client()
            .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
            .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
            .setSession(session.value);
        
        const userAccount = new UserAccount(client);
        await userAccount.deleteSession('current');
    }
  } catch (e: any) {
    // If the session is invalid or expired, Appwrite throws an error.
    // We can ignore this and proceed to delete the cookie.
  }

  await deleteSessionCookie();
  redirect('/');
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  try {
    const headersList = headers();
    const origin = headersList.get('origin');
    if (!origin) {
      throw new Error('Could not determine application origin URL.');
    }
    const resetUrl = `${origin}/reset-password`;
    await account.createRecovery(email, resetUrl);
    return { success: true, message: "A password reset link has been sent to your email address. Please check your inbox." };
  } catch (e: any) {
    console.error(e);
    // Return a generic message to prevent email enumeration
    return { message: "If an account with that email exists, a reset link will be sent." };
  }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const userId = formData.get('userId') as string;
    const secret = formData.get('secret') as string;
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('passwordConfirm') as string;

    if (!userId || !secret) {
        return { message: 'Invalid request. Missing user ID or secret.'}
    }

    if (password !== passwordConfirm) {
        return { message: 'Passwords do not match.'}
    }

    try {
        await account.updateRecovery(userId, secret, password, passwordConfirm);
    } catch (e: any) {
        console.error(e);
        return { message: `Failed to reset password. The link may have expired. Error: ${e.message}` };
    }

    redirect('/login');
}
