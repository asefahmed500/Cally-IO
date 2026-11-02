'use client'

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, MoreHorizontal, Trash2, Pencil, Workflow as WorkflowIcon, Play, Pause, Zap, ArrowRight, ArrowDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import {
  saveWorkflow,
  setWorkflowStatus,
  deleteWorkflow,
  type WorkflowDto,
} from '@/app/workflows/actions';
import type { WorkflowDefinition } from '@/lib/workflows/engine';

const TRIGGERS = [
  { value: 'CALL_COMPLETED', label: 'Call completed' },
  { value: 'CALL_MISSED', label: 'Call missed' },
  { value: 'LEAD_CREATED', label: 'New lead created' },
  { value: 'FOLLOW_UP_DUE', label: 'Follow-up due' },
];

const CONDITION_FIELDS = [
  { value: 'call.outcome', label: 'Call outcome', placeholder: 'CONNECTED | NO_ANSWER | ...' },
  { value: 'call.direction', label: 'Call direction', placeholder: 'INBOUND | OUTBOUND' },
  { value: 'call.durationGtSec', label: 'Duration greater than (sec)', placeholder: '60' },
  { value: 'lead.stage', label: 'Lead stage', placeholder: 'NEW | QUALIFIED | ...' },
  { value: 'contact.hasTag', label: 'Contact has tag', placeholder: 'vip' },
];

