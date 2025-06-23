import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Newspaper, List, Flame, UserCheck, PlusCircle } from "lucide-react"
import { AnalyticsChart } from "@/components/dashboard/analytics-chart"
import Link from "next/link"
import { format } from "date-fns"

const recentBriefings = [
  { date: new Date(), topics: "Tech, AI, Startups", status: "Read" },
  { date: new Date(Date.now() - 86400000), topics: "Finance, World News", status: "Read" },
  { date: new Date(Date.now() - 172800000), topics: "Sports, Entertainment", status: "Skipped" },
  { date: new Date(Date.now() - 259200000), topics: "Science, Health", status: "Read" },
];

export default async function DashboardPage() {
   const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Your Daily Briefing</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}!</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Stories Today</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 Stories</div>
            <p className="text-xs text-muted-foreground">In your latest briefing</p>
            <Link href="/chat" passHref>
              <Button size="sm" className="mt-4 w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Read Now
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15 Sources</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
            <Link href="/knowledge-base" passHref>
              <Button size="sm" variant="outline" className="mt-4 w-full">
                Manage Sources
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reading Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7 Days</div>
            <p className="text-xs text-muted-foreground">Keep the momentum going!</p>
            <Button size="sm" variant="outline" className="mt-4 w-full" disabled>
              View Progress
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Personalization</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Enabled</div>
            <p className="text-xs text-muted-foreground">Based on your interests</p>
            <Link href="/settings" passHref>
              <Button size="sm" variant="outline" className="mt-4 w-full">
                Configure
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
           <Card>
              <CardHeader>
                <CardTitle>Trending Topics</CardTitle>
                <CardDescription>Topic frequency in your briefings over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart />
              </CardContent>
            </Card>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Briefings</CardTitle>
            <CardDescription>A log of your recently generated news summaries.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBriefings.map((briefing) => (
                  <TableRow key={briefing.date.toString()}>
                    <TableCell className="font-medium">{format(briefing.date, "MMM d, yyyy")}</TableCell>
                    <TableCell>{briefing.topics}</TableCell>
                    <TableCell>
                       <Badge variant={briefing.status === "Read" ? "default" : "secondary"}>
                        {briefing.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
