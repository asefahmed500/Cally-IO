
import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite-server';
import { Query } from 'node-appwrite';

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const callLogsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CALL_LOGS_COLLECTION_ID!;

// This route is a webhook that receives call status updates from Twilio.
export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const duration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    
    if (!callSid) {
        return new NextResponse('Missing CallSid', { status: 400 });
    }
    
    if (!dbId || !callLogsCollectionId) {
        console.error("Call logs collection not configured on server.");
        return new NextResponse('Server configuration error', { status: 500 });
    }

    try {
        // Find the log entry by callSid
        const logEntries = await databases.listDocuments(
            dbId,
            callLogsCollectionId,
            [Query.equal('callSid', callSid), Query.limit(1)]
        );

        if (logEntries.documents.length === 0) {
            console.warn(`No call log found for SID: ${callSid}`);
            return new NextResponse('Call log not found', { status: 404 });
        }
        
        const logEntry = logEntries.documents[0];
        
        const updateData: any = {
            status: callStatus,
        };
        if (duration) {
            updateData.duration = parseInt(duration, 10);
        }
        if (recordingUrl) {
            updateData.recordingUrl = recordingUrl;
        }

        await databases.updateDocument(dbId, callLogsCollectionId, logEntry.$id, updateData);

        return new NextResponse('Status updated', { status: 200 });

    } catch (error: any) {
        console.error(`Error updating call status for SID ${callSid}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
