import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadsKanbanView } from "@/components/leads/leads-kanban-view";
import type { Models } from "node-appwrite";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, AlertTriangle } from "lucide-react";
import { listUsers } from "../settings/users_actions";
import type { UserSummary } from "../settings/users_actions";
import { getLeads } from "./actions";


export default async function LeadsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.labels.includes('admin');
  const isConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;
  
  const [{ leads, error: leadsError }, allUsers] = await Promise.all([
    getLeads(user),
    isAdmin ? listUsers() : Promise.resolve([] as UserSummary[])
  ]);

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
      ) : leadsError ? (
           <Card>
            <CardContent className="pt-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Fetching Leads</AlertTitle>
                    <AlertDescription>
                        {leadsError}
                    </AlertDescription>
                </Alert>
            </CardContent>
          </Card>
      ) : (
          <LeadsKanbanView initialLeads={leads} currentUser={user} allUsers={allUsers} />
      )}
    </div>
  )
}
