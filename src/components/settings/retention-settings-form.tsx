'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { saveRetention, purgeNow } from '@/app/settings/retention/actions';

type Policy = {
  callRetentionDays: number;
  recordingRetentionDays: number;
  transcriptRetentionDays: number;
  auditLogRetentionDays: number;
  purgeCompletedCampaigns: boolean;
  allowRecordingDownload: boolean;
};

type Preview = {
  expiredCalls: number;
  expiredRecordings: number;
  expiredTranscripts: number;
  expiredAuditLogs: number;
  completedCampaigns: number;
} | null;

export function RetentionSettingsForm({
  initialPolicy,
  initialPreview,
}: {
  initialPolicy: Policy;
  initialPreview: Preview;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isPurging, startPurge] = useTransition();
  const [policy, setPolicy] = React.useState<Policy>(initialPolicy);
  const [preview, setPreview] = React.useState<Preview>(initialPreview);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setPolicy((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveRetention(policy);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Could not save', description: result.error });
      } else {
        setPreview(result.preview ?? null);
        toast({ title: 'Retention policy saved' });
        router.refresh();
      }
    });
  };

  const handlePurge = () => {
    startPurge(async () => {
      const result = await purgeNow();
      if (result.error) {
        toast({ variant: 'destructive', title: 'Purge failed', description: result.error });
      } else {
        setPreview(result.preview ?? null);
        toast({ title: 'Retention purge complete' });
        router.refresh();
      }
    });
  };

  const totalToRemove = preview
    ? preview.expiredCalls + preview.expiredTranscripts + preview.expiredAuditLogs
    : 0;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Retention windows</CardTitle>
          <CardDescription>Records older than these thresholds become purge-eligible.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['callRetentionDays', 'Call records', 'Call rows and linked timelines'],
              ['recordingRetentionDays', 'Recordings', 'Recording URLs are cleared from the database'],
              ['transcriptRetentionDays', 'Transcripts & summaries', 'AI transcriptions and analyses'],
              ['auditLogRetentionDays', 'Audit log', 'Compliance trail entries'],
            ] as [keyof Policy, string, string][]
          ).map(([key, label, hint]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={key === 'auditLogRetentionDays' ? 30 : 7}
                max={3650}
                value={policy[key] as number}
                onChange={(e) => set(key, Number(e.target.value) as Policy[typeof key])}
              />
              <p className="text-xs text-muted-foreground">{hint} (days)</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="purgeCompleted">Purge completed campaigns</Label>
              <p className="text-xs text-muted-foreground">
                Hard-deletes campaigns in COMPLETED status during a purge run.
              </p>
            </div>
            <Switch
              id="purgeCompleted"
              checked={policy.purgeCompletedCampaigns}
              onCheckedChange={(v) => set('purgeCompletedCampaigns', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="allowDownload">Allow recording downloads</Label>
              <p className="text-xs text-muted-foreground">
                When off, the recording player and download control are hidden for all members.
              </p>
            </div>
            <Switch
              id="allowDownload"
              checked={policy.allowRecordingDownload}
              onCheckedChange={(v) => set('allowRecordingDownload', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purge preview</CardTitle>
          <CardDescription>Exactly what a purge would affect right now — nothing is deleted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {preview ? (
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                ['Calls', preview.expiredCalls],
                ['Recordings', preview.expiredRecordings],
                ['Transcripts', preview.expiredTranscripts],
                ['Audit logs', preview.expiredAuditLogs],
                ['Campaigns', preview.completedCampaigns],
              ].map(([label, count]) => (
                <div key={label as string} className="border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{count as number}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Preview unavailable.</p>
          )}

          <Alert variant={totalToRemove > 0 ? 'destructive' : 'default'}>
            <AlertTitle>
              {totalToRemove > 0 ? 'Destructive operation' : 'Nothing to purge'}
            </AlertTitle>
            <AlertDescription>
              {totalToRemove > 0
                ? `This permanently deletes ${totalToRemove} records and cannot be undone. The purge itself is written to the audit log.`
                : 'No records currently exceed the configured windows.'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isPending}>
              Save Policy
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={isPurging || totalToRemove === 0}
            >
              Run Purge Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}