
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrainCircuit, Clock, TestTube2, AlertCircle, FileText } from 'lucide-react';
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
                 <CardFooter className="bg-muted/50 border-t px-6 py-3 flex justify-end">
                    <SubmitButton isPending={isPending} />
                </CardFooter>
            </Card>
        </form>
    );
}
