'use client';

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
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Shield, ShieldOff, KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFormState } from 'react-dom';
import { useTransition } from 'react';
import { createUser, deleteUser, updateUserRole, sendPasswordReset } from '@/app/settings/users_actions';
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '../ui/switch';
import type { UserSummary } from '@/app/settings/users_actions';

function CreateUserForm({ onFormSuccess }: { onFormSuccess: () => void }) {
    const [state, formAction] = useFormState(createUser, null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    React.useEffect(() => {
        if (state?.status === 'success') {
            toast({ title: 'Success', description: state.message });
            onFormSuccess();
        } else if (state?.status === 'error' && state.message) {
            toast({ variant: 'destructive', title: 'Error', description: state.message });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form 
            action={(formData) => startTransition(() => formAction(formData))}
            className="space-y-4"
        >
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" placeholder="Jane Doe" required />
                {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="jane.doe@example.com" required />
                 {state?.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
                 {state?.errors?.password && <p className="text-sm text-destructive">{state.errors.password[0]}</p>}
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="isAdmin" name="isAdmin" />
                <Label htmlFor="isAdmin">Make this user an administrator?</Label>
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                </Button>
            </DialogFooter>
        </form>
    );
}

export function UserManagement({ initialUsers, currentUserId }: { initialUsers: UserSummary[], currentUserId: string }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isCreateDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UserSummary | null>(null);

  const handleAction = (action: () => Promise<{status: string, message: string}>) => {
      startTransition(async () => {
          const result = await action();
          if (result.status === 'success') {
              toast({ title: 'Success', description: result.message });
          } else {
              toast({ variant: 'destructive', title: 'Error', description: result.message });
          }
          if (deleteTarget) setDeleteTarget(null);
      });
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-end">
            <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Add User</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                            Create a new account. The user will be able to log in immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <CreateUserForm onFormSuccess={() => setCreateDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Date Joined</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.length > 0 ? (
              initialUsers.map((user) => {
                const isAdmin = user.labels.includes('admin');
                const isCurrentUser = user.$id === currentUserId;
                return (
                    <TableRow key={user.$id}>
                        <TableCell>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                            <Badge variant={isAdmin ? 'default' : 'secondary'}>{isAdmin ? 'Admin' : 'User'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isPending || isCurrentUser}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {isAdmin ? (
                                        <DropdownMenuItem onSelect={() => handleAction(() => updateUserRole(user.$id, user.labels, false))}>
                                            <ShieldOff className="mr-2 h-4 w-4" /> Revoke Admin
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onSelect={() => handleAction(() => updateUserRole(user.$id, user.labels, true))}>
                                            <Shield className="mr-2 h-4 w-4" /> Make Admin
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onSelect={() => handleAction(() => sendPasswordReset(user.email))}>
                                        <KeyRound className="mr-2 h-4 w-4" /> Send Password Reset
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteTarget(user)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                           </DropdownMenu>
                        </TableCell>
                    </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user{' '}
              <span className="font-semibold">"{deleteTarget?.name}"</span> and all their associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => handleAction(() => deleteUser(deleteTarget!.$id))}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}
