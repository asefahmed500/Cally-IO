'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCampaign } from '@/app/campaigns/actions';

type AudienceEntry = {
  id: string;
  name: string;
  phone: string;
  company: string;
  consentStatus: string;
};

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function CampaignForm({
  agents,
  audience,
  timezones,
}: {
  agents: { id: string; name: string }[];
  audience: AudienceEntry[];
  timezones: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [days, setDays] = React.useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const filtered = audience.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || a.company.toLowerCase().includes(q) || a.phone.includes(q);
  });

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (day: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const payload = {
        name: formData.get('name'),
        objective: formData.get('objective') || undefined,
        aiAgentId: formData.get('aiAgentId') || undefined,
        contactIds: Array.from(selected),
        scheduleStart: formData.get('scheduleStart') || undefined,
        scheduleEnd: formData.get('scheduleEnd') || undefined,
        timezone: formData.get('timezone'),
        callingDays: Array.from(days),
        callingWindowStart: formData.get('callingWindowStart'),
        callingWindowEnd: formData.get('callingWindowEnd'),
        maxAttempts: parseInt(formData.get('maxAttempts') as string, 10) || 3,
        retryDelayMinutes: parseInt(formData.get('retryDelayMinutes') as string, 10) || 60,
        concurrency: parseInt(formData.get('concurrency') as string, 10) || 2,
      };

      const result = await createCampaign(payload);
      if (result.status === 'success' && result.campaignId) {
        toast({ title: 'Success', description: result.message });
        router.push(`/campaigns/${result.campaignId}`);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const agentWarning = agents.length === 0;

  return (
    <form action={handleSubmit} className="grid gap-4 lg:grid-cols-3">
      {/* Left column: basics + rules */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="cp-name">Campaign name *</Label>
              <Input id="cp-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. Q3 demo outreach" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="cp-objective">Objective</Label>
              <Input id="cp-objective" name="objective" placeholder="Book demos for the new release" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="cp-agent">AI agent</Label>
              {agentWarning ? (
                <AlertBox text="No ACTIVE agent found. Activate an agent in AI Agents first — campaigns dial through it." />
              ) : (
                <Select name="aiAgentId" defaultValue={agents[0]?.id}>
                  <SelectTrigger id="cp-agent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calling rules</CardTitle>
            <CardDescription>
              Calls are placed only within the window, on the selected days, in this timezone.
              Opted-out and denied-consent contacts are always excluded.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-tz">Timezone</Label>
              <Select name="timezone" defaultValue="UTC">
                <SelectTrigger id="cp-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Calling days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`border px-3 py-1.5 text-xs font-medium transition-colors ${
                      days.has(day.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-start">Window start</Label>
              <Input id="cp-start" name="callingWindowStart" type="time" defaultValue="09:00" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-end">Window end</Label>
              <Input id="cp-end" name="callingWindowEnd" type="time" defaultValue="17:00" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-sched-start">Schedule start (optional)</Label>
              <Input id="cp-sched-start" name="scheduleStart" type="datetime-local" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-sched-end">Schedule end (optional)</Label>
              <Input id="cp-sched-end" name="scheduleEnd" type="datetime-local" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-attempts">Max attempts per contact</Label>
              <Input id="cp-attempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={3} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-retry">Retry delay (minutes)</Label>
              <Input id="cp-retry" name="retryDelayMinutes" type="number" min={5} max={1440} defaultValue={60} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-conc">Concurrent calls</Label>
              <Input id="cp-conc" name="concurrency" type="number" min={1} max={10} defaultValue={2} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: audience */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Audience ({selected.size} selected)</CardTitle>
          <CardDescription>Contacts with phone numbers and valid consent.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter audience..." className="pl-9" />
          </div>
          <div className="max-h-[420px] min-h-48 flex-1 overflow-y-auto border">
            {filtered.length > 0 ? (
              filtered.map((contact) => {
                const has = selected.has(contact.id);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggleContact(contact.id)}
                    className={`flex w-full items-center justify-between border-b p-3 text-left text-sm last:border-b-0 hover:bg-accent ${has ? 'bg-accent' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{contact.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {contact.phone} {contact.company ? `· ${contact.company}` : ''}
                      </span>
                    </span>
                    {has ? (
                      <Badge>
                        <Check className="size-3" /> Selected
                      </Badge>
                    ) : (
                      <Checkbox checked={false} tabIndex={-1} className="pointer-events-none" />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No eligible contacts. Contacts need a phone number and must not be opted out.
              </p>
            )}
          </div>

          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending || selected.size === 0} className="mt-auto">
            {isPending && <Loader2 className="animate-spin" />}
            Create Campaign ({selected.size} contacts)
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function AlertBox({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      {text}
    </p>
  );
}
