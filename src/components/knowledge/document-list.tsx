import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Trash2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DocumentMetadata } from "@/lib/types";

interface DocumentListProps {
  userId: string;
}

export async function DocumentList({ userId }: DocumentListProps) {
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const collectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID!;

  if (!databaseId || !collectionId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Configuration Error</AlertTitle>
        <AlertDescription>
          Appwrite database is not configured. Please set the required environment variables.
        </AlertDescription>
      </Alert>
    );
  }

  const response = await databases.listDocuments(databaseId, collectionId, [
    Query.equal("userId", userId),
    Query.limit(100), // Adjust as needed
  ]);

  const documents = response.documents as DocumentMetadata[];
  
  // Group chunks by documentId to display each document once
  const uniqueDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.documentId]) {
      acc[doc.documentId] = {
        documentId: doc.documentId,
        fileName: doc.fileName,
        createdAt: doc.$createdAt,
        chunkCount: 0
      };
    }
    acc[doc.documentId].chunkCount++;
    return acc;
  }, {} as Record<string, { documentId: string; fileName: string; createdAt: string; chunkCount: number }>);
  
  const documentArray = Object.values(uniqueDocuments);

  if (documentArray.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No documents uploaded yet.</p>
        <p className="text-sm text-muted-foreground">Use the "Upload Document" button to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documentArray.map((doc) => (
        <Card key={doc.documentId}>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle className="text-lg">{doc.fileName}</CardTitle>
                        <CardDescription>
                            Uploaded on {new Date(doc.createdAt).toLocaleDateString()}
                        </CardDescription>
                    </div>
                </div>
                 {/* <Button variant="ghost" size="icon" disabled>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button> */}
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Processed into {doc.chunkCount} searchable chunks.
                </p>
            </CardContent>
        </Card>
      ))}
    </div>
  );
}
