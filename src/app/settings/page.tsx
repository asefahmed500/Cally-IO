import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, MessageSquare, Star, Users, Cog, UserPlus, Link as LinkIcon, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAISettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/settings-form";
import { AnalyticsChart } from "@/components/settings/analytics-chart";
import { listUsers } from "./users_actions";
import { UserManagement } from "@/components/settings/user-management";
import { UsageStatistics } from "@/components/settings/usage-statistics";

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

  const [
    { satisfactionRate, totalLeads, conversionRate, totalConversations, feedbackChartData },
    aiSettings,
    allUsers,
  ] = await Promise.all([
    getAnalyticsData(),
    getAISettings(),
    listUsers().catch(() => []), // Add catch in case of error, e.g., on first setup
  ]);
  
  const isSettingsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID;
  const isTwilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_PHONE_NUMBER;
  const isWebhookConfigured = !!process.env.WEBHOOK_URL_NEW_LEAD;
  const isAnalyticsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_ANALYTICS_LOGS_COLLECTION_ID;
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
                {isAnalyticsConfigured ? (
                    <UsageStatistics />
                ) : (
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2"><AlertTriangle /> Analytics Not Configured</CardTitle>
                            <CardDescription>Please configure the analytics collection to see usage statistics.</CardDescription>
                        </CardHeader>
                         <CardContent>
                            <Alert variant="destructive">
                                <AlertTitle>Analytics Logs Collection Not Set</AlertTitle>
                                <AlertDescription>
                                    Please set the `NEXT_PUBLIC_APPWRITE_ANALYTICS_LOGS_COLLECTION_ID` environment variable to enable document usage statistics.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus /> User Management</CardTitle>
            <CardDescription>Add, remove, and manage user roles and access for your organization.</CardDescription>
        </CardHeader>
        <CardContent>
            <UserManagement initialUsers={allUsers} currentUserId={user.$id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon /> Integration Hub</CardTitle>
            <CardDescription>Connect Cally-IO to your other business tools. See documentation for setup instructions.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                    <h4 className="font-semibold flex items-center gap-2"><LinkIcon size={16} /> New Lead Webhook</h4>
                     {isWebhookConfigured ? (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Active</p>
                    ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1"><XCircle className="h-3 w-3" /> Inactive: Set WEBHOOK_URL_NEW_LEAD</p>
                    )}
                </div>
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
        <SettingsForm settings={aiSettings} timezones={timezones} isTwilioConfigured={isTwilioConfigured} />
      )}
    </div>
  )
}
