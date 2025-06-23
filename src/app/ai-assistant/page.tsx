import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "./chat-panel";
import type { Models } from 'appwrite';

export default async function AIAssistantPage() {
  const user = await getLoggedInUser() as Models.User<Models.Preferences> | null;
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
        <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
            <p className="text-muted-foreground">
                Ask questions about the documents in your knowledge base.
            </p>
        </header>
        <ChatPanel user={user} />
    </div>
  );
}
