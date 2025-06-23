import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, TrendingUp, Cog, PlusCircle, PenSquare } from "lucide-react"
import { AnalyticsChart } from "@/components/dashboard/analytics-chart"
import Link from "next/link"

const leads = [
  { name: "Project Alpha", status: "On Track", confidence: "92%", stage: "Q2 Analysis" },
  { name: "Market Research", status: "Completed", confidence: "100%", stage: "Q1 Report" },
  { name: "New Feature Launch", status: "At Risk", confidence: "65%", stage: "User Feedback" },
  { name: "Competitor Analysis", status: "On Track", confidence: "95%", stage: "Data Gathering" },
  { name: "Sales Funnel", status: "Completed", confidence: "88%", stage: "Q1 Optimization" },
];

export default async function DashboardPage() {
   const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}!</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128 Docs</div>
            <p className="text-xs text-muted-foreground">+12 since last month</p>
            <Link href="/knowledge-base" passHref>
              <Button size="sm" className="mt-4 w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Manage
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Analysis Studio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15 Analyses</div>
            <p className="text-xs text-muted-foreground">+3 this week</p>
            <Link href="/chat" passHref>
              <Button size="sm" variant="outline" className="mt-4 w-full">
                Start Analyzing
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">in your team</p>
            <Button size="sm" variant="outline" className="mt-4 w-full">
              Manage Team
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
            <Cog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 Active</div>
            <p className="text-xs text-muted-foreground">Integrations</p>
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
          <AnalyticsChart />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>A list of recently performed analyses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.name}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                       <Badge variant={lead.status === "Completed" ? "default" : lead.status === "At Risk" ? "destructive" : "secondary"}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.stage}</TableCell>
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
