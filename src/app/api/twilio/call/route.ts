
import { NextRequest, NextResponse } from 'next/server';
import { twiml } from 'twilio';
import { databases } from '@/lib/appwrite-server';
import { generateScript } from '@/ai/flows/generate-call-script';
import { getAISettings } from '@/lib/settings';
import type { Lead } from '@/app/leads/page';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID!;

// This route is called by Twilio when it initiates an outbound call.
// It generates the TwiML to control the call flow.
export async function POST(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('leadId');

    if (!leadId) {
        return new NextResponse('Missing leadId parameter', { status: 400 });
    }

    try {
        const lead = await databases.getDocument(dbId, leadsCollectionId, leadId) as Lead;
        
        // Fetch the master script template from settings
        const settings = await getAISettings();
        const scriptTemplate = settings.scriptTemplate;

        // Generate a personalized script for this specific lead
        const personalizedScript = await generateScript({
            leadName: lead.name,
            leadStatus: lead.status,
            leadScore: lead.score,
            company: lead.company,
            jobTitle: lead.jobTitle,
            scriptTemplate: scriptTemplate,
        });

        // Use TwiML to define the call's behavior
        const voiceResponse = new twiml.VoiceResponse();
        voiceResponse.say({ voice: 'alice' }, `Hello ${lead.name}. This is a call from Cally I O.`);
        voiceResponse.pause({ length: 1 });
        voiceResponse.say({ voice: 'alice' }, personalizedScript);
        voiceResponse.pause({ length: 1 });
        voiceResponse.say({ voice: 'alice' }, "Thank you for your time. Goodbye.");
        voiceResponse.hangup();

        // Return the TwiML as an XML response
        return new NextResponse(voiceResponse.toString(), {
            headers: { 'Content-Type': 'application/xml' },
        });

    } catch (error: any) {
        console.error(`Error generating TwiML for lead ${leadId}:`, error);
        const voiceResponse = new twiml.VoiceResponse();
        voiceResponse.say({ voice: 'alice' }, "I'm sorry, an error occurred with our system. Goodbye.");
        voiceResponse.hangup();
        return new NextResponse(voiceResponse.toString(), {
            status: 500,
            headers: { 'Content-Type': 'application/xml' },
        });
    }
}
