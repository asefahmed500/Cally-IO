'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, ChevronLeft, Check, Bot, Smile, AudioLines, BookOpen, Wrench, PhoneCall, FlaskConical, Rocket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAgent } from '@/app/agents/actions';
import type { AgentConfig } from '@/app/agents/agent-config';

const STEPS = [
  { id: 'identity', title: 'Identity', icon: Bot, description: 'Name and role of your agent.' },
  { id: 'personality', title: 'Personality', icon: Smile, description: 'Tone, style, and greeting.' },
  { id: 'voice', title: 'Voice', icon: AudioLines, description: 'Voice selection and speed.' },
  { id: 'knowledge', title: 'Knowledge', icon: BookOpen, description: 'Bind documents and FAQs.' },
  { id: 'capabilities', title: 'Capabilities', icon: Wrench, description: 'What the agent may do.' },
  { id: 'callConfig', title: 'Call Setup', icon: PhoneCall, description: 'Direction, limits, recording.' },
  { id: 'testing', title: 'Testing', icon: FlaskConical, description: 'Validate before publishing.' },
  { id: 'publish', title: 'Publish', icon: Rocket, description: 'Save and go live.' },
] as const;

const DEFAULT_CONFIG: AgentConfig = {
  identity: { name: '', description: '', purpose: '', department: '', language: 'en-US' },
  personality: {
    tone: 'Professional and friendly',
    style: 'Conversational but efficient',
    speakingSpeed: 'normal',
    greeting: 'Hello! How can I help you today?',
    conversationRules: '',
    escalationBehavior: 'Politely offer to transfer to a human colleague.',
  },
  voice: { provider: 'GEMINI_TTS', voiceName: 'Algenib', speechRate: 1 },
  knowledge: { sourceIds: [], useWorkspaceFaqs: true },
  capabilities: {
    answerFaqs: true,
    qualifyLeads: true,
    captureContactDetails: true,
    scheduleAppointments: false,
    createCrmRecords: true,
    createFollowUpTasks: false,
    transferToHuman: true,
    triggerWorkflows: false,
  },
  callConfig: {
    direction: 'OUTBOUND',
    maxDurationMinutes: 10,
    recordCalls: true,
    disclosureEnabled: true,
    transferDestination: '',
  },
};

type SwitchKey = keyof AgentConfig['capabilities'];

