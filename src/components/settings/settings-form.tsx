'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type AISettings } from '@/lib/settings';
import { updateAISettings } from '@/app/settings/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrainCircuit, Clock, TestTube2, AlertCircle, Phone, Link as LinkIcon, Webhook, Sheet as SheetIcon, FileText } from 'lucide-react';
import { Loader2 } from 'lucide-react';

function SubmitButton({ isPending }: { isPending: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || isPending} className="w-full sm:w-auto">
      {(pending || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Save All Settings
    </Button>
  );
}

export function SettingsForm({ settings, timezones }: { settings: AISettings, timezones: string[] }) {
    const { toast } = useToast();
    const [state, formAction, isPending] = useActionState(updateAISettings, null);

    React.useEffect(() => {
        if (state?.success) {
            toast({
                title: 'Success!',
                description: state.message || "Your settings have been saved.",
                variant: 'default',
            });
        } else if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast]);

    return (
        <form action={formAction} className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="h-6 w-6" />
                        <CardTitle>AI Agent Configuration</CardTitle>
                    </div>
                    <CardDescription>Define how your AI assistant should think, talk, and behave.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ai-personality">AI Personality</Label>
                            <Select name="ai_personality" defaultValue={settings.personality}>
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
                            <Select name="ai_style" defaultValue={settings.style}>
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
                            defaultValue={settings.instructions}
                        />
                    </div>
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
                        <FileText className="h-6 w-6" />
                        <CardTitle>Call Script Builder</CardTitle>
                    </div>
                  <CardDescription>Create a template for the AI to generate personalized call scripts. Use Handlebars placeholders like `{{leadName}}`, `{{leadStatus}}`, and `{{leadScore}}`.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea 
                        name="call_script_template"
                        defaultValue={settings.scriptTemplate}
                        className="min-h-48 font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                        This template will be used by the AI to generate scripts on the Leads page. The AI is instructed to adapt the opener and value proposition based on the lead's status and score.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-6 w-6" />
                        <CardTitle>Business Hours</CardTitle>
                    </div>
                    <CardDescription>Define when the AI assistant is active. Outside these hours, the chat will be disabled and show an away message.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-2">
                        <Switch id="business-hours-enabled" name="business_hours_enabled" defaultChecked={settings.businessHoursEnabled} />
                        <Label htmlFor="business-hours-enabled">Enable Business Hours</Label>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="business-hours-start">Start Time</Label>
                            <Input id="business-hours-start" name="business_hours_start" type="time" defaultValue={settings.businessHoursStart} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="business-hours-end">End Time</Label>
                            <Input id="business-hours-end" name="business_hours_end" type="time" defaultValue={settings.businessHoursEnd} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="business-hours-timezone">Timezone</Label>
                            <Select name="business_hours_timezone" defaultValue={settings.businessHoursTimezone}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="away-message">Away Message</Label>
                        <Textarea id="away-message" name="away_message" placeholder="We are currently away. Please leave a message..." className="min-h-24" defaultValue={settings.awayMessage} />
                        <p className="text-xs text-muted-foreground">This message will be shown to users who visit outside of business hours.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <LinkIcon className="h-6 w-6" />
                        <CardTitle>CRM &amp; Integrations</CardTitle>
                    </div>
                <CardDescription>Connect Cally-IO to your other business tools to automate your workflows.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                <Webhook className="h-5 h-5" />
                                <h4 className="font-semibold">Slack Notifications</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">Get notified in a Slack channel when a new lead signs up.</p>
                            <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                            <Input id="slack-webhook" placeholder="https://hooks.slack.com/services/..." />
                            <Button disabled>Save Slack Webhook</Button>
                            <p className="text-xs text-muted-foreground pt-1">Note: Integration logic is not yet implemented. This is a UI placeholder.</p>
                        </div>

                        <div className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                <SheetIcon className="h-5 w-5" />
                                <h4 className="font-semibold">Google Sheets Sync</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">Automatically export new lead data to a Google Sheet in real-time.</p>
                            <Button disabled className="w-full">Connect to Google Sheets</Button>
                            <p className="text-xs text-muted-foreground pt-1">Note: OAuth flow for Google Sheets is a placeholder and not yet functional.</p>
                        </div>
                    </div>
                    <div className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                                <Webhook className="h-5 w-5" />
                                <h4 className="font-semibold">Generic Webhooks</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">Send new lead data to any system that accepts webhooks (e.g., Zapier, Make).</p>
                            <Label htmlFor="generic-webhook">Webhook URL</Label>
                            <Input id="generic-webhook" placeholder="https://yourapi.com/webhook" />
                            <Button disabled>Save Webhook</Button>
                            <p className="text-xs text-muted-foreground pt-1">Note: Integration logic is not yet implemented. This is a UI placeholder.</p>
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
                    {!process.env.NEXT_PUBLIC_TWILIO_CONFIGURED && (
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
                        <Input id="twilio-sid" placeholder={process.env.NEXT_PUBLIC_TWILIO_CONFIGURED ? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "Not configured"} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="twilio-token">Auth Token</Label>
                        <Input id="twilio-token" type="password" value={process.env.NEXT_PUBLIC_TWILIO_CONFIGURED ? "••••••••••••••••••••••••••••" : ""} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                        <Input id="twilio-phone" placeholder={process.env.NEXT_PUBLIC_TWILIO_CONFIGURED ? "+15551234567" : "Not configured"} readOnly disabled />
                    </div>
                </CardContent>
                 <CardFooter className="bg-muted/50 border-t px-6 py-3 flex justify-end">
                    <SubmitButton isPending={isPending} />
                </CardFooter>
            </Card>
        </form>
    );
}
