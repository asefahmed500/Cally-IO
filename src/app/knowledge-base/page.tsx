import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUploader } from "@/components/knowledge-base/file-uploader";
import { DocumentList } from "@/components/knowledge-base/document-list";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default async function KnowledgeBasePage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload and manage documents to build your custom knowledge base for the AI.
        </p>
      </header>
      
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload TXT files to be processed and added to the knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploader />
            </CardContent>
          </Card>
        </section>

        <section>
           <Card>
            <CardHeader>
              <CardTitle>Uploaded Files</CardTitle>
              <CardDescription>
                These files have been uploaded to your knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                    <DocumentList />
                </Suspense>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
