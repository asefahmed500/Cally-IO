import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/assistant/chat-panel";

export default async function AssistantPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
             <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
            <p className="text-muted-foreground">
                Ask questions about your documents. The AI will use your knowledge base to find answers.
            </p>
        </header>
        <ChatPanel />
    </div>
  );
}
