import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Database, Clock } from "lucide-react";
import { getAISettings, type AISettings } from "@/lib/settings";

function isWithinBusinessHours(settings: AISettings): boolean {
    if (!settings.businessHoursEnabled) {
        return true;
    }
    try {
        const now = new Date();
        // Use Intl.DateTimeFormat to get the current time in the target timezone
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: settings.businessHoursTimezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const currentTime = timeFormatter.format(now); // e.g., "14:30"
        
        // This is a simple string comparison. It works for same-day hours (e.g., 09:00-17:00).
        // It does not handle overnight shifts (e.g., 22:00-05:00).
        return currentTime >= settings.businessHoursStart && currentTime <= settings.businessHoursEnd;
    } catch (e) {
        console.error("Error parsing business hours, defaulting to active:", e);
        // If timezone is invalid or another error occurs, default to being available.
        return true;
    }
}

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const isGoogleConfigured = !!process.env.GOOGLE_API_KEY;
  const isAppwriteConfigured =
    !!process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID &&
    !!process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID &&
    !!process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;

  const settings = await getAISettings();
  const isChatActive = isWithinBusinessHours(settings);
  
  return (
    <div className="flex flex-col h-full gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name.split(' ')[0]}!</h1>
        <p className="text-muted-foreground">
          How can I help you today? Ask a question or upload a document to get started.
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
      {!isAppwriteConfigured && (
        <Alert variant="destructive">
          <Database className="h-4 w-4" />
          <AlertTitle>Appwrite Database Not Configured</AlertTitle>
          <AlertDescription>
            Please set the Appwrite database, storage, and collection IDs in your environment variables to enable document processing and chat.
          </AlertDescription>
        </Alert>
      )}
       {!isChatActive && (
         <Alert variant="default" className="bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" />
            <AlertTitle>Outside Business Hours</AlertTitle>
            <AlertDescription>
              {settings.awayMessage}
            </AlertDescription>
          </Alert>
       )}

      <ChatPanel 
        user={user} 
        disabled={!isGoogleConfigured || !isAppwriteConfigured} 
        isChatActive={isChatActive}
      />
    </div>
  );
}
