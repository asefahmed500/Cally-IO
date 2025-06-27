import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { LeadsKanbanView } from "@/components/leads/leads-kanban-view";
import type { Models } from "node-appwrite";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table } from "lucide-react";

export interface Lead extends Models.Document {
    userId: string | null; // Can be null for manually created leads
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    notes?: string;
    status: 'New' | 'Qualified' | 'Called' | 'Converted';
    score: number;
    lastActivity: string;
    agentId: string | null; // The agent who owns this lead
}

export async function getLeads(user: Models.User<Models.Preferences>): Promise<Lead[]> {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;
    const isAdmin = user.labels.includes('admin');

    if (!dbId || !leadsCollectionId) {
        // Return empty array if not configured, page will show an alert.
        return [];
    }

    try {
        const queries = isAdmin 
            ? [Query.orderDesc('$createdAt'), Query.limit(500)]
            // If not admin, fetch leads created by this user (agent)
            : [Query.equal('agentId', user.$id), Query.orderDesc('$createdAt'), Query.limit(500)];

        const response = await databases.listDocuments(
            dbId,
            leadsCollectionId,
            queries
        );
        // Include leads from signups that are unassigned (agentId is null)
        if (!isAdmin) {
            const unassignedLeads = await databases.listDocuments(
                dbId,
                leadsCollectionId,
                [Query.isNull('agentId'), Query.orderDesc('$createdAt'), Query.limit(500)]
            );
            response.documents.push(...unassignedLeads.documents);
        }

        return response.documents as Lead[];
    } catch (e) {
        console.error("Failed to fetch leads:", e);
        // This might happen if the collection doesn't exist yet.
        return [];
    }
}


export default async function LeadsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  // The page is now accessible to all users, but data is filtered by role in getLeads
  const isConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;
  const leads = await getLeads(user);
  const isAdmin = user.labels.includes('admin');

  return (
    <div className="flex flex-col h-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? 'Lead Management Pipeline' : 'Your Lead Pipeline'}
        </h1>
        <p className="text-muted-foreground">
            {isAdmin ? 'Visualize and manage all leads through the sales funnel.' : 'Manage your assigned and created leads.'}
        </p>
      </header>
        
      {!isConfigured ? (
          <Card>
            <CardContent className="pt-6">
                <Alert variant="destructive">
                    <Table className="h-4 w-4" />
                    <AlertTitle>Leads Collection Not Configured</AlertTitle>
                    <AlertDescription>
                        Please set the `NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID` environment variable and configure the collection in your Appwrite project to see your leads.
                    </AlertDescription>
                </Alert>
            </CardContent>
          </Card>
      ) : (
          <LeadsKanbanView initialLeads={leads} currentUser={user} />
      )}
    </div>
  )
}
