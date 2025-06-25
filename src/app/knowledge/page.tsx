import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import type { Models } from "node-appwrite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpen, Database, FileQuestion, MessageSquarePlus } from "lucide-react";
import { DocumentList } from "@/components/knowledge/document-list";
import { FaqManager } from "@/components/knowledge/faq-manager";
import { getFaqs, type Faq } from "./actions";

export interface KnowledgeDocument extends Models.Document {
    documentId: string;
    fileName: string;
    userId: string;
}

async function getKnowledgeDocuments(user: Models.User<Models.Preferences>): Promise<KnowledgeDocument[]> {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;
    const isAdmin = user.labels.includes('admin');

    if (!dbId || !collectionId) {
        return [];
    }
    
    const queries = isAdmin ? [Query.limit(5000)] : [Query.equal('userId', user.$id), Query.limit(5000)];

    try {
        const response = await databases.listDocuments(dbId, collectionId, queries);
        
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
    if (!user) {
        redirect("/login");
    }

    const isAdmin = user.labels.includes('admin');
    const isEmbeddingsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID;
    const isFaqsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_FAQS_COLLECTION_ID;

    const [documents, faqs] = await Promise.all([
        getKnowledgeDocuments(user),
        isAdmin ? getFaqs() : Promise.resolve([] as Faq[])
    ]);

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">{isAdmin ? 'Advanced Knowledge Management' : 'My Documents'}</h1>
                <p className="text-muted-foreground">{isAdmin ? "Oversee, manage, and analyze your AI's knowledge base." : "Manage the documents you've uploaded to the AI."}</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen /> {isAdmin ? "All Documents" : "My Uploaded Documents"}</CardTitle>
                    <CardDescription>{isAdmin ? "A list of all documents uploaded by users across the platform." : "A list of all documents you have uploaded."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {!isEmbeddingsConfigured ? (
                        <Alert variant="destructive">
                            <Database className="h-4 w-4" />
                            <AlertTitle>Embeddings Collection Not Configured</AlertTitle>
                            <AlertDescription>
                                Please set the `NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID` environment variable to manage documents.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <DocumentList documents={documents} isAdmin={isAdmin} />
                    )}
                </CardContent>
            </Card>
            
            {isAdmin && (
                <div className="grid gap-8 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquarePlus /> FAQ Management</CardTitle>
                            <CardDescription>Create and manage a library of frequently asked questions for the AI to use.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {!isFaqsConfigured ? (
                                <Alert variant="destructive">
                                    <Database className="h-4 w-4" />
                                    <AlertTitle>FAQs Collection Not Configured</AlertTitle>
                                    <AlertDescription>
                                        Please set the `NEXT_PUBLIC_APPWRITE_FAQS_COLLECTION_ID` environment variable to manage FAQs.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <FaqManager initialFaqs={faqs} />
                            )}
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
            )}
        </div>
    )
}

    