import { getLoggedInUser } from "@/lib/auth";
import { getConversation, updateConversation } from "@/lib/conversation";
import { NextResponse } from "next/server";

export async function POST() {
    const user = await getLoggedInUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const conversation = await getConversation(user.$id);
        if (conversation) {
            // Reset the history to an empty array
            await updateConversation(conversation.docId, []);
        }
        return NextResponse.json({ success: true, message: "Chat history cleared." });
    } catch (error) {
        console.error("Failed to clear chat history:", error);
        return new Response("Error clearing history", { status: 500 });
    }
}
