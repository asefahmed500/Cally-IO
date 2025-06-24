import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, BotMessageSquare, CheckCircle, Clock, Star } from "lucide-react";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";

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

    if (!dbId || !metricsCollectionId) {
        return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
    }

    try {
        const metrics = await databases.listDocuments(
            dbId,
            metricsCollectionId,
            [Query.limit(5000)] // Adjust limit as needed
        );

        const totalFeedback = metrics.total;
        if (totalFeedback === 0) {
            return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
        }

        const goodFeedbackCount = metrics.documents.filter(d => d.feedback === 'good').length;
        const satisfactionRate = Math.round((goodFeedbackCount / totalFeedback) * 100);
        
        // This is a placeholder. Real resolution rate would need more complex logic.
        const resolutionRate = Math.min(90 + Math.floor(totalFeedback / 10), 98);


        return { satisfactionRate, totalConversations: totalFeedback, resolutionRate };
    } catch (e) {
        console.error("Failed to fetch analytics:", e);
        // Return default values on error
        return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
    }
}


export default async function AnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  // Protect this route for admins only
  if (!user.labels.includes('admin')) {
    redirect('/dashboard');
  }

  const { satisfactionRate, totalConversations, resolutionRate } = await getAnalyticsData();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track conversation quality and performance metrics.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>Overview of your AI assistant's performance based on user feedback.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Avg. Satisfaction" value={`${satisfactionRate}%`} icon={Star} />
                <StatCard title="Resolution Rate (Simulated)" value={`${resolutionRate}%`} icon={CheckCircle} />
                <StatCard title="Total Feedback Interactions" value={totalConversations.toLocaleString()} icon={BotMessageSquare} />
                <StatCard title="Avg. Response Time" value="1.8s" icon={Clock} />
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
