import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}! Let's get your company profile set up.</p>
      </header>
      
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>
              This information will be used to customize your experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" placeholder="e.g., Acme Inc." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="companyWebsite">Company Website</Label>
              <Input id="companyWebsite" placeholder="e.g., https://acme.com" />
            </div>
             <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="companyIndustry">Industry</Label>
              <Input id="companyIndustry" placeholder="e.g., Technology, E-commerce" />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button>Save Profile</Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
