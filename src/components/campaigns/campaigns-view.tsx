'use client'

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Trash2, Play, Pause, Square, Target, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { setCampaignStatus, deleteCampaign, type CampaignDto } from '@/app/campaigns/actions';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RUNNING: 'default',
  PAUSED: 'secondary',
  DRAFT: 'outline',
  COMPLETED: 'secondary',
  STOPPED: 'outline',
};

export function CampaignsView({
  campaigns,
  canManage,
}: {
  campaigns: CampaignDto[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = React.useState<CampaignDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStatus = (campaignId: string, status: string) => {
    startTransition(async () => {
      const result = await setCampaignStatus(campaignId, status as any);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteCampaign(deleteTarget.$id);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setDeleteTarget(null);
    });
  };

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center bg-secondary">
            <Target className="size-6" />
          </span>
          <div>
            <p className="text-base font-medium">No campaigns yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Campaigns dial a contact list through your active AI agent — within calling windows,
              with retries and automatic opt-out filtering.
            </p>
          </div>
          {canManage && (
            <Button asChild variant="brand" className="mt-2">
              <Link href="/campaigns/new">
                <Plus />
                Create campaign
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="brand">
            <Link href="/campaigns/new">
              <Plus />
              Create campaign
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <Card key={campaign.$id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant={STATUS_VARIANT[campaign.status] ?? 'outline'}>{campaign.status}</Badge>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isPending}>
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Campaign actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {campaign.status !== 'RUNNING' && (
                        <DropdownMenuItem onSelect={() => handleStatus(campaign.$id, 'RUNNING')}>
                          <Play className="size-4" /> Start
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'RUNNING' && (
                        <DropdownMenuItem onSelect={() => handleStatus(campaign.$id, 'PAUSED')}>
                          <Pause className="size-4" /> Pause
                        </DropdownMenuItem>
                      )}
                      {campaign.status !== 'STOPPED' && campaign.status !== 'COMPLETED' && (
                        <DropdownMenuItem onSelect={() => handleStatus(campaign.$id, 'STOPPED')}>
                          <Square className="size-4" /> Stop
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/campaigns/${campaign.$id}`}>
                          <ExternalLink className="size-4" /> Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteTarget(campaign)}>
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CardTitle className="text-base">
                <Link href={`/campaigns/${campaign.$id}`} className="hover:underline">
                  {campaign.name}
                </Link>
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {campaign.objective || 'No objective set'}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Total', value: campaign.totals.total },
                  { label: 'Calling', value: campaign.totals.calling },
                  { label: 'Done', value: campaign.totals.completed },
                  { label: 'Failed', value: campaign.totals.failed },
                ].map((stat) => (
                  <div key={stat.label} className="border p-2">
                    <p className="text-lg font-semibold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{campaign.callingWindow} {campaign.timezone}</span>
                <span>≤{campaign.maxAttempts} attempts</span>
                <span>{campaign.concurrency} concurrent</span>
                {campaign.aiAgentName && <span>Agent: {campaign.aiAgentName}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.name}</span> and its audience list will
              be permanently removed. Call history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={isPending}>
              {isPending && <Pause className="size-4 animate-spin" />}
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