export function AgentWizard({
  knowledgeSources,
  agentId,
  initialConfig,
}: {
  knowledgeSources: { id: string; name: string; type: string; status: string }[];
  agentId?: string;
  initialConfig?: AgentConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState(0);
  const [config, setConfig] = React.useState<AgentConfig>(initialConfig ?? DEFAULT_CONFIG);
  const [isPending, startTransition] = React.useTransition();
  const [isPreviewPending, startPreviewTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const validateStep = (s: number): string | null => {
    if (STEPS[s].id === 'identity' && config.identity.name.trim().length < 2) {
      return 'Agent name must be at least 2 characters.';
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = (activate: boolean) => {
    setError(null);
    startTransition(async () => {
      if (agentId) {
        // Editing an existing agent → create a new version.
        const { updateAgentConfig, setAgentStatus } = await import('@/app/agents/actions');
        const result = await updateAgentConfig(agentId, config, 'Edited via builder');
        if (result.status !== 'success') {
          setError(result.message);
          return;
        }
        if (activate) {
          const activation = await setAgentStatus(agentId, 'ACTIVE');
          if (activation.status !== 'success') {
            toast({ title: 'Saved', description: activation.message });
          }
        }
        toast({ title: 'Success', description: result.message });
        router.push(`/agents/${agentId}`);
        router.refresh();
        return;
      }

      const result = await createAgent(null, { config });
      if (result.status !== 'success' || !result.agentId) {
        setError(result.message);
        return;
      }
      if (activate) {
        const { setAgentStatus } = await import('@/app/agents/actions');
        const activation = await setAgentStatus(result.agentId, 'ACTIVE');
        if (activation.status !== 'success') {
          toast({
            title: 'Agent saved as draft',
            description: activation.message,
          });
        }
      }
      toast({ title: 'Success', description: result.message });
      router.push(`/agents/${result.agentId}`);
      router.refresh();
    });
  };

  const toggleCapability = (key: SwitchKey) =>
    set('capabilities', { ...config.capabilities, [key]: !config.capabilities[key] });

  const toggleSource = (sourceId: string) => {
    const has = config.knowledge.sourceIds.includes(sourceId);
    set('knowledge', {
      ...config.knowledge,
      sourceIds: has
        ? config.knowledge.sourceIds.filter((id) => id !== sourceId)
        : [...config.knowledge.sourceIds, sourceId],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-colors ${
                i === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : i < step
                    ? 'border-border bg-secondary text-secondary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {i < step ? <Check className="size-3" /> : <s.icon className="size-3" />}
              {s.title}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {React.createElement(STEPS[step].icon, { className: 'size-5' })}
            {step + 1}. {STEPS[step].title}
          </CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* STEP 1 — Identity */}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-name">Agent name *</Label>
                <Input
                  id="ag-name"
                  value={config.identity.name}
                  onChange={(e) => set('identity', { ...config.identity, name: e.target.value })}
                  placeholder="e.g. Aria — Sales Assistant"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-dept">Department</Label>
                <Input
                  id="ag-dept"
                  value={config.identity.department}
                  onChange={(e) => set('identity', { ...config.identity, department: e.target.value })}
                  placeholder="Sales, Support..."
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ag-desc">Description</Label>
                <Input
                  id="ag-desc"
                  value={config.identity.description}
                  onChange={(e) => set('identity', { ...config.identity, description: e.target.value })}
                  placeholder="What this agent does in one sentence"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ag-purpose">Business purpose / instructions</Label>
                <Input
                  id="ag-purpose"
                  value={config.identity.purpose}
                  onChange={(e) => set('identity', { ...config.identity, purpose: e.target.value })}
                  placeholder="Book demos, answer pricing questions, capture contact details..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-lang">Language</Label>
                <Select
                  value={config.identity.language}
                  onValueChange={(v) => set('identity', { ...config.identity, language: v })}
                >
                  <SelectTrigger id="ag-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="hi-IN">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* STEP 2 — Personality */}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-tone">Tone</Label>
                <Input
                  id="ag-tone"
                  value={config.personality.tone}
                  onChange={(e) => set('personality', { ...config.personality, tone: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-style">Communication style</Label>
                <Input
                  id="ag-style"
                  value={config.personality.style}
                  onChange={(e) => set('personality', { ...config.personality, style: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-speed">Speaking speed</Label>
                <Select
                  value={config.personality.speakingSpeed}
                  onValueChange={(v) => set('personality', { ...config.personality, speakingSpeed: v as any })}
                >
                  <SelectTrigger id="ag-speed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ag-greeting">Greeting</Label>
                <Input
                  id="ag-greeting"
                  value={config.personality.greeting}
                  onChange={(e) => set('personality', { ...config.personality, greeting: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ag-rules">Conversation rules</Label>
                <Input
                  id="ag-rules"
                  value={config.personality.conversationRules ?? ''}
                  onChange={(e) => set('personality', { ...config.personality, conversationRules: e.target.value })}
                  placeholder="Never discuss competitor pricing. Keep answers under 3 sentences..."
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ag-escalation">Escalation behavior</Label>
                <Input
                  id="ag-escalation"
                  value={config.personality.escalationBehavior}
                  onChange={(e) => set('personality', { ...config.personality, escalationBehavior: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — Voice */}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-voice-provider">Voice provider</Label>
                <Select
                  value={config.voice.provider}
                  onValueChange={(v) => set('voice', { ...config.voice, provider: v as any })}
                >
                  <SelectTrigger id="ag-voice-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GEMINI_TTS">Gemini TTS (free tier)</SelectItem>
                    <SelectItem value="TWILIO">Twilio voices</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Gemini voices are used for previews; live calls speak with Twilio voices.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-voice-name">Voice</Label>
                <Select
                  value={config.voice.voiceName}
                  onValueChange={(v) => set('voice', { ...config.voice, voiceName: v })}
                >
                  <SelectTrigger id="ag-voice-name">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Algenib">Algenib (female)</SelectItem>
                    <SelectItem value="Achernar">Achernar (male)</SelectItem>
                    <SelectItem value="Sadachbia">Sadachbia (male)</SelectItem>
                    <SelectItem value="Sadaltager">Sadaltager (male)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-rate">Speech rate: {config.voice.speechRate}x</Label>
                <input
                  id="ag-rate"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={config.voice.speechRate}
                  onChange={(e) => set('voice', { ...config.voice, speechRate: parseFloat(e.target.value) })}
                  className="accent-primary"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Preview greeting</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPreviewPending}
                    onClick={() =>
                      startPreviewTransition(async () => {
                        const { previewAgentVoice } = await import('@/app/agents/actions');
                        const result = await previewAgentVoice(
                          config.voice.voiceName,
                          config.personality.greeting
                        );
                        if (result.error || !result.audioDataUri) {
                          toast({
                            variant: 'destructive',
                            title: 'Preview failed',
                            description: result.error ?? 'Could not generate audio.',
                          });
                          return;
                        }
                        const audio = new Audio(result.audioDataUri);
                        audio.play().catch(() => {
                          toast({
                            variant: 'destructive',
                            title: 'Playback blocked',
                            description: 'Your browser blocked autoplay — try again.',
                          });
                        });
                      })
                    }
                  >
                    {isPreviewPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <AudioLines />
                    )}
                    Play Preview
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Uses Gemini TTS (free tier) with the greeting text.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Knowledge */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border p-4">
                <div>
                  <Label htmlFor="ag-faqs">Use workspace FAQs</Label>
                  <p className="text-xs text-muted-foreground">
                    FAQs managed in the Knowledge Base are the agent&apos;s primary source.
                  </p>
                </div>
                <Switch
                  id="ag-faqs"
                  checked={config.knowledge.useWorkspaceFaqs}
                  onCheckedChange={(checked) => set('knowledge', { ...config.knowledge, useWorkspaceFaqs: checked })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Bind knowledge sources ({config.knowledge.sourceIds.length} selected)</Label>
                {knowledgeSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No READY sources yet. Upload documents in the Knowledge Base, then edit this
                    agent to bind them.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border">
                    {knowledgeSources.map((source) => {
                      const has = config.knowledge.sourceIds.includes(source.id);
                      return (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => toggleSource(source.id)}
                          className={`flex w-full items-center justify-between border-b p-3 text-left text-sm last:border-b-0 hover:bg-accent ${
                            has ? 'bg-accent' : ''
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="size-4 text-muted-foreground" />
                            {source.name}
                          </span>
                          {has ? (
                            <Badge>
                              <Check className="size-3" /> Bound
                            </Badge>
                          ) : (
                            <Badge variant="outline">{source.type}</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Retrieval is tenant-scoped and citations are returned with answers.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5 — Capabilities */}
          {step === 4 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(config.capabilities) as SwitchKey[]).map((key) => (
                <div key={key} className="flex items-center justify-between border p-4">
                  <div>
                    <Label htmlFor={`cap-${key}`}>
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (c) => c.toUpperCase())
                        .trim()}
                    </Label>
                  </div>
                  <Switch
                    id={`cap-${key}`}
                    checked={config.capabilities[key]}
                    onCheckedChange={() => toggleCapability(key)}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Capabilities gate which tools the agent may use at runtime — every tool execution is
                logged.
              </p>
            </div>
          )}

          {/* STEP 6 — Call configuration */}
          {step === 5 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-direction">Call direction</Label>
                <Select
                  value={config.callConfig.direction}
                  onValueChange={(v) => set('callConfig', { ...config.callConfig, direction: v as any })}
                >
                  <SelectTrigger id="ag-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTBOUND">Outbound only</SelectItem>
                    <SelectItem value="INBOUND">Inbound only</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-maxdur">Max call duration: {config.callConfig.maxDurationMinutes} min</Label>
                <input
                  id="ag-maxdur"
                  type="range"
                  min={1}
                  max={60}
                  value={config.callConfig.maxDurationMinutes}
                  onChange={(e) =>
                    set('callConfig', { ...config.callConfig, maxDurationMinutes: parseInt(e.target.value, 10) })
                  }
                  className="accent-primary"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ag-transfer">Transfer destination (phone)</Label>
                <Input
                  id="ag-transfer"
                  value={config.callConfig.transferDestination ?? ''}
                  onChange={(e) => set('callConfig', { ...config.callConfig, transferDestination: e.target.value })}
                  placeholder="+15551234567"
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ag-record">Record calls</Label>
                  <Switch
                    id="ag-record"
                    checked={config.callConfig.recordCalls}
                    onCheckedChange={(checked) => set('callConfig', { ...config.callConfig, recordCalls: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ag-disclosure">AI disclosure</Label>
                    <p className="text-xs text-muted-foreground">Announce that the caller is speaking to an AI.</p>
                  </div>
                  <Switch
                    id="ag-disclosure"
                    checked={config.callConfig.disclosureEnabled}
                    onCheckedChange={(checked) =>
                      set('callConfig', { ...config.callConfig, disclosureEnabled: checked })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7 — Testing */}
          {step === 6 && (
            <div className="flex flex-col gap-4">
              <div className="border p-4">
                <p className="text-sm font-medium">Knowledge accuracy check</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {config.knowledge.sourceIds.length > 0 || config.knowledge.useWorkspaceFaqs
                    ? `The agent will retrieve from ${config.knowledge.sourceIds.length} bound source(s)${config.knowledge.useWorkspaceFaqs ? ' plus workspace FAQs' : ''}.`
                    : 'Warning: no knowledge bound — the agent will only answer from its instructions and may escalate often.'}
                </p>
              </div>
              <div className="border p-4">
                <p className="text-sm font-medium">Tool execution check</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Object.entries(config.capabilities)
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => key)
                    .length}{' '}
                  capabilities enabled — each tool call is validated and logged at runtime.
                </p>
              </div>
              <div className="border p-4">
                <p className="text-sm font-medium">Escalation check</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {config.capabilities.transferToHuman
                    ? 'Transfers are enabled — unmatched questions hand off to a human.'
                    : 'Transfers are disabled — the agent will end the call politely when unsure.'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Full text and voice simulation opens on the agent page right after saving.
              </p>
            </div>
          )}

          {/* STEP 8 — Publish */}
          {step === 7 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 text-sm">
                {[
                  ['Name', config.identity.name || '—'],
                  ['Department', config.identity.department || '—'],
                  ['Language', config.identity.language],
                  ['Voice', `${config.voice.voiceName} (${config.voice.provider})`],
                  ['Knowledge', `${config.knowledge.sourceIds.length} source(s), FAQs ${config.knowledge.useWorkspaceFaqs ? 'on' : 'off'}`],
                  ['Capabilities', `${Object.values(config.capabilities).filter(Boolean).length} of 8 enabled`],
                  ['Calls', `${config.callConfig.direction}, max ${config.callConfig.maxDurationMinutes} min`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => submit(false)} disabled={isPending} className="flex-1">
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Save as Draft
                </Button>
                <Button onClick={() => submit(true)} disabled={isPending} className="flex-1">
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Save & Activate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Activation requires at least one bound knowledge source or FAQs enabled.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0 || isPending}
            >
              <ChevronLeft />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
