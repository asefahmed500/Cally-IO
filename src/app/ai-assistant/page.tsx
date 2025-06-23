import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "./chat-panel";

export default async function AIAssistantPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.20))] gap-8">
       <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Your partner in sales strategy and execution.
        </p>
      </header>
      <div className="flex-grow">
         <ChatPanel user={user} />
      </div>
    </div>
  );
}
