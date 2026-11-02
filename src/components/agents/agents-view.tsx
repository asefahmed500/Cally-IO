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
import { Bot, Plus, MoreHorizontal, Play, Pause, Archive, Pencil, FlaskConical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { setAgentStatus, deleteAgent, type AgentDto } from '@/app/agents/actions';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DRAFT: 'outline',
  TESTING: 'secondary',
  ERROR: 'destructive',
  ARCHIVED: 'outline',
};

export function AgentsView({
  agents,
  canManage,
  canPublish,
}: {
  agents: AgentDto[];
  canManage: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = React.useState<AgentDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStatus = (agentId: string, status: string) => {
    startTransition(async () => {
      const result = await setAgentStatus(agentId, status as any);
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
      const result = await deleteAgent(deleteTarget.$id);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setDeleteTarget(null);
    });
  };

  if (agents.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center bg-secondary">
              <Bot className="size-6" />
            </span>
            <div>
              <p className="text-base font-medium">Build your first AI agent</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Agents answer calls, qualify leads, and follow up — grounded in your knowledge
                base. Create one, bind knowledge, test it, then activate.
              </p>
            </div>
            {canManage && (
              <Button asChild variant="brand" className="mt-2">
                <Link href="/agents/new">
                  <Plus />
                  Create agent
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="brand">
            <Link href="/agents/new">
              <Plus />
              Create agent
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.$id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center bg-secondary">
                  <Bot className="size-5" />
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[agent.status] ?? 'outline'}>{agent.status}</Badge>
                  {(canPublish || canManage) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Agent actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canPublish && agent.status !== 'ACTIVE' && (
                          <DropdownMenuItem onSelect={() => handleStatus(agent.$id, 'ACTIVE')}>
                            <Play className="size-4" /> Activate
                          </DropdownMenuItem>
                        )}
                        {canPublish && agent.status === 'ACTIVE' && (
                          <DropdownMenuItem onSelect={() => handleStatus(agent.$id, 'PAUSED')}>
                            <Pause className="size-4" /> Pause
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/agents/${agent.$id}/edit`}>
                                <Pencil className="size-4" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/agents/${agent.$id}`}>
                                <FlaskConical className="size-4" /> Test & Details
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleteTarget(agent)}
                            >
                              <Archive className="size-4" /> Archive
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <CardTitle className="text-base">
                <Link href={`/agents/${agent.$id}`} className="hover:underline">
                  {agent.name}
                </Link>
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {agent.description || 'No description'}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
              <span>{agent.versionCount} version{agent.versionCount === 1 ? '' : 's'}</span>
              <span>{agent.callCount} call{agent.callCount === 1 ? '' : 's'}</span>
              <span className="ml-auto">{agent.language}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive agent?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.name}</span> will be archived and no
              longer handle calls. Call history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending && <Pause className="size-4 animate-spin" />}
              Archive agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
