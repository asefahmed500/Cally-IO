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

export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Cally-IO configuration and integrations.</p>
      </header>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Agent</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
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
              <CardTitle>AI Agent Configuration</CardTitle>
              <CardDescription>Customize the behavior of your AI assistant and script generator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="aiModel">AI Model</Label>
                <Select defaultValue="gemini-pro">
                  <SelectTrigger id="aiModel" className="w-[280px]">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                    <SelectItem value="gpt-4">GPT-4 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3 Opus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label>Enable Web Search</Label>
                    <p className="text-sm text-muted-foreground">
                        Allow the AI to search the web for up-to-date information.
                    </p>
                </div>
                <Switch defaultChecked />
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
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect Cally-IO to your favorite tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <h3 className="font-medium">Calling</h3>
                    <div className="space-y-2">
                        <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                        <Input id="twilio-sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="twilio-token">Twilio Auth Token</Label>
                        <Input id="twilio-token" type="password" placeholder="••••••••••••••••••••" />
                    </div>
                </div>
                <Separator />
                 <div className="space-y-4">
                    <h3 className="font-medium">CRM</h3>
                    <div className="space-y-2">
                        <Label htmlFor="hubspot-key">HubSpot API Key</Label>
                        <Input id="hubspot-key" type="password" placeholder="••••••••••••••••••••" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="salesforce-key">Salesforce API Key</Label>
                        <Input id="salesforce-key" type="password" placeholder="••••••••••••••••••••" />
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
