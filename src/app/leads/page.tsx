import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { LeadsTable } from "@/components/leads/leads-table";
import type { Models } from "node-appwrite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table } from "lucide-react";

export interface Lead extends Models.Document {
    userId: string;
    name: string;
    email: string;
    status: 'New' | 'Qualified' | 'Contacted' | 'Converted';
    score: number;
    lastActivity: string;
}

async function getLeads(): Promise<Lead[]> {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;

    if (!dbId || !leadsCollectionId) {
        // Return empty array if not configured, page will show an alert.
        return [];
    }

    try {
        const response = await databases.listDocuments(
            dbId,
            leadsCollectionId,
            [Query.orderDesc('$createdAt'), Query.limit(100)]
        );
        return response.documents as Lead[];
    } catch (e) {
        console.error("Failed to fetch leads:", e);
        // This might happen if the collection doesn't exist yet.
        return [];
    }
}


export default async function LeadsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels.includes('admin')) {
    redirect("/dashboard");
  }

  const isConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;
  const leads = await getLeads();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
        <p className="text-muted-foreground">View, manage, and track all leads generated from conversations.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>A list of all users who have interacted with your AI assistant.</CardDescription>
        </CardHeader>
        <CardContent>
            {!isConfigured ? (
                <Alert variant="destructive">
                    <Table className="h-4 w-4" />
                    <AlertTitle>Leads Collection Not Configured</AlertTitle>
                    <AlertDescription>
                        Please set the `NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID` environment variable and configure the collection in your Appwrite project to see your leads.
                    </AlertDescription>
                </Alert>
            ) : (
                <LeadsTable leads={leads} />
            )}
        </CardContent>
      </Card>
    </div>
  )
}
