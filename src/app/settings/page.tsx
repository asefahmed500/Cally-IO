import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Waypoints } from "lucide-react";

export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and learning preferences.</p>
      </header>

      <Tabs defaultValue="account" className="w-full">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="ai">Learning Companion</TabsTrigger>
          <TabsTrigger value="integrations">Subject Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" placeholder="Your Name" defaultValue={user.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="your@email.com" defaultValue={user.email} disabled />
              </div>
            </CardContent>
            <CardFooter>
                <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Companion Configuration</CardTitle>
              <CardDescription>Customize the behavior of your AI Learning Companion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="learningStyle">Preferred Learning Style</Label>
                <Select defaultValue="visual">
                  <SelectTrigger id="learningStyle" className="w-[280px]">
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visual">Visual (diagrams, charts)</SelectItem>
                    <SelectItem value="auditory">Auditory (discussions, analogies)</SelectItem>
                    <SelectItem value="kinesthetic">Kinesthetic (practical examples)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label>Proactive Suggestions</Label>
                    <p className="text-sm text-muted-foreground">
                        Allow the AI to suggest new topics based on your history.
                    </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
            <CardFooter>
                <Button>Save AI Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Subject Integrations</CardTitle>
              <CardDescription>Connect to external knowledge sources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Waypoints className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-medium">Khan Academy</h3>
                    </div>
                    <div className="space-y-2">
                         <Button variant="outline">Connect Khan Academy</Button>
                    </div>
                </div>
                <Separator />
                 <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18h1"></path><path d="M15 18h1"></path><path d="M9 18h1"></path><path d="M12.5 15h-1v-2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5z"></path></svg>
                      <h3 className="font-medium">Google Scholar</h3>
                    </div>
                    <div className="space-y-2">
                        <Label>Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                            Connect your Google Account to authorize access.
                        </p>
                         <Button variant="outline">Connect Google Account</Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button>Save Integrations</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
