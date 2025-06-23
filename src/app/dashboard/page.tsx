import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      
      <Card>
        <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
                Build your company's knowledge base to power your AI assistant.
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
    </div>
  )
}
