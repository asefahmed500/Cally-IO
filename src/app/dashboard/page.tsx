import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, BrainCircuit } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Intellecta, {user.name}!</h1>
        <p className="text-muted-foreground">
          Your intelligent knowledge base assistant.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <BookOpenCheck className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Build Your Knowledge Base</CardTitle>
                </div>
                <CardDescription>
                    Start by uploading your company documents. Intellecta will process them to create a searchable knowledge base, ready to answer questions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Link href="/knowledge" passHref>
                    <Button>
                        Go to Knowledge Base
                    </Button>
                </Link>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <BrainCircuit className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>AI Assistant</CardTitle>
                </div>
                <CardDescription>
                    Once your documents are processed, you can interact with your AI assistant to get instant, accurate answers based on your knowledge base. (Coming Soon)
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Button disabled>
                    Chat with AI Assistant
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
