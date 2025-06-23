import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Database, FileText } from "lucide-react";

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

  return (
    <div className="flex flex-col h-full gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about your documents.
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
       {isAppwriteConfigured && (
         <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription>
             To begin, upload a document using the paperclip icon in the chat input below. You can upload PDF, DOCX, or TXT files. Once processed, you can ask the AI questions about their content.
            </AlertDescription>
          </Alert>
       )}

      <ChatPanel disabled={!isGoogleConfigured || !isAppwriteConfigured} />
    </div>
  );
}
