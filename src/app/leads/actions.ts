'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateScript, type GenerateCallScriptInput } from '@/ai/flows/generate-call-script';
import { twilio } from 'twilio';
import { getAISettings } from '@/lib/settings';
import { ID, Permission, Role, Query } from 'node-appwrite';
import { z } from 'zod';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

const CreateLeadSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters.'),
    email: z.string().email('Please enter a valid email address.'),
});

export async function createLead(prevState: any, formData: FormData) {
    const user = await getLoggedInUser();
    if (!user) {
        return { status: 'error', message: 'Unauthorized. Please log in.' };
    }

    const validatedFields = CreateLeadSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
    });

    if (!validatedFields.success) {
        return {
            status: 'error',
            message: 'Invalid data provided.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    const { name, email } = validatedFields.data;

    try {
        const leadData = {
            userId: null, // This is a manually created lead, not a registered user
            name,
            email,
            status: 'New',
            score: Math.floor(Math.random() * 21) + 10,
            lastActivity: new Date().toISOString(),
            agentId: user.$id, // Associate this lead with the agent creating it
        };

        await databases.createDocument(
            dbId,
            leadsCollectionId,
            ID.unique(),
            leadData,
            [
                Permission.read(Role.user(user.$id)), // The agent can read
                Permission.update(Role.user(user.$id)), // The agent can update
                Permission.delete(Role.user(user.$id)), // The agent can delete
                Permission.read(Role.label('admin')), // Admins can read all
                Permission.update(Role.label('admin')),
                Permission.delete(Role.label('admin')),
            ]
        );

        revalidatePath('/leads');
        revalidatePath('/dashboard');
        return { status: 'success', message: 'Lead created successfully.' };

    } catch (e: any) {
        console.error('Failed to create lead:', e);
        return { status: 'error', message: `Database error: ${e.message}` };
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

// The input type is simplified as the template is fetched server-side.
type InitiateCallInput = Omit<GenerateCallScriptInput, 'scriptTemplate'>;

export async function initiateCall(leadData: InitiateCallInput) {
    const user = await getLoggedInUser();
    if (!user) {
        return { error: 'Unauthorized access.' };
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

    try {
        // 1. Fetch the saved script template from settings
        const settings = await getAISettings();
        const scriptTemplate = settings.scriptTemplate;
        
        // 2. Combine lead data with the fetched template
        const scriptInput: GenerateCallScriptInput = {
            ...leadData,
            scriptTemplate,
        };

        // 3. Generate the script
        const script = await generateScript(scriptInput);

        // 4. (Simulate) Twilio Call
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
            console.log("--- SIMULATING TWILIO CALL ---");
            console.log(`From: ${TWILIO_PHONE_NUMBER}`);
            // In a real app, you would fetch the lead's phone number from the database
            console.log(`To: [Lead's Phone Number] for ${leadData.leadName}`);
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
