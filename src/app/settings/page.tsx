import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, BotMessageSquare, CheckCircle, Clock, Star } from "lucide-react";

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

export default async function AnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track conversation quality and performance metrics.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>Overview of your AI assistant's performance.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Avg. Satisfaction" value="4.8 / 5.0" icon={Star} />
                <StatCard title="Resolution Rate" value="92%" icon={CheckCircle} />
                <StatCard title="Conversations" value="1,204" icon={BotMessageSquare} />
                <StatCard title="Avg. Response Time" value="1.8s" icon={Clock} />
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
