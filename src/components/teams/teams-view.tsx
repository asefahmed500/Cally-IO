'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, Trash2, Users, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFormState } from 'react-dom';
import { useTransition } from 'react';
import { saveTeam, deleteTeam, type TeamDto } from '@/app/teams/actions';

function TeamForm({
  team,
  members,
  onFormSuccess,
}: {
  team?: TeamDto | null;
  members: { id: string; name: string }[];
  onFormSuccess: () => void;
}) {
  const [state, formAction] = useFormState(saveTeam, null);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(team?.members.map((m) => m.userId) ?? [])
  );
  const { toast } = useToast();

  React.useEffect(() => {
    if (state?.status === 'success') {
      toast({ title: 'Success', description: state.message });
      onFormSuccess();
    } else if (state?.status === 'error' && state.message) {
      toast({ variant: 'destructive', title: 'Error', description: state.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <form
      action={(formData) => {
        formData.set('memberIds', Array.from(selected).join(','));
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={team?.$id ?? ''} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="team-name">Team name *</Label>
        <Input id="team-name" name="name" defaultValue={team?.name} required minLength={2} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="team-desc">Description</Label>
        <Input id="team-desc" name="description" defaultValue={team?.description} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Members ({selected.size} selected)</Label>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Invite workspace members first — then assign them to teams.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto border">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex cursor-pointer items-center gap-3 border-b p-3 text-sm last:border-b-0 hover:bg-accent"
              >
                <Checkbox checked={selected.has(member.id)} onCheckedChange={() => toggle(member.id)} />
                {member.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {team ? 'Save changes' : 'Create team'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TeamsView({
  teams,
  members,
  canManage,
}: {
  teams: TeamDto[];
  members: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<TeamDto | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TeamDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTeam(deleteTarget.$id);
      if (result.success) {
        toast({ title: 'Team deleted' });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
      setDeleteTarget(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
<Button size="sm" variant="brand" onClick={() => { setEditTarget(null); setIsFormOpen(true); }}>
<Plus />
New team
          </Button>
        </div>
      )}

      {teams.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.$id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription>{team.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {team.members.length > 0 ? (
                    team.members.map((m) => (
                      <Badge key={m.userId} variant="secondary">
                        {m.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No members assigned</span>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditTarget(team); setIsFormOpen(true); }}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(team)}
                      disabled={isPending}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No teams yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Teams group your workspace members for lead assignment, campaigns, and reporting.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit team' : 'Create team'}</DialogTitle>
            <DialogDescription>Group members for assignment and reporting.</DialogDescription>
          </DialogHeader>
          <TeamForm
            key={editTarget?.$id ?? 'new'}
            team={editTarget}
            members={members}
            onFormSuccess={() => {
              setIsFormOpen(false);
              setEditTarget(null);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{deleteTarget?.name}</span>.
              Members remain in the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Delete team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
