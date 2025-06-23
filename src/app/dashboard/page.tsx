import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { KeyRound } from "lucide-react";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const isGoogleConfigured = !!process.env.GOOGLE_API_KEY;

  return (
    <div className="flex flex-col h-full gap-4">
       <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask me anything.
        </p>
      </header>
       {!isGoogleConfigured && (
         <Alert variant="destructive">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Google AI Not Configured</AlertTitle>
            <AlertDescription>
              Please set the `GOOGLE_API_KEY` environment variable to enable the AI assistant.
            </AlertDescription>
          </Alert>
      )}
      <ChatPanel />
    </div>
  )
}
