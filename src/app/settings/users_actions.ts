
'use server';

import { users, account, databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { ID, AppwriteException, Query, Permission, Role } from 'node-appwrite';
import { z } from 'zod';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;

// Shared user creation logic to reduce duplication
export async function _createNewUserAndLead({
    name,
    email,
    password,
    labels,
    assignToSelf = false,
}: {
    name: string;
    email: string;
    password?: string;
    labels: string[];
    assignToSelf?: boolean;
}) {
    // Create the user first
    const newUser = await users.create(ID.unique(), email, undefined, password, name);
    await users.updateLabels(newUser.$id, labels);
    
    // Then create the associated lead
    if (dbId && leadsCollectionId) {
        // To prevent crashes on misconfigured databases, we create a lead object
        // that matches the documented schema but will omit the 'userId' if it causes an error.
        const leadData: { [key: string]: any; } = {
            userId: newUser.$id,
            name: name,
            email: email,
            status: 'New' as const,
            score: Math.floor(Math.random() * 21) + 10,
            lastActivity: new Date().toISOString(),
            agentId: assignToSelf ? newUser.$id : null,
        };

        const permissions = assignToSelf
            ? [ // For users created via admin panel
                Permission.read(Role.user(newUser.$id)),
                Permission.update(Role.user(newUser.$id)),
                Permission.delete(Role.user(newUser.$id)),
                Permission.read(Role.label('admin')),
                Permission.update(Role.label('admin')),
                Permission.delete(Role.label('admin')),
            ]
            : [ // For public signups
                Permission.read(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.label('admin')),
            ];

        try {
            await databases.createDocument(
                dbId,
                leadsCollectionId,
                ID.unique(),
                leadData,
                permissions
            );
        } catch (e) {
             if (e instanceof AppwriteException && e.type === 'document_invalid_structure' && e.message.includes('userId')) {
                // This is a recovery mechanism for a misconfigured database.
                // The 'userId' attribute is missing from the 'leads' collection schema.
                // To allow signup to succeed, we will try again without the 'userId'.
                console.warn("Resilience Warning: The 'userId' attribute is missing in the 'leads' collection. The new lead will not be associated with the user account. Please update your Appwrite schema according to documentation.txt to fix this.");
                const { userId, ...resilientLeadData } = leadData;
                 await databases.createDocument(
                    dbId,
                    leadsCollectionId,
                    ID.unique(),
                    resilientLeadData,
                    permissions
                );
            } else {
                // Re-throw any other errors so they can be handled by the calling function.
                throw e;
            }
        }


        // Only fire webhook for public signups (which are not assigned to self)
        if (!assignToSelf && process.env.WEBHOOK_URL_NEW_LEAD) {
            try {
                // Fire-and-forget
                fetch(process.env.WEBHOOK_URL_NEW_LEAD, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(leadData),
                });
            } catch (webhookError) {
                console.error("Failed to send new lead webhook:", webhookError);
            }
        }
    } else {
        console.error('Database or leads collection not configured. Skipping lead creation.');
    }
    
    return newUser;
}


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
        await _createNewUserAndLead({
            name,
            email,
            password,
            labels: makeAdmin ? ['user', 'admin'] : ['user'],
            assignToSelf: true,
        });

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
