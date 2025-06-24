'use server';

import { databases } from '@/lib/appwrite-server';
import { getLoggedInUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateScript, type GenerateCallScriptInput } from '@/ai/flows/generate-call-script';
import { twilio } from 'twilio';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

export async function updateLeadStatus(leadId: string, status: string) {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    return { error: 'Unauthorized access.' };
  }

  try {
    await databases.updateDocument(dbId, leadsCollectionId, leadId, { 
        status,
        lastActivity: new Date().toISOString() 
    });
    revalidatePath('/leads');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to update lead status:', e);
    return { error: 'Failed to update lead status in the database.' };
  }
}

export async function initiateCall(leadData: GenerateCallScriptInput) {
    const user = await getLoggedInUser();
    if (!user || !user.labels.includes('admin')) {
        return { error: 'Unauthorized access.' };
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

    try {
        const script = await generateScript(leadData);

        // Placeholder for actual Twilio call logic
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
            console.log("--- SIMULATING TWILIO CALL ---");
            console.log(`From: ${TWILIO_PHONE_NUMBER}`);
            // In a real app, you would fetch the lead's phone number from the database
            console.log(`To: [Lead's Phone Number] for ${leadData.leadName}`);
            console.log("Generated Script to be used for Text-to-Speech:");
            console.log(script);
            console.log("-----------------------------");

            // Example of real Twilio client usage:
            // const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            // await client.calls.create({
            //     twiml: `<Response><Say>${script}</Say></Response>`,
            //     to: '+1234567890', // The lead's actual phone number
            //     from: TWILIO_PHONE_NUMBER
            // });

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
