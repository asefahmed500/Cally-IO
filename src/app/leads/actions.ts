
'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import twilio from 'twilio';
import { ID, Permission, Role, Query, Models, AppwriteException } from 'node-appwrite';
import { z } from 'zod';
import type { Lead } from './types';

export async function getLeads(user: Models.User<Models.Preferences>): Promise<{leads: Lead[], error: string | null}> {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;
    const isAdmin = user.labels.includes('admin');

    if (!dbId || !leadsCollectionId) {
        return { leads: [], error: null };
    }

    try {
        if (isAdmin) {
            const response = await databases.listDocuments(
                dbId,
                leadsCollectionId,
                [Query.orderDesc('$createdAt'), Query.limit(500)]
            );
            return { leads: response.documents as Lead[], error: null };
        } else {
            // For non-admins, fetch both their assigned leads and unassigned leads.
            // This is done in two queries to handle cases where the 'agentId' attribute
            // might not be nullable, which would cause `Query.equal('agentId', [id, null])` to fail.
            const assignedLeadsPromise = databases.listDocuments(
                dbId,
                leadsCollectionId,
                [Query.equal('agentId', user.$id), Query.limit(250)]
            );

            // An unassigned lead is one where the agentId attribute is null.
            const unassignedLeadsPromise = databases.listDocuments(
                dbId,
                leadsCollectionId,
                [Query.isNull('agentId'), Query.limit(250)]
            );

            const [assignedResponse, unassignedResponse] = await Promise.all([
                assignedLeadsPromise,
                unassignedLeadsPromise,
            ]);

            const combinedLeads = [
                ...assignedResponse.documents,
                ...unassignedResponse.documents,
            ];
            
            // Remove duplicates just in case (though there shouldn't be any).
            const uniqueLeads = Array.from(new Map(combinedLeads.map(lead => [lead.$id, lead])).values());

            // Sort by creation date, newest first, as the original query did.
            uniqueLeads.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());

            return { leads: uniqueLeads as Lead[], error: null };
        }
    } catch (e: any) {
        console.error("Failed to fetch leads:", e);
        if (e instanceof AppwriteException && e.type === 'general_query_invalid') {
            return { leads: [], error: `Database Error: The 'leads' collection has a schema error. Please check your Appwrite project configuration. Details: ${e.message}` };
        }
        return { leads: [], error: `An unexpected error occurred while fetching leads: ${e.message}` };
    }
}

const LeadSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2, 'Name must be at least 2 characters.'),
    email: z.string().email('Please enter a valid email address.'),
    phone: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    notes: z.string().optional(),
    followUpDate: z.string().optional(),
    followUpNotes: z.string().optional(),
});

