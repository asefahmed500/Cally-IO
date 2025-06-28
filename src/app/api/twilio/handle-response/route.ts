
import { NextRequest, NextResponse } from 'next/server';
import { twiml } from 'twilio';
import { databases } from '@/lib/appwrite-server';
import { Query } from 'node-appwrite';
import { interpretSpokenResponse } from '@/ai/flows/interpret-spoken-response';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const callLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CALL_LOGS_COLLECTION_ID!;

// This route is called by Twilio after the <Gather> verb completes.
// It uses an AI flow to interpret the speech and decides the next step.
export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = (formData.get('SpeechResult') as string || '');
    const confidence = parseFloat(formData.get('Confidence') as string || '0');

    const voiceResponse = new twiml.VoiceResponse();

    try {
        let finalMessage = "I'm sorry, I didn't quite catch that. We will have someone from our team reach out. Goodbye.";

        if (speechResult) {
            // Call the AI flow to interpret the response
            const interpretation = await interpretSpokenResponse(speechResult);
            finalMessage = interpretation.finalMessage;

            // Update the call log with the structured interpretation
            if (callSid) {
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
                            { 
                                leadResponse: `[${interpretation.intent}] ${interpretation.summary}`, 
                                speechConfidence: confidence 
                            }
                        );
                    }
                } catch (e) {
                    console.error("Error updating call log with AI interpretation:", e);
                    // Don't let logging failure break the call flow
                }
            }
        }

        voiceResponse.say({ voice: 'alice' }, finalMessage);

    } catch(e) {
        console.error("Error during AI response interpretation:", e);
        // Fallback message if the AI flow fails
        voiceResponse.say({ voice: 'alice' }, "I'm sorry, an error occurred with our system. A specialist will reach out shortly. Goodbye.");
    }

    voiceResponse.hangup();

    return new NextResponse(voiceResponse.toString(), {
        headers: { 'Content-Type': 'application/xml' },
    });
}
