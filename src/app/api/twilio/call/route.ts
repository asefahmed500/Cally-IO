
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!leadId) {
        return new NextResponse('Missing leadId parameter', { status: 400 });
    }
    if (!baseUrl) {
        // This is critical for the <Gather> action URL
        console.error("NEXT_PUBLIC_BASE_URL is not configured.");
        return new NextResponse('Server configuration error', { status: 500 });
    }

    try {
        const lead = await databases.getDocument(dbId, leadsCollectionId, leadId) as Lead;
        
        const settings = await getAISettings();
        const scriptTemplate = settings.scriptTemplate;

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
        voiceResponse.say({ voice: 'alice' }, `Hello ${lead.name}.`);
        voiceResponse.pause({ length: 1 });
        voiceResponse.say({ voice: 'alice' }, personalizedScript);
        voiceResponse.pause({ length: 1 });
        
        // After the script, ask a question and gather the response.
        const gather = voiceResponse.gather({
            input: ['speech'],
            action: `${baseUrl}/api/twilio/handle-response`, // The new webhook to process the speech
            method: 'POST',
            speechTimeout: 'auto', // Let Twilio determine the end of speech
            speechModel: 'phone_call', // Optimized for phone audio
        });
        gather.say({ voice: 'alice' }, "Are you interested in learning more? Please say yes or no.");

        // If the user doesn't say anything, this will be executed.
        voiceResponse.say({ voice: 'alice' }, "We didn't receive a response. We'll have someone reach out. Goodbye.");
        voiceResponse.hangup();

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
