import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, GraduationCap, Cog, PlusCircle } from "lucide-react"
import { AnalyticsChart } from "@/components/dashboard/analytics-chart"
import Link from "next/link"

const recentTopics = [
  { name: "Quantum Physics", status: "In Progress", progress: "75%", category: "Science" },
  { name: "Roman History", status: "Completed", progress: "100%", category: "History" },
  { name: "Neural Networks", status: "Struggling", progress: "25%", category: "Tech" },
  { name: "Spanish Verbs", status: "In Progress", progress: "90%", category: "Language" },
  { name: "Music Theory", status: "Completed", progress: "100%", category: "Arts" },
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
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12 Subjects</div>
            <p className="text-xs text-muted-foreground">+2 since last month</p>
            <Link href="/knowledge-base" passHref>
              <Button size="sm" className="mt-4 w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Manage
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Learning Studio</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 Active</div>
            <p className="text-xs text-muted-foreground">Learning sessions</p>
            <Link href="/chat" passHref>
              <Button size="sm" variant="outline" className="mt-4 w-full">
                Start Learning
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14 Days</div>
            <p className="text-xs text-muted-foreground">Keep up the great work!</p>
            <Button size="sm" variant="outline" className="mt-4 w-full" disabled>
              View Progress
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Learning Preferences</CardTitle>
            <Cog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Default</div>
            <p className="text-xs text-muted-foreground">Learning style</p>
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
            <CardTitle>Recent Topics</CardTitle>
            <CardDescription>A list of topics you've recently studied.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTopics.map((topic) => (
                  <TableRow key={topic.name}>
                    <TableCell className="font-medium">{topic.name}</TableCell>
                    <TableCell>
                       <Badge variant={topic.status === "Completed" ? "default" : topic.status === "Struggling" ? "destructive" : "secondary"}>
                        {topic.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{topic.category}</TableCell>
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
