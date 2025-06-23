import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox";
import { Rss } from "lucide-react";

export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  const newsCategories = [
    { id: "tech", label: "Technology" },
    { id: "business", label: "Business & Finance" },
    { id: "world", label: "World News" },
    { id: "science", label: "Science & Health" },
    { id: "sports", label: "Sports" },
    { id: "entertainment", label: "Entertainment" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and briefing preferences.</p>
      </header>

      <Tabs defaultValue="account" className="w-full">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
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

        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Briefing Preferences</CardTitle>
              <CardDescription>Customize how your news briefing is generated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>News Categories</Label>
                <p className="text-sm text-muted-foreground">
                    Select the topics you're most interested in.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {newsCategories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox id={category.id} defaultChecked={["tech", "business"].includes(category.id)} />
                      <label
                        htmlFor={category.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {category.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label>Automatic Briefings</Label>
                    <p className="text-sm text-muted-foreground">
                        Generate a new briefing automatically every morning.
                    </p>
                </div>
                <Switch />
              </div>
            </CardContent>
            <CardFooter>
                <Button>Save Preferences</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>News Source Integrations</CardTitle>
              <CardDescription>Connect to external news APIs for real-time data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Rss className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-medium">NewsAPI.org</h3>
                    </div>
                     <p className="text-sm text-muted-foreground">
                        Connect your NewsAPI.org account to get real-time news from thousands of sources.
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="news-api-key">API Key</Label>
                         <Input id="news-api-key" placeholder="Enter your NewsAPI.org API Key" />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button>Save Integration</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
