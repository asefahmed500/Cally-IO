
'use server';

import { users, account, databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ID, AppwriteException, Query, Permission, Role } from 'node-appwrite';
import { z } from 'zod';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

export type UserSummary = {
    $id: string;
    name: string;
    email: string;
    labels: string[];
    emailVerification: boolean;
    createdAt: string;
};

// Helper to check for admin
async function isAdmin() {
    const user = await getLoggedInUser();
    if (!user || !user.labels.includes('admin')) {
        throw new Error('Unauthorized: Admin access required.');
    }
    return user;
}

export async function listUsers(): Promise<UserSummary[]> {
    await isAdmin();
    try {
        const response = await users.list([Query.limit(100)]); // Get up to 100 users
        const usersToReturn: UserSummary[] = response.users.map(user => ({
            $id: user.$id,
            name: user.name,
            email: user.email,
            labels: user.labels,
            emailVerification: user.emailVerification,
            createdAt: user.$createdAt,
        }));
        return usersToReturn;
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
        
        // Create a corresponding lead document for the new user
        if (dbId && leadsCollectionId) {
            const leadData = {
                userId: newUser.$id,
                name: name,
                email: email,
                status: 'New',
                score: Math.floor(Math.random() * 21) + 10,
                lastActivity: new Date().toISOString(),
                agentId: newUser.$id, // Assign the lead to the user themselves initially
            };
            await databases.createDocument(
                dbId,
                leadsCollectionId,
                ID.unique(),
                leadData,
                [
                    Permission.read(Role.user(newUser.$id)),
                    Permission.update(Role.user(newUser.$id)),
                    Permission.delete(Role.user(newUser.$id)),
                    Permission.read(Role.label('admin')),
                    Permission.update(Role.label('admin')),
                    Permission.delete(Role.label('admin')),
                ]
            );
        }

        revalidatePath('/settings');
        revalidatePath('/leads');
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
        revalidatePath('/leads');
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
