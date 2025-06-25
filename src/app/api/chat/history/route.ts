import { getLoggedInUser } from "@/lib/auth";
import { getConversation } from "@/lib/conversation";
import { NextResponse } from "next/server";

export async function GET() {
    const user = await getLoggedInUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const conversation = await getConversation(user.$id);
        const history = conversation ? conversation.history : [];
        return NextResponse.json(history);
    } catch (error) {
        console.error("Failed to fetch chat history:", error);
        return new Response("Error fetching history", { status: 500 });
    }
}