export async function saveLead(prevState: any, formData: FormData) {
    const user = await getLoggedInUser();
    if (!user) {
        return { status: 'error', message: 'Unauthorized. Please log in.' };
    }
    const isAdmin = user.labels.includes('admin');
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

    const validatedFields = LeadSchema.safeParse({
        id: formData.get('id'),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        jobTitle: formData.get('jobTitle'),
        notes: formData.get('notes'),
        followUpDate: formData.get('followUpDate'),
        followUpNotes: formData.get('followUpNotes'),
    });

    if (!validatedFields.success) {
        return {
            status: 'error',
            message: 'Invalid data provided.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    const { id, ...leadDataFromForm } = validatedFields.data;
    const agentIdFromForm = formData.get('agentId') as string | null;

    const leadPayload: { [key: string]: any } = {
        ...leadDataFromForm,
        followUpDate: leadDataFromForm.followUpDate || null,
        followUpNotes: leadDataFromForm.followUpNotes || null,
        lastActivity: new Date().toISOString(),
    };


    try {
        if (id) {
            // Updating an existing lead
            const existingLead = await databases.getDocument(dbId, leadsCollectionId, id);
            if (!isAdmin && existingLead.agentId !== user.$id) {
                return { status: 'error', message: "You don't have permission to edit this lead." };
            }
            // Only admins can change the agent assignment during an edit.
            if (isAdmin) {
                leadPayload.agentId = agentIdFromForm || null;
            }

            await databases.updateDocument(dbId, leadsCollectionId, id, leadPayload);
        } else {
            // Creating a new lead
            const agentForNewLead = isAdmin ? (agentIdFromForm || null) : user.$id;

            const newLeadData = {
                ...leadPayload,
                status: 'New',
                score: Math.floor(Math.random() * 21) + 10,
                agentId: agentForNewLead,
            };

            // Refined permissions for better security
            const permissions = [
                Permission.read(Role.label('admin')),
                Permission.update(Role.label('admin')),
                Permission.delete(Role.label('admin')),
            ];

            if (agentForNewLead) {
                // If the lead is assigned, only that agent and admins should have access.
                permissions.push(Permission.read(Role.user(agentForNewLead)));
                permissions.push(Permission.update(Role.user(agentForNewLead)));
                permissions.push(Permission.delete(Role.user(agentForNewLead)));
            } else {
                // If the lead is unassigned, any logged-in user can read it (to see it in the 'New' column)
                // and any user can update it (which is how they "claim" it).
                // The updateLeadStatus action provides the final check and locks permissions.
                permissions.push(Permission.read(Role.users()));
                permissions.push(Permission.update(Role.users()));
            }

            await databases.createDocument(
                dbId,
                leadsCollectionId,
                ID.unique(),
                newLeadData,
                permissions
            );
        }

        revalidatePath('/leads');
        revalidatePath('/dashboard');
        return { status: 'success', message: `Lead ${id ? 'updated' : 'created'} successfully.` };

    } catch (e: any) {
        console.error('Failed to save lead:', e);
        return { status: 'error', message: `Database error: ${e.message}` };
    }
}

export async function deleteLead(leadId: string) {
    const user = await getLoggedInUser();
    if (!user) {
        return { error: 'Unauthorized. Please log in.' };
    }
    const isAdmin = user.labels.includes('admin');
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

    try {
        const lead = await databases.getDocument(dbId, leadsCollectionId, leadId);
        if (!isAdmin && lead.agentId !== user.$id) {
            return { error: "You don't have permission to delete this lead." };
        }
        await databases.deleteDocument(dbId, leadsCollectionId, leadId);
        revalidatePath('/leads');
        revalidatePath('/dashboard');
        return { success: true };
    } catch(e: any) {
        console.error("Failed to delete lead:", e);
        return { error: `Database error: ${e.message}` };
    }
}


export async function updateLeadStatus(leadId: string, status: string) {
  const user = await getLoggedInUser();
  if (!user) {
    return { error: 'Unauthorized access.' };
  }
  const isAdmin = user.labels.includes('admin');
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

  try {
    const lead = await databases.getDocument(dbId, leadsCollectionId, leadId);

    // SECURITY CHECK: Only admin or assigned agent (or anyone if unassigned) can update
    if (!isAdmin && lead.agentId && lead.agentId !== user.$id) {
        return { error: 'You do not have permission to update this lead.' };
    }
    
    const wasClaimed = !lead.agentId;

    const updateData: { status: string; lastActivity: string; agentId?: string; $permissions?: string[] } = {
        status,
        lastActivity: new Date().toISOString(),
    };

    // If the lead is unassigned, assign it to the current user ("claim" it)
    // and lock down the permissions.
    if (!lead.agentId) {
        updateData.agentId = user.$id;
        updateData.$permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
            Permission.read(Role.label('admin')),
            Permission.update(Role.label('admin')),
            Permission.delete(Role.label('admin')),
        ];
    }

    await databases.updateDocument(dbId, leadsCollectionId, leadId, updateData);
    
    revalidatePath('/leads');
    revalidatePath('/dashboard'); // To update agent stats
    return { success: true, claimed: wasClaimed };
  } catch (e: any) {
    console.error('Failed to update lead status:', e);
    return { error: 'Failed to update lead status in the database.' };
  }
}

export async function initiateCall(leadData: Lead) {
    const user = await getLoggedInUser();
    if (!user) {
        return { error: 'Unauthorized access.' };
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const callLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CALL_LOGS_COLLECTION_ID!;
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return { error: "Twilio is not configured on the server. Please contact an administrator." };
    }
    if (!baseUrl) {
        return { error: "The application's public URL (NEXT_PUBLIC_BASE_URL) is not configured. Please contact an administrator." };
    }
    if (!leadData.phone) {
        return { error: "This lead does not have a phone number." };
    }
    if (!callLogsCollectionId || !dbId) {
        return { error: "Call logs collection is not configured on the server." };
    }

    try {
        const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        const webhookUrl = new URL(`/api/twilio/call?leadId=${leadData.$id}`, baseUrl);
        const statusCallbackUrl = new URL('/api/twilio/status', baseUrl);

        const call = await twilioClient.calls.create({
            to: leadData.phone,
            from: TWILIO_PHONE_NUMBER,
            url: webhookUrl.toString(),
            statusCallback: statusCallbackUrl.toString(),
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        });

        // Log the call initiation in our database
        const permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
            Permission.read(Role.label('admin')),
        ];

        await databases.createDocument(
            dbId,
            callLogsCollectionId,
            ID.unique(),
            {
                leadId: leadData.$id,
                userId: user.$id,
                callSid: call.sid,
                status: 'initiated',
            },
            permissions
        );
        
        // Update lead status to 'Called'
        await databases.updateDocument(dbId, leadsCollectionId, leadData.$id, {
            status: 'Called',
            lastActivity: new Date().toISOString(),
        });
        
        revalidatePath('/leads');
        revalidatePath('/dashboard');
        
        return { success: true, callSid: call.sid };
        
    } catch (e: any) {
        console.error('Failed to initiate Twilio call:', e);
        if (e.code === 21211) { // Invalid 'To' phone number
            return { error: `Invalid phone number for lead: ${leadData.phone}. Please check the format.`};
        }
        return { error: `Failed to initiate call: ${e.message}` };
    }
}
