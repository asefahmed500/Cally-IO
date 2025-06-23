import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, Phone, Cog, PlusCircle } from "lucide-react"
import { AnalyticsChart } from "@/components/dashboard/analytics-chart"
import Link from "next/link"

const leads = [
  { name: "John Doe", status: "Qualified", confidence: "92%", stage: "Demo Scheduled" },
  { name: "Jane Smith", status: "Contacted", confidence: "78%", stage: "Follow-up" },
  { name: "Sam Wilson", status: "New", confidence: "65%", stage: "Discovery" },
  { name: "Alice Johnson", status: "Qualified", confidence: "95%", stage: "Negotiation" },
  { name: "Bob Brown", status: "Lost", confidence: "34%", stage: "Closed-Lost" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your Cally-IO command center.</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Knowledge Base</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128 Docs</div>
            <p className="text-xs text-muted-foreground">+12 since last month</p>
            <Button size="sm" className="mt-4 w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Manage
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">+8 this week</p>
            <Link href="/chat" passHref>
              <Button size="sm" variant="outline" className="mt-4 w-full">
                View Leads
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calls Made</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">213</div>
            <p className="text-xs text-muted-foreground">72% connection rate</p>
            <Button size="sm" variant="outline" className="mt-4 w-full">
              View Analytics
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
            <Cog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4 Active</div>
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
            <CardTitle>Recent Leads</CardTitle>
            <CardDescription>A list of recently identified leads.</CardDescription>
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
                      <Badge variant={lead.status === "Qualified" ? "default" : lead.status === "Lost" ? "destructive" : "secondary"}>
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
