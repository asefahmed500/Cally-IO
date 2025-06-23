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
import { Sheet, Waypoints } from "lucide-react";

export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Cally-IO configuration, data integrations, and analyst preferences.</p>
      </header>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Analyst</TabsTrigger>
          <TabsTrigger value="integrations">Data Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Update your company's information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" placeholder="Your Company Inc." defaultValue="Cally-IO" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input id="website" placeholder="https://yourcompany.com" />
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
              <CardTitle>AI Analyst Configuration</CardTitle>
              <CardDescription>Customize the behavior of your AI business analyst.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="aiModel">AI Model</Label>
                <Select defaultValue="gemini-pro">
                  <SelectTrigger id="aiModel" className="w-[280px]">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-pro">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gpt-4">GPT-4 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3 Opus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label>Context Awareness</Label>
                    <p className="text-sm text-muted-foreground">
                        Enable conversation memory for personalized interactions.
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
              <CardTitle>Data Source Integrations</CardTitle>
              <CardDescription>Connect Cally-IO to your business data platforms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Waypoints className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-medium">Airtable</h3>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="airtable-key">API Key</Label>
                        <Input id="airtable-key" type="password" placeholder="••••••••••••••••••••" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="airtable-base-id">Base ID</Label>
                        <Input id="airtable-base-id" placeholder="appxxxxxxxxxxxxxx" />
                    </div>
                </div>
                <Separator />
                 <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18h1"></path><path d="M15 18h1"></path><path d="M9 18h1"></path><path d="M12.5 15h-1v-2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5z"></path></svg>
                      <h3 className="font-medium">Google Sheets</h3>
                    </div>
                    <div className="space-y-2">
                        <Label>Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                            Connect your Google Account to authorize access to Sheets.
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
