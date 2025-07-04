import { getLoggedInUser } from "@/lib/auth";
import { getConversation } from "@/lib/conversation";
import { NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";

export async function GET() {
    const user = await getLoggedInUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const conversation = await getConversation(user.$id);
        const history = conversation ? conversation.history : [];
        return NextResponse.json(history);
    } catch (error: any) {
        console.error("Failed to fetch chat history:", error);
        if (error instanceof AppwriteException && error.type === 'general_query_invalid') {
             return NextResponse.json({ 
                error: "Database Schema Error", 
                message: `The 'conversations' collection has a schema error which is preventing chat history from loading. Please check your Appwrite project setup. Details: ${error.message}`,
            }, { status: 500 });
        }
        return new Response("Error fetching history", { status: 500 });
    }
}
