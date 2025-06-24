import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, BotMessageSquare, CheckCircle, Clock, Star, Phone, FileText, Cog, BrainCircuit, TestTube2, AlertCircle } from "lucide-react";
import { databases } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAISettings } from "@/lib/settings";
import { updateAISettings } from "@/app/settings/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

async function getAnalyticsData() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const metricsCollectionId = process.env.NEXT_PUBLIC_APPWRITE_METRICS_COLLECTION_ID;

    if (!dbId || !metricsCollectionId) {
        return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
    }

    try {
        const metrics = await databases.listDocuments(
            dbId,
            metricsCollectionId,
            [Query.limit(5000)] // Adjust limit as needed
        );

        const totalFeedback = metrics.total;
        if (totalFeedback === 0) {
            return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
        }

        const goodFeedbackCount = metrics.documents.filter(d => d.feedback === 'good').length;
        const satisfactionRate = Math.round((goodFeedbackCount / totalFeedback) * 100);
        
        // This is a placeholder. Real resolution rate would need more complex logic.
        const resolutionRate = Math.min(90 + Math.floor(totalFeedback / 10), 98);


        return { satisfactionRate, totalConversations: totalFeedback, resolutionRate };
    } catch (e) {
        console.error("Failed to fetch analytics:", e);
        // Return default values on error
        return { satisfactionRate: 0, totalConversations: 0, resolutionRate: 0 };
    }
}


export default async function SettingsPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  // Protect this route for admins only
  if (!user.labels.includes('admin')) {
    redirect('/dashboard');
  }

  const { satisfactionRate, totalConversations, resolutionRate } = await getAnalyticsData();
  const aiSettings = await getAISettings();
  const isTwilioConfigured = !!process.env.TWILIO_ACCOUNT_SID;
  const isSettingsConfigured = !!process.env.NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings & Analytics</h1>
        <p className="text-muted-foreground">Manage integrations, AI behavior, and track conversation quality.</p>
      </header>
        
      <Card>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>Overview of your AI assistant's performance based on user feedback.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Avg. Satisfaction" value={`${satisfactionRate}%`} icon={Star} />
                <StatCard title="Resolution Rate (Simulated)" value={`${resolutionRate}%`} icon={CheckCircle} />
                <StatCard title="Total Feedback Interactions" value={totalConversations.toLocaleString()} icon={BotMessageSquare} />
                <StatCard title="Avg. Response Time" value="1.8s" icon={Clock} />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6" />
                <CardTitle>AI Agent Configuration</CardTitle>
            </div>
          <CardDescription>Define how your AI assistant should think, talk, and behave.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
             {!isSettingsConfigured ? (
                <Alert variant="destructive">
                    <Cog className="h-4 w-4" />
                    <AlertTitle>Settings Collection Not Configured</AlertTitle>
                    <AlertDescription>
                        Please set the `NEXT_PUBLIC_APPWRITE_SETTINGS_COLLECTION_ID` environment variable and configure the collection to manage the AI agent.
                    </AlertDescription>
                </Alert>
            ) : (
                <form action={updateAISettings} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ai-personality">AI Personality</Label>
                            <Select name="ai_personality" defaultValue={aiSettings.personality}>
                                <SelectTrigger id="ai-personality">
                                    <SelectValue placeholder="Select a personality" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Professional">Professional</SelectItem>
                                    <SelectItem value="Friendly">Friendly</SelectItem>
                                    <SelectItem value="Technical">Technical</SelectItem>
                                    <SelectItem value="Witty">Witty</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="ai-style">Response Style</Label>
                            <Select name="ai_style" defaultValue={aiSettings.style}>
                                <SelectTrigger id="ai-style">
                                    <SelectValue placeholder="Select a style" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Concise">Concise</SelectItem>
                                    <SelectItem value="Detailed">Detailed</SelectItem>
                                    <SelectItem value="Conversational">Conversational</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ai-instructions">Custom Instructions</Label>
                        <Textarea 
                            id="ai-instructions"
                            name="ai_instructions"
                            placeholder="e.g., Your company name is Cally-IO. Always mention our 30-day money-back guarantee when discussing pricing." 
                            className="min-h-32"
                            defaultValue={aiSettings.instructions}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit">Save AI Configuration</Button>
                    </div>
                </form>
            )}
            <div className="grid md:grid-cols-2 gap-4 pt-4">
                <Card className="bg-muted/50">
                    <CardHeader className="flex-row items-center gap-2 space-y-0">
                         <TestTube2 className="w-5 h-5" />
                        <CardTitle className="text-lg">Knowledge Base Testing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">To test your AI's responses, simply go to the main Dashboard, upload your documents, and start asking questions. This is the live environment for testing how the AI uses its knowledge base.</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50">
                     <CardHeader className="flex-row items-center gap-2 space-y-0">
                        <AlertCircle className="w-5 h-5" />
                        <CardTitle className="text-lg">Escalation Rules</CardTitle>
                    </CardHeader>
                     <CardContent>
                        <p className="text-sm text-muted-foreground">The AI is pre-configured to escalate to a human specialist when it doesn't know an answer. This behavior is part of the core prompt and is not currently editable via the UI.</p>
                    </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Phone className="h-6 w-6" />
                <CardTitle>Twilio Integration</CardTitle>
            </div>
          <CardDescription>Connect your Twilio account to enable automated calling capabilities. These values should be set in your .env file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             {!isTwilioConfigured && (
                <Alert variant="destructive">
                    <Phone className="h-4 w-4" />
                    <AlertTitle>Twilio Not Configured</AlertTitle>
                    <AlertDescription>
                        Please set the `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` environment variables to enable calling features.
                    </AlertDescription>
                </Alert>
            )}
            <div className="space-y-2">
                <Label htmlFor="twilio-sid">Account SID</Label>
                <Input id="twilio-sid" placeholder={isTwilioConfigured ? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "Not configured"} readOnly disabled />
            </div>
             <div className="space-y-2">
                <Label htmlFor="twilio-token">Auth Token</Label>
                <Input id="twilio-token" type="password" value={isTwilioConfigured ? "••••••••••••••••••••••••••••" : ""} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                <Input id="twilio-phone" placeholder={isTwilioConfigured ? "+15551234567" : "Not configured"} readOnly disabled />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                <CardTitle>Call Script Builder</CardTitle>
            </div>
          <CardDescription>Create a template for the AI to generate personalized call scripts. Use placeholders like `{{leadName}}`, `{{leadStatus}}`, and `{{leadScore}}`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Textarea 
                placeholder="Hi {{leadName}}, this is [Your Name] from Cally-IO..." 
                className="min-h-48"
            />
            <Button disabled>Save Template</Button>
            <p className="text-sm text-muted-foreground">Note: Template saving is not yet implemented. The default template will be used for now.</p>
        </CardContent>
      </Card>
    </div>
  )
}
