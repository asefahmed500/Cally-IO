import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from './chat-panel';

export default async function ChatPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AI Interaction Hub</h1>
        <p className="text-muted-foreground">Engage with the AI Assistant or generate sales scripts.</p>
      </header>
      <ChatPanel />
    </div>
  );
}
