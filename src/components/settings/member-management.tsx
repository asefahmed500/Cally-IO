'use client'

import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserPlus, Trash2, Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DialogTrigger,
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
import { useToast } from '@/hooks/use-toast';
import { useFormState } from 'react-dom';
import { useTransition } from 'react';
import {
  inviteMember,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  listMembers,
  listInvitations,
  type WorkspaceMemberSummary,
  type InvitationSummary,
} from '@/app/settings/members_actions';

const ASSIGNABLE_ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'HUMAN_AGENT', label: 'Agent' },
  { value: 'ANALYST', label: 'Analyst' },
];

function roleLabel(role: string): string {
  return ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? 'Owner';
}

function InviteForm({ onFormSuccess }: { onFormSuccess: (inviteUrl?: string) => void }) {
  const [state, formAction] = useFormState(inviteMember, null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  React.useEffect(() => {
    if (state?.status === 'success') {
      toast({ title: 'Success', description: state.message });
      onFormSuccess(state.inviteUrl);
    } else if (state?.status === 'error' && state.message) {
      toast({ variant: 'destructive', title: 'Error', description: state.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={(formData) => startTransition(() => formAction(formData))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select name="role" defaultValue="HUMAN_AGENT">
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Send Invitation
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MemberManagement({
  initialMembers,
  initialInvitations,
  currentUserId,
  canManage,
}: {
  initialMembers: WorkspaceMemberSummary[];
  initialInvitations: InvitationSummary[];
  currentUserId: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [members, setMembers] = React.useState(initialMembers);
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<WorkspaceMemberSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const [nextMembers, nextInvitations] = await Promise.all([listMembers(), listInvitations()]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    });
  }, []);

  const handleRoleChange = (memberId: string, role: string) => {
    startTransition(async () => {
      const result = await updateMemberRole(memberId, role);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await removeMember(removeTarget.$id);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setRemoveTarget(null);
    });
  };

  const handleRevoke = (invitationId: string) => {
    startTransition(async () => {
      const result = await revokeInvitation(invitationId);
      if (result.status === 'success') {
        toast({ title: 'Success', description: result.message });
        refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const handleCopyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not copy the link.' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        {canManage && (
          <Dialog open={isInviteOpen} onOpenChange={(open) => { setIsInviteOpen(open); if (!open) setInviteUrl(null); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              {inviteUrl ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Invitation created</DialogTitle>
                    <DialogDescription>
                      No email provider is configured, so share this accept link directly:
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate bg-muted px-3 py-2 text-xs">{inviteUrl}</code>
                    <Button variant="outline" size="icon" onClick={() => handleCopyInvite(inviteUrl)}>
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      <span className="sr-only">Copy link</span>
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsInviteOpen(false); refresh(); }}>
                      Done
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Invite a team member</DialogTitle>
                    <DialogDescription>
                      They will join this workspace with the role you choose.
                    </DialogDescription>
                  </DialogHeader>
                  <InviteForm
                    onFormSuccess={(url) => {
                      if (url) setInviteUrl(url);
                    }}
                  />
                </>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members */}
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.$id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {member.name}
                        {member.userId === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.role === 'WORKSPACE_OWNER' ? 'default' : 'secondary'}>
                    {roleLabel(member.role)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending || member.isOwner || member.userId === currentUserId}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Member actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Change role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {ASSIGNABLE_ROLES.filter((r) => r.value !== member.role).map((role) => (
                          <DropdownMenuItem key={role.value} onSelect={() => handleRoleChange(member.$id, role.value)}>
                            {role.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setRemoveTarget(member)}>
                          <Trash2 className="size-4" /> Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Pending invitations</h4>
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Expires</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.$id}>
                    <TableCell className="text-muted-foreground">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(invitation.role)}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={isPending}
                          onClick={() => handleRevoke(invitation.$id)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{removeTarget?.name}</span> from the
              workspace. They will lose access to all workspace data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
