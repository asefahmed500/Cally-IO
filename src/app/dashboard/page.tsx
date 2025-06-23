import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, BookOpen } from "lucide-react";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Intellecta</h1>
        <p className="text-muted-foreground">
          Your company's intelligent knowledge brain.
        </p>
      </header>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <CardTitle>Manage Knowledge Base</CardTitle>
              </div>
              <CardDescription>
                  Build your AI's brain by uploading your company documents.
              </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
              <p>
                  The first step is to upload your company's documents. You can upload PDFs, Word documents, or plain text files. Once uploaded, the system will automatically process and index them, making them searchable for the AI.
              </p>
              <Link href="/knowledge-base" passHref>
                  <Button>Go to Knowledge Base</Button>
              </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
              <div className="flex items-center gap-3">
                 <MessageSquare className="h-8 w-8 text-primary" />
                <CardTitle>AI Assistant</CardTitle>
              </div>
              <CardDescription>
                  Chat with your AI to get instant answers from your knowledge base.
              </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
              <p>
                  After you've uploaded documents, you can ask questions to your AI assistant. It will use the information from your knowledge base to provide accurate and contextual answers.
              </p>
              <Link href="/assistant" passHref>
                  <Button>Start Chatting</Button>
              </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
