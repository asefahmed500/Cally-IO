
import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Database, Clock, Users, BarChart2, Star, AlertTriangle } from "lucide-react";
import { getAISettings, type AISettings } from "@/lib/settings";
import { getLeads } from "@/app/leads/actions";
import type { Lead } from "@/app/leads/types";
import type { Models } from "appwrite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function isWithinBusinessHours(settings: AISettings): boolean {
    if (!settings.businessHoursEnabled) {
        return true;
    }
    try {
        const now = new Date();
        // Use Intl.DateTimeFormat to get the current time in the target timezone
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: settings.businessHoursTimezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const currentTime = timeFormatter.format(now); // e.g., "14:30"
        
        // This is a simple string comparison. It works for same-day hours (e.g., 09:00-17:00).
        // It does not handle overnight shifts (e.g., 22:00-05:00).
        return currentTime >= settings.businessHoursStart && currentTime <= settings.businessHoursEnd;
    } catch (e) {
        console.error("Error parsing business hours, defaulting to active:", e);
        // If timezone is invalid or another error occurs, default to being available.
        return true;
    }
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) {
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

function getAgentStats(leads: Lead[]) {
    if (!Array.isArray(leads)) return { totalLeads: 0, conversionRate: 0, averageScore: 0 };
    const totalLeads = leads.length;
    const convertedCount = leads.filter(l => l.status === 'Converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;
    const averageScore = totalLeads > 0 ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / totalLeads) : 0;
    
    return {
        totalLeads,
        conversionRate,
        averageScore
    }
}

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const isGoogleConfigured = !!process.env.GOOGLE_API_KEY;
  const isAppwriteConfigured =
    !!process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID &&
    !!process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID &&
    !!process.env.NEXT_PUBLIC_APPWRITE_EMBEDDINGS_COLLECTION_ID &&
    !!process.env.NEXT_PUBLIC_APPWRITE_CONVERSATIONS_COLLECTION_ID;

  const [settings, leadsResult] = await Promise.all([
    getAISettings(),
    getLeads(user)
  ]);

  // Safely extract leads and errors to prevent crashes
  const allVisibleLeads = leadsResult?.leads || [];
  const leadsError = leadsResult?.error || null;

  const isChatActive = isWithinBusinessHours(settings);
  
  // This line is now safe because allVisibleLeads is guaranteed to be an array.
  const agentLeadsForStats = allVisibleLeads.filter(lead => lead.agentId === user.$id);
  const agentStats = getAgentStats(agentLeadsForStats);

  return (
    <div className="flex flex-col h-full gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name.split(' ')[0]}!</h1>
        <p className="text-muted-foreground">
            How can I help you today? Ask a question, manage your leads, or upload a document to get started.
        </p>
      </header>

      {/* Agent-specific stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Your Assigned Leads" value={agentStats.totalLeads} icon={Users} />
        <StatCard title="Your Conversion Rate" value={`${agentStats.conversionRate}%`} icon={BarChart2} />
        <StatCard title="Avg. Lead Score" value={agentStats.averageScore} icon={Star} />
      </div>

      {leadsError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could Not Load Agent Statistics</AlertTitle>
            <AlertDescription>
              {leadsError}
            </AlertDescription>
          </Alert>
      )}

      {!isGoogleConfigured && (
        <Alert variant="destructive">
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Google AI Not Configured</AlertTitle>
          <AlertDescription>
            Please set the `GOOGLE_API_KEY` environment variable to enable the AI assistant.
          </AlertDescription>
        </Alert>
      )}
      {!isAppwriteConfigured && (
        <Alert variant="destructive">
          <Database className="h-4 w-4" />
          <AlertTitle>Appwrite Collections Not Configured</AlertTitle>
          <AlertDescription>
            Please set all required Appwrite database, storage, and collection IDs in your environment variables to enable all features. See documentation for details.
          </AlertDescription>
        </Alert>
      )}
       {!isChatActive && (
         <Alert variant="default" className="bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" />
            <AlertTitle>Outside Business Hours</AlertTitle>
            <AlertDescription>
              {settings.awayMessage}
            </AlertDescription>
          </Alert>
       )}
      
      {/* This flex wrapper is the key fix. It grows to fill remaining space and allows ChatPanel to use h-full. */}
      <div className="flex-1 min-h-0">
        <ChatPanel 
          user={user} 
          disabled={!isGoogleConfigured || !isAppwriteConfigured} 
          isChatActive={isChatActive}
        />
      </div>
    </div>
  );
}
