
import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, CheckCircle, Clock, Star, Users, Cog, FileText } from "lucide-react";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAISettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function StatCard({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

async function getAnalyticsData() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const metricsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID;
    const leadsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_LEADS_COLLECTION_ID;

    // Default values
    let satisfactionRate = 0;
    let totalConversations = 0;
    let resolutionRate = 0;
    let totalLeads = 0;
    let conversionRate = 0;

    // Fetch metrics data
    if (dbId && metricsCollectionId) {
        try {
            const metrics = await databases.listDocuments(dbId, metricsCollectionId, [Query.limit(5000)]);
            const totalFeedback = metrics.total;
            if (totalFeedback > 0) {
                const goodFeedbackCount = metrics.documents.filter(d => d.feedback === 'good').length;
                satisfactionRate = Math.round((goodFeedbackCount / totalFeedback) * 100);
                resolutionRate = Math.min(90 + Math.floor(totalFeedback / 10), 98); // Simulated
                totalConversations = totalFeedback;
            }
        } catch (e) {
            console.error("Failed to fetch analytics:", e);
        }
    }

    // Fetch leads data
    if (dbId && leadsCollectionId) {
        try {
            const leads = await databases.listDocuments(dbId, leadsCollectionId, [Query.limit(5000)]);
            totalLeads = leads.total;
            if (totalLeads > 0) {
                const convertedCount = leads.documents.filter(d => d.status === 'Converted').length;
                conversionRate = Math.round((convertedCount / totalLeads) * 100);
            }
        } catch(e) {
            console.error("Failed to fetch leads analytics:", e);
        }
    }

    return { satisfactionRate, totalConversations, resolutionRate, totalLeads, conversionRate };
}


export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  // Protect this route for admins only
  if (!user.labels.includes('admin')) {
    redirect('/dashboard');
  }

  const { satisfactionRate, totalConversations, resolutionRate, totalLeads, conversionRate } = await getAnalyticsData();
  const aiSettings = await getAISettings();
  const isSettingsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID;
  const timezones = Intl.supportedValuesOf('timeZone');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
        <p className="text-muted-foreground">Manage integrations, AI behavior, and track system performance.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>Overview of your AI assistant's performance based on user feedback and lead status.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Avg. Satisfaction" value={`${satisfactionRate}%`} icon={Star} />
                <StatCard title="Total Leads" value={totalLeads.toLocaleString()} icon={Users} />
                <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={BarChart2} />
                <StatCard title="Total Feedback" value={totalConversations.toLocaleString()} icon={Users} />
                <StatCard title="Resolution Rate (Simulated)" value={`${resolutionRate}%`} icon={CheckCircle} />
                <StatCard title="Avg. Response Time (Simulated)" value="1.8s" icon={Clock} />
            </div>
        </CardContent>
      </Card>

      {!isSettingsConfigured ? (
         <Alert variant="destructive">
            <Cog className="h-4 w-4" />
            <AlertTitle>Settings Collection Not Configured</AlertTitle>
            <AlertDescription>
                Please set the `NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID` environment variable and configure the collection to manage AI and business settings.
            </AlertDescription>
        </Alert>
      ) : (
        <SettingsForm settings={aiSettings} timezones={timezones} />
      )}

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                <CardTitle>Call Script Builder</CardTitle>
            </div>
          <CardDescription>Create a template for the AI to generate personalized call scripts. Use placeholders like `{{leadName}}`, `{{leadStatus}}`, and `{{leadScore}}`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Textarea 
                placeholder="Hi {{leadName}}, this is [Your Name] from Cally-IO..." 
                className="min-h-48"
            />
            <Button disabled>Save Template</Button>
            <p className="text-sm text-muted-foreground">Note: Template saving is not yet implemented. The default template will be used for now.</p>
        </CardContent>
      </Card>
    </div>
  )
}
