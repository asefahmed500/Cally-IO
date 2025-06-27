'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateScript, type GenerateCallScriptInput } from '@/ai/flows/generate-call-script';
import { twilio } from 'twilio';
import { getAISettings } from '@/lib/settings';
import { ID, Permission, Role, Query } from 'node-appwrite';
import { z } from 'zod';
import type { Lead } from './page';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

const LeadSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2, 'Name must be at least 2 characters.'),
    email: z.string().email('Please enter a valid email address.'),
    phone: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    notes: z.string().optional(),
});

export async function saveLead(prevState: any, formData: FormData) {
    const user = await getLoggedInUser();
    if (!user) {
        return { status: 'error', message: 'Unauthorized. Please log in.' };
    }
    const isAdmin = user.labels.includes('admin');

    const validatedFields = LeadSchema.safeParse({
        id: formData.get('id'),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        jobTitle: formData.get('jobTitle'),
        notes: formData.get('notes'),
    });

    if (!validatedFields.success) {
        return {
            status: 'error',
            message: 'Invalid data provided.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    const { id, ...leadData } = validatedFields.data;

    try {
        if (id) {
            // Updating an existing lead
            const existingLead = await databases.getDocument(dbId, leadsCollectionId, id);
            if (!isAdmin && existingLead.agentId !== user.$id) {
                return { status: 'error', message: "You don't have permission to edit this lead." };
            }
            await databases.updateDocument(dbId, leadsCollectionId, id, leadData);
        } else {
            // Creating a new lead
            const newLeadData = {
                ...leadData,
                status: 'New',
                score: Math.floor(Math.random() * 21) + 10,
                lastActivity: new Date().toISOString(),
                agentId: user.$id, // Associate this lead with the agent creating it
            };
            await databases.createDocument(
                dbId,
                leadsCollectionId,
                ID.unique(),
                newLeadData,
                [
                    Permission.read(Role.user(user.$id)),
                    Permission.update(Role.user(user.$id)),
                    Permission.delete(Role.user(user.$id)),
                    Permission.read(Role.label('admin')),
                    Permission.update(Role.label('admin')),
                    Permission.delete(Role.label('admin')),
                ]
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

  try {
    const lead = await databases.getDocument(dbId, leadsCollectionId, leadId);
    
    const updateData: { status: string; lastActivity: string; agentId?: string } = {
        status,
        lastActivity: new Date().toISOString(),
    };

    // If the lead is unassigned, assign it to the current user ("claim" it).
    if (!lead.agentId) {
        updateData.agentId = user.$id;
    }

    await databases.updateDocument(dbId, leadsCollectionId, leadId, updateData);
    
    revalidatePath('/leads');
    revalidatePath('/dashboard'); // To update agent stats
    return { success: true };
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

    try {
        const settings = await getAISettings();
        const scriptTemplate = settings.scriptTemplate;
        
        const scriptInput: GenerateCallScriptInput = {
            leadName: leadData.name,
            leadStatus: leadData.status,
            leadScore: leadData.score,
            company: leadData.company,
            jobTitle: leadData.jobTitle,
            scriptTemplate,
        };

        const script = await generateScript(scriptInput);

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
            console.log("--- SIMULATING TWILIO CALL ---");
            console.log(`From: ${TWILIO_PHONE_NUMBER}`);
            console.log(`To: ${leadData.phone || '[No Phone Number]'}`);
            console.log(`Lead: ${leadData.name}`);
            console.log("Generated Script to be used for Text-to-Speech:");
            console.log(script);
            console.log("-----------------------------");

            return { success: true, script, message: "Call initiated successfully (Simulated)." };

        } else {
            console.warn("Twilio credentials not set. Skipping call, returning script only.");
            return { success: true, script, message: "Twilio not configured. Generated script only." };
        }
        
    } catch (e: any) {
        console.error('Failed to initiate call:', e);
        return { error: `Failed to generate script: ${e.message}` };
    }
}
