import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listDocuments } from "./actions";
import { Suspense } from "react";
import { DocumentList } from "@/components/knowledge-base/document-list";
import { FileUploader } from "@/components/knowledge-base/file-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KnowledgeBasePage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const documents = await listDocuments();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload and manage your company's documents to build your AI's knowledge.
        </p>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
                Upload PDF, DOCX, or TXT files to be processed and added to the knowledge base.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <FileUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
                These documents have been uploaded and processed.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <DocumentList initialDocuments={documents} />
            </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
