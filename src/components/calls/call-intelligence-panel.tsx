'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Loader2, Pencil, UserCheck, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { reviewCallSummary } from '@/app/calls/[id]/actions';

type Summary = {
  text: string;
  intent: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  outcome: string;
  qualificationScore: number;
  actionItems: string[];
  escalated: boolean;
  model: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
};

export function CallIntelligencePanel({
  callId,
  summary,
  canReview,
}: {
  callId: string;
  summary: Summary;
  canReview: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(summary.text);
  const [outcome, setOutcome] = React.useState(summary.outcome || 'CONNECTED');
  const [sentiment, setSentiment] = React.useState<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>(summary.sentiment);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await reviewCallSummary({ callId, summary: text, outcome, sentiment });
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        setEditing(false);
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Sparkles className="size-3" />
          AI-generated
        </Badge>
        {summary.model && <Badge variant="outline">{summary.model}</Badge>}
        {summary.reviewedByName ? (
          <Badge className="gap-1 bg-success text-success-foreground">
            <UserCheck className="size-3" />
            Reviewed by {summary.reviewedByName}
          </Badge>
        ) : (
          <Badge variant="secondary">Awaiting review</Badge>
        )}
        {canReview && !editing && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil />
            {summary.reviewedByName ? 'Update review' : 'Review'}
          </Button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm">{summary.text || 'No summary generated.'}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border p-3">
              <p className="text-xs text-muted-foreground">Intent</p>
              <p className="mt-0.5 text-sm font-medium">{summary.intent || '—'}</p>
            </div>
            <div className="border p-3">
              <p className="text-xs text-muted-foreground">Sentiment</p>
              <div className="mt-0.5">
                <Badge
                  variant={summary.sentiment === 'POSITIVE' ? 'default' : summary.sentiment === 'NEGATIVE' ? 'destructive' : 'secondary'}
                >
                  {summary.sentiment}
                </Badge>
              </div>
            </div>
            <div className="border p-3">
              <p className="text-xs text-muted-foreground">Qualification</p>
              <p className="mt-0.5 text-sm font-medium">{summary.qualificationScore}/100</p>
            </div>
          </div>
          {summary.actionItems.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Action items</p>
              <ul className="flex flex-col gap-1">
                {summary.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              Human-reviewed {new Date(summary.reviewedAt).toLocaleString()} — corrections override
              the AI assessment.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rv-summary">Corrected summary</Label>
            <Input id="rv-summary" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rv-outcome">Verified outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="rv-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['CONNECTED', 'VOICEMAIL', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'WRONG_NUMBER', 'DO_NOT_CALL'].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rv-sentiment">Verified sentiment</Label>
              <Select value={sentiment} onValueChange={(v) => setSentiment(v as any)}>
                <SelectTrigger id="rv-sentiment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVE">Positive</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="NEGATIVE">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Save review
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
