
import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, MessageSquare, Star, Users, Cog, PieChart, UserPlus, Link as LinkIcon } from "lucide-react";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAISettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/settings-form";
import { AnalyticsChart } from "@/components/settings/analytics-chart";
import { Button } from "@/components/ui/button";

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
    const conversationsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID;

    // Default values
    let satisfactionRate = 0;
    let goodFeedbackCount = 0;
    let badFeedbackCount = 0;
    let totalLeads = 0;
    let conversionRate = 0;
    let totalConversations = 0;

    // Fetch metrics data
    if (dbId && metricsCollectionId) {
        try {
            const metrics = await databases.listDocuments(dbId, metricsCollectionId, [Query.limit(5000)]);
            const totalFeedback = metrics.total;
            if (totalFeedback > 0) {
                goodFeedbackCount = metrics.documents.filter(d => d.feedback === 'good').length;
                badFeedbackCount = totalFeedback - goodFeedbackCount;
                satisfactionRate = Math.round((goodFeedbackCount / totalFeedback) * 100);
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
    
    // Fetch conversations data
    if (dbId && conversationsCollectionId) {
        try {
            // Using limit(0) is an efficient way to get only the total count
            const conversations = await databases.listDocuments(dbId, conversationsCollectionId, [Query.limit(0)]);
            totalConversations = conversations.total;
        } catch(e) {
            console.error("Failed to fetch conversations analytics:", e);
        }
    }

    const feedbackChartData = [{
        name: 'Feedback',
        good: goodFeedbackCount,
        bad: badFeedbackCount,
    }];

    return { satisfactionRate, totalLeads, conversionRate, totalConversations, feedbackChartData };
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

  const { satisfactionRate, totalLeads, conversionRate, totalConversations, feedbackChartData } = await getAnalyticsData();
  const aiSettings = await getAISettings();
  const isSettingsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID;
  const isTwilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_PHONE_NUMBER;
  const timezones = Intl.supportedValuesOf('timeZone');
  const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.replace('/v1', '');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
        <p className="text-muted-foreground">Manage integrations, AI behavior, and track system performance.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>An overview of your AI assistant's performance based on real-time user feedback and lead data.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard title="Avg. Satisfaction" value={`${satisfactionRate}%`} icon={Star} />
                <StatCard title="Total Leads" value={totalLeads.toLocaleString()} icon={Users} />
                <StatCard title="Total Conversations" value={totalConversations.toLocaleString()} icon={MessageSquare} />
                <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={BarChart2} />
            </div>
            <div className="grid gap-8 md:grid-cols-2">
                <AnalyticsChart data={feedbackChartData} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart /> Usage Statistics</CardTitle>
                        <CardDescription>Insights into how your knowledge base is being used by the AI and your team.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 text-center border-2 border-dashed rounded-lg flex flex-col items-center justify-center h-full">
                            <p className="text-sm text-muted-foreground">This feature is coming soon.</p>
                            <p className="text-xs text-muted-foreground mt-1">Analytics on document and FAQ usage will appear here to help you understand what content is most valuable.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><LinkIcon /> Integration Hub</CardTitle>
                <CardDescription>Connect Cally-IO to your other business tools. These are currently placeholders and require backend implementation.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <h4 className="font-semibold">Slack Notifications</h4>
                            <p className="text-sm text-muted-foreground">Get notified when a new lead signs up.</p>
                        </div>
                        <Button variant="outline" disabled>Configure</Button>
                    </div>
                     <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <h4 className="font-semibold">Google Sheets Sync</h4>
                            <p className="text-sm text-muted-foreground">Export new lead data to a Google Sheet.</p>
                        </div>
                        <Button variant="outline" disabled>Connect</Button>
                    </div>
                     <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <h4 className="font-semibold">Generic Webhooks</h4>
                            <p className="text-sm text-muted-foreground">Send lead data to any system (e.g., Zapier).</p>
                        </div>
                        <Button variant="outline" disabled>Add Webhook</Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus /> User Management</CardTitle>
                <CardDescription>Add or remove team members and manage roles directly in your Appwrite console.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center space-y-4 h-full">
                 <p className="text-sm text-muted-foreground">User roles and permissions are managed in your Appwrite project.</p>
                 <a href={`${appwriteEndpoint}/project-${appwriteProjectId}/auth/users`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                        Manage Users in Appwrite
                    </Button>
                 </a>
            </CardContent>
        </Card>
      </div>

      {!isSettingsConfigured ? (
         <Alert variant="destructive">
            <Cog className="h-4 w-4" />
            <AlertTitle>Settings Collection Not Configured</AlertTitle>
            <AlertDescription>
                Please set the `NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID` environment variable and configure the collection to manage AI and business settings.
            </AlertDescription>
        </Alert>
      ) : (
        <SettingsForm settings={aiSettings} timezones={timezones} isTwilioConfigured={isTwilioConfigured} />
      )}
    </div>
  )
}
