
import { NextRequest, NextResponse } from 'next/server';
import { twiml } from 'twilio';
import { databases } from '@/lib/appwrite-server';
import { Query } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const callLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CALL_LOGS_COLLECTION_ID!;

// This route is called by Twilio after the <Gather> verb completes.
// It processes the user's speech and decides the next step.
export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = (formData.get('SpeechResult') as string || '').toLowerCase();
    const confidence = parseFloat(formData.get('Confidence') as string || '0');

    const voiceResponse = new twiml.VoiceResponse();

    // Update the call log with the response
    if (callSid && speechResult) {
        try {
            const logEntries = await databases.listDocuments(
                dbId,
                callLogsCollectionId,
                [Query.equal('callSid', callSid), Query.limit(1)]
            );

            if (logEntries.documents.length > 0) {
                const logEntry = logEntries.documents[0];
                await databases.updateDocument(
                    dbId, 
                    callLogsCollectionId, 
                    logEntry.$id, 
                    { leadResponse: speechResult, speechConfidence: confidence }
                );
            }
        } catch (e) {
            console.error("Error updating call log with speech result:", e);
            // Don't let logging failure break the call flow
        }
    }

    // Simple logic based on the speech result
    if (speechResult.includes('yes')) {
        voiceResponse.say({ voice: 'alice' }, "That's great to hear. A specialist will be in touch with you shortly. Thank you for your time. Goodbye.");
    } else if (speechResult.includes('no')) {
        voiceResponse.say({ voice: 'alice' }, "I understand. Thank you for your time. Goodbye.");
    } else {
        voiceResponse.say({ voice: 'alice' }, "I'm sorry, I didn't quite catch that. We will have someone from our team reach out. Goodbye.");
    }

    voiceResponse.hangup();

    return new NextResponse(voiceResponse.toString(), {
        headers: { 'Content-Type': 'application/xml' },
    });
}
