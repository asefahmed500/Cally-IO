import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/assistant/chat-panel";
import { listDocuments } from "../knowledge-base/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText } from "lucide-react";

export default async function AssistantPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const documents = await listDocuments();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4">
       <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions and get answers from your knowledge base.
        </p>
      </header>

      {documents.length > 0 ? (
         <ChatPanel />
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center pt-6">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-xl font-medium text-gray-900">No documents uploaded</h3>
            <p className="mt-1 text-sm text-gray-500">You need to upload some documents to your knowledge base first.</p>
            <div className="mt-6">
              <Link href="/knowledge-base">
                 <Button>
                    Go to Knowledge Base
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
