'use server';

import { users, account } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ID, AppwriteException, Query } from 'node-appwrite';
import { z } from 'zod';

// Helper to check for admin
async function isAdmin() {
    const user = await getLoggedInUser();
    if (!user || !user.labels.includes('admin')) {
        throw new Error('Unauthorized: Admin access required.');
    }
    return user;
}

export async function listUsers() {
    await isAdmin();
    try {
        const response = await users.list([Query.limit(100)]); // Get up to 100 users
        return response.users.map(user => ({
            $id: user.$id,
            name: user.name,
            email: user.email,
            labels: user.labels,
            emailVerification: user.emailVerification,
            createdAt: user.$createdAt,
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
    await isAdmin();

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
        const newUser = await users.create(ID.unique(), email, undefined, password, name);
        const labels = makeAdmin ? ['user', 'admin'] : ['user'];
        await users.updateLabels(newUser.$id, labels);

        revalidatePath('/settings');
        return { status: 'success', message: `User "${name}" created successfully.` };
    } catch (e) {
        if (e instanceof AppwriteException && e.code === 409) {
            return { status: 'error', message: 'A user with this email already exists.' };
        }
        console.error('Failed to create user:', e);
        return { status: 'error', message: 'An unexpected error occurred.' };
    }
}

export async function deleteUser(userId: string) {
    const adminUser = await isAdmin();
    if (adminUser.$id === userId) {
        return { status: 'error', message: "You cannot delete your own account." };
    }

    try {
        await users.delete(userId);
        revalidatePath('/settings');
        return { status: 'success', message: 'User deleted successfully.' };
    } catch (e) {
        console.error('Failed to delete user:', e);
        return { status: 'error', message: 'An unexpected error occurred while deleting the user.' };
    }
}

export async function updateUserRole(userId: string, currentLabels: string[], makeAdmin: boolean) {
    const adminUser = await isAdmin();
     if (adminUser.$id === userId) {
        return { status: 'error', message: "You cannot change your own role." };
    }

    try {
        let newLabels = [...currentLabels];
        if (makeAdmin) {
            if (!newLabels.includes('admin')) newLabels.push('admin');
        } else {
            newLabels = newLabels.filter(label => label !== 'admin');
        }
        
        if (!newLabels.includes('user')) newLabels.push('user');

        await users.updateLabels(userId, newLabels);
        revalidatePath('/settings');
        return { status: 'success', message: 'User role updated.' };
    } catch (e) {
         console.error('Failed to update user role:', e);
        return { status: 'error', message: 'An unexpected error occurred while updating the role.' };
    }
}

export async function sendPasswordReset(email: string) {
    await isAdmin();
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        if(!baseUrl) {
            console.error("NEXT_PUBLIC_BASE_URL is not set. Cannot send password reset email.");
            return { status: 'error', message: 'Application base URL is not configured.'};
        };
        const resetUrl = `${baseUrl}/reset-password`;
        await account.createRecovery(email, resetUrl);
        return { status: 'success', message: `Password reset link sent to ${email}.`};
    } catch (e) {
        console.error('Failed to send password reset:', e);
        return { status: 'error', message: 'An unexpected error occurred.' };
    }
}
