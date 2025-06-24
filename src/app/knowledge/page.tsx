import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import type { Models } from "node-appwrite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpen, Database, Search, MessageSquarePlus, FileQuestion } from "lucide-react";
import { DocumentList } from "@/components/knowledge/document-list";
import { FaqManager } from "@/components/knowledge/faq-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface KnowledgeDocument extends Models.Document {
    documentId: string;
    fileName: string;
    userId: string;
}

async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;

    if (!dbId || !collectionId) {
        return [];
    }

    try {
        const response = await databases.listDocuments(dbId, collectionId, [Query.limit(5000)]);
        
        // Use a Map to get unique documents by documentId
        const uniqueDocsMap = new Map<string, KnowledgeDocument>();
        response.documents.forEach(doc => {
            if (!uniqueDocsMap.has(doc.documentId)) {
                uniqueDocsMap.set(doc.documentId, doc as KnowledgeDocument);
            }
        });

        return Array.from(uniqueDocsMap.values());
    } catch (e) {
        console.error("Failed to fetch knowledge documents:", e);
        return [];
    }
}

export default async function KnowledgePage() {
    const user = await getLoggedInUser();
    if (!user || !user.labels.includes('admin')) {
        redirect("/dashboard");
    }

    const isConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;
    const documents = await getKnowledgeDocuments();

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Advanced Knowledge Management</h1>
                <p className="text-muted-foreground">Oversee, manage, and analyze your AI's knowledge base.</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen /> All Documents</CardTitle>
                    <CardDescription>A list of all documents uploaded by users across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!isConfigured ? (
                        <Alert variant="destructive">
                            <Database className="h-4 w-4" />
                            <AlertTitle>Embeddings Collection Not Configured</AlertTitle>
                            <AlertDescription>
                                Please set the `NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID` environment variable to manage documents.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <DocumentList documents={documents} />
                    )}
                </CardContent>
            </Card>
            
            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquarePlus /> FAQ Management</CardTitle>
                        <CardDescription>Create and manage a library of frequently asked questions for the AI to use.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FaqManager />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileQuestion /> Content Suggestions</CardTitle>
                        <CardDescription>Get AI-powered suggestions for new knowledge base content based on unanswered questions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 text-center border-2 border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">This feature is coming soon.</p>
                            <p className="text-xs text-muted-foreground mt-1">The AI will analyze user queries to suggest new articles and FAQs.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