const ACTIONS = [
  { value: 'CREATE_TASK', label: 'Create follow-up task' },
  { value: 'SCHEDULE_CALLBACK', label: 'Schedule callback (urgent)' },
  { value: 'UPDATE_LEAD_STAGE', label: 'Update lead stage' },
  { value: 'NOTIFY_TEAM', label: 'Notify managers' },
  { value: 'AI_SUMMARY', label: 'Generate AI call summary' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  PUBLISHED: 'default',
  DISABLED: 'secondary',
  DRAFT: 'outline',
};

// ── Builder dialog ──

function BuilderForm({
  workflowId,
  initial,
  onFormSuccess,
}: {
  workflowId?: string;
  initial?: WorkflowDefinition;
  onFormSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [trigger, setTrigger] = React.useState<string>(initial?.trigger.type ?? 'CALL_COMPLETED');
  const [conditions, setConditions] = React.useState<WorkflowDefinition['conditions']>(
    initial?.conditions ?? []
  );
  const [actions, setActions] = React.useState<WorkflowDefinition['actions']>(
    initial?.actions ?? [{ type: 'CREATE_TASK', params: { title: 'Follow up', dueInHours: 24 } }]
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const definition: WorkflowDefinition = {
        trigger: { type: trigger as WorkflowDefinition['trigger']['type'] },
        conditions,
        actions,
      };
      const result = await saveWorkflow({
        id: workflowId,
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        definition,
      });
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        onFormSuccess();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <form action={submit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="wf-name">Workflow name *</Label>
          <Input id="wf-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. Missed call → urgent callback" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="wf-desc">Description</Label>
          <Input id="wf-desc" name="description" placeholder="What this automation does" />
        </div>
      </div>

      {/* Trigger node */}
      <div className="flex flex-col gap-2 border p-4">
        <Label className="flex items-center gap-2">
          <Zap className="size-4" /> When this happens
        </Label>
        <Select value={trigger} onValueChange={setTrigger}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ArrowDown className="mx-auto size-4 text-muted-foreground" />

      {/* Conditions */}
      <div className="flex flex-col gap-2 border p-4">
        <Label>Only if (all conditions must match — optional)</Label>
        {conditions.map((condition, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={condition.field}
              onValueChange={(v) =>
                setConditions((prev) => prev.map((c, j) => (j === i ? { ...c, field: v as any } : c)))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={condition.value}
              onChange={(e) =>
                setConditions((prev) =>
                  prev.map((c, j) =>
                    j === i ? { ...c, value: c.field === 'call.durationGtSec' ? Number(e.target.value) || 0 : e.target.value } : c
                  )
                )
              }
              placeholder={CONDITION_FIELDS.find((f) => f.value === condition.field)?.placeholder}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConditions((prev) => [...prev, { field: 'call.outcome', value: '' }])}
        >
          <Plus />
          Add condition
        </Button>
      </div>

      <ArrowDown className="mx-auto size-4 text-muted-foreground" />

      {/* Actions */}
      <div className="flex flex-col gap-2 border p-4">
        <Label>Do this</Label>
        {actions.map((action, i) => (
          <div key={i} className="flex flex-col gap-2 border p-3">
            <div className="flex items-center gap-2">
              <Select
                value={action.type}
                onValueChange={(v) =>
                  setActions((prev) => prev.map((a, j) => (j === i ? { ...a, type: v as any } : a)))
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {actions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {(action.type === 'CREATE_TASK' || action.type === 'SCHEDULE_CALLBACK') && (
              <Input
                value={action.params.title ?? ''}
                onChange={(e) =>
                  setActions((prev) =>
                    prev.map((a, j) => (j === i ? { ...a, params: { ...a.params, title: e.target.value } } : a))
                  )
                }
                placeholder="Task title"
              />
            )}
            {action.type === 'UPDATE_LEAD_STAGE' && (
              <Select
                value={action.params.stage ?? 'QUALIFIED'}
                onValueChange={(v) =>
                  setActions((prev) =>
                    prev.map((a, j) => (j === i ? { ...a, params: { ...a.params, stage: v } } : a))
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'PROPOSAL', 'WON', 'LOST'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {action.type === 'NOTIFY_TEAM' && (
              <Input
                value={action.params.message ?? ''}
                onChange={(e) =>
                  setActions((prev) =>
                    prev.map((a, j) => (j === i ? { ...a, params: { ...a.params, message: e.target.value } } : a))
                  )
                }
                placeholder="Notification message"
              />
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActions((prev) => [...prev, { type: 'NOTIFY_TEAM', params: {} }])}
        >
          <Plus />
          Add action
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {workflowId ? 'Save as new version' : 'Create workflow (draft)'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WorkflowsView({
  workflows,
  canManage,
}: {
  workflows: WorkflowDto[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<WorkflowDto | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WorkflowDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStatus = (workflowId: string, status: string) => {
    startTransition(async () => {
      const result = await setWorkflowStatus(workflowId, status as any);
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
      const result = await deleteWorkflow(deleteTarget.$id);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setDeleteTarget(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" variant="brand" onClick={() => setIsCreateOpen(true)}>
            <Plus />
            New workflow
          </Button>
        </div>
      )}

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center bg-secondary">
              <WorkflowIcon className="size-6" />
            </span>
            <div>
              <p className="text-base font-medium">No workflows yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Automate what happens after events — e.g. a missed call creates an urgent callback
                task and notifies managers.
              </p>
            </div>
            {canManage && (
              <Button asChild variant="brand" className="mt-2">
                <Link href="#" onClick={(e) => { e.preventDefault(); setIsCreateOpen(true); }}>
                  <Plus />
                  Create workflow
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.$id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={STATUS_VARIANT[workflow.status] ?? 'outline'}>{workflow.status}</Badge>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Workflow actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {workflow.status !== 'PUBLISHED' && (
                          <DropdownMenuItem onSelect={() => handleStatus(workflow.$id, 'PUBLISHED')}>
                            <Play className="size-4" /> Publish
                          </DropdownMenuItem>
                        )}
                        {workflow.status === 'PUBLISHED' && (
                          <DropdownMenuItem onSelect={() => handleStatus(workflow.$id, 'DISABLED')}>
                            <Pause className="size-4" /> Disable
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setEditTarget(workflow)}>
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteTarget(workflow)}>
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <CardTitle className="text-base">{workflow.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {workflow.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3" />
                  {workflow.triggerType ?? '—'}
                  <ArrowRight className="size-3" />
                  {workflow.actionCount} action{workflow.actionCount === 1 ? '' : 's'}
                </div>
                <span>
                  {workflow.runCount} run{workflow.runCount === 1 ? '' : 's'} · v{workflow.versionCount}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Pick a trigger, add optional conditions, then chain actions. Saved as a draft —
              publish to activate.
            </DialogDescription>
          </DialogHeader>
          <BuilderForm
            onFormSuccess={() => {
              setIsCreateOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit — {editTarget?.name}</DialogTitle>
            <DialogDescription>Saving creates a new immutable version.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <EditBuilder key={editTarget.$id} workflow={editTarget} onFormSuccess={() => { setEditTarget(null); router.refresh(); }} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.name}</span> will be removed and can no
              longer trigger. Past executions are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Loads the full definition for editing via the detail-fetch server action. */
function EditBuilder({
  workflow,
  onFormSuccess,
}: {
  workflow: WorkflowDto;
  onFormSuccess: () => void;
}) {
  const [definition, setDefinition] = React.useState<WorkflowDefinition | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { getWorkflow } = await import('@/app/workflows/actions');
      const full = await getWorkflow(workflow.$id);
      if (full?.definition) setDefinition(full.definition);
      else setError('This workflow has no editable definition.');
    })();
  }, [workflow.$id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!definition) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-muted-foreground" />;
  return (
    <BuilderForm
      workflowId={workflow.$id}
      initial={definition}
      onFormSuccess={onFormSuccess}
    />
  );
}
