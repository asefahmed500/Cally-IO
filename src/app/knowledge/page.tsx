import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DocumentUploader } from "@/components/knowledge/document-uploader";
import { DocumentList } from "@/components/knowledge/document-list";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default async function KnowledgePage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground">
            Manage your company's documents here. Upload files to make them searchable.
            </p>
        </div>
        <DocumentUploader userId={user.$id} />
      </header>

      <Suspense fallback={<DocumentListSkeleton />}>
        <DocumentList userId={user.$id} />
      </Suspense>

    </div>
  );
}

function DocumentListSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
        </div>
    )
}
