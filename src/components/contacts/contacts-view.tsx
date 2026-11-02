'use client'

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2, Download, Upload, Search, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFormState } from 'react-dom';
import { useTransition } from 'react';
import {
  saveContact,
  deleteContact,
  exportContactsCsv,
  importContactsCsv,
  type ContactDto,
} from '@/app/contacts/actions';

function priorityBadge(priority: string) {
  switch (priority) {
    case 'URGENT':
      return <Badge variant="destructive">Urgent</Badge>;
    case 'HIGH':
      return <Badge variant="default">High</Badge>;
    case 'LOW':
      return <Badge variant="outline">Low</Badge>;
    default:
      return <Badge variant="secondary">Medium</Badge>;
  }
}

function consentBadge(consent: string) {
  switch (consent) {
    case 'GRANTED':
      return <Badge className="bg-success text-success-foreground">Consent</Badge>;
    case 'OPTED_OUT':
      return <Badge variant="destructive">Opted out</Badge>;
    case 'DENIED':
      return <Badge variant="destructive">Denied</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

const ContactForm = ({
  contact,
  onFormSuccess,
}: {
  contact?: ContactDto | null;
  onFormSuccess: () => void;
}) => {
  const [state, formAction] = useFormState(saveContact, null);
  const [isPending, startTransition] = useTransition();
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

  return (
    <form action={(formData) => startTransition(() => formAction(formData))} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={contact?.$id ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" name="name" defaultValue={contact?.name} required minLength={2} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" name="phone" defaultValue={contact?.phone} placeholder="+15551234567" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" defaultValue={contact?.email} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-company">Company</Label>
          <Input id="c-company" name="company" defaultValue={contact?.company} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-jobTitle">Job title</Label>
          <Input id="c-jobTitle" name="jobTitle" defaultValue={contact?.jobTitle} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-source">Source</Label>
          <Input id="c-source" name="source" defaultValue={contact?.source} placeholder="Website, referral..." />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-priority">Priority</Label>
          <Select name="priority" defaultValue={contact?.priority ?? 'MEDIUM'}>
            <SelectTrigger id="c-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-consent">Consent</Label>
          <Select name="consentStatus" defaultValue={contact?.consentStatus ?? 'UNKNOWN'}>
            <SelectTrigger id="c-consent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNKNOWN">Unknown</SelectItem>
              <SelectItem value="GRANTED">Granted</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
              <SelectItem value="OPTED_OUT">Opted out</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-tags">Tags (comma-separated)</Label>
        <Input id="c-tags" name="tags" defaultValue={contact?.tags.join(', ')} placeholder="vip, inbound" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-notes">Notes</Label>
        <Input id="c-notes" name="notes" defaultValue={contact?.notes} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {contact ? 'Save changes' : 'Create contact'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export function ContactsView({
  contacts,
  total,
  page,
  pageSize,
  members,
  canWrite,
  filters,
}: {
  contacts: ContactDto[];
  total: number;
  page: number;
  pageSize: number;
  members: { id: string; name: string }[];
  canWrite: boolean;
  filters: { q: string; priority: string; consent: string; mine: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = React.useState(filters.q);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<ContactDto | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ContactDto | null>(null);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [isPending, startTransition] = useTransition();

  const setFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '' || value === 'ALL' || value === '0') params.delete(key);
    else params.set(key, value);
    params.delete('page');
    router.push(`/contacts?${params.toString()}`);
  };

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? '') !== search) setFilter('q', search);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteContact(deleteTarget.$id);
      if (result.success) {
        toast({ title: 'Contact deleted', description: `"${deleteTarget.name}" was removed.` });
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
      setDeleteTarget(null);
    });
  };

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportContactsCsv();
      if (result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Export complete', description: 'Contacts downloaded as CSV.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const handleImport = () => {
    startTransition(async () => {
      const result = await importContactsCsv(importText);
      const summary = `${result.imported} imported, ${result.skippedDuplicates} duplicates skipped.`;
      if (result.errors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Import finished with issues',
          description: `${summary} ${result.errors.length} row(s) failed: ${result.errors[0]}`,
        });
      } else {
        toast({ title: 'Import complete', description: summary });
      }
      setIsImportOpen(false);
      setImportText('');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, company..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.priority} onValueChange={(v) => setFilter('priority', v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.consent} onValueChange={(v) => setFilter('consent', v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Consent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All consent</SelectItem>
              <SelectItem value="GRANTED">Granted</SelectItem>
              <SelectItem value="UNKNOWN">Unknown</SelectItem>
              <SelectItem value="OPTED_OUT">Opted out</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={filters.mine ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('mine', filters.mine ? null : '1')}
          >
            Mine only
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
              <Download />
              Export
            </Button>
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                <Upload />
                Import
              </Button>
            )}
            {canWrite && (
<Button size="sm" variant="brand" onClick={() => { setEditTarget(null); setIsFormOpen(true); }}>
<Plus />
Add contact
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead className="hidden md:table-cell">Company</TableHead>
              <TableHead className="hidden lg:table-cell">Priority</TableHead>
              <TableHead className="hidden lg:table-cell">Consent</TableHead>
              <TableHead className="hidden xl:table-cell">Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <TableRow key={contact.$id}>
                  <TableCell>
                    <Link href={`/contacts/${contact.$id}`} className="group flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center bg-secondary">
                        <User className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium group-hover:underline">
                          {contact.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {contact.phone || contact.email || '—'}
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {contact.company || '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{priorityBadge(contact.priority)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{consentBadge(contact.consentStatus)}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">
                    {contact.ownerName || 'Unassigned'}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPending}>
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Contact actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => { setEditTarget(contact); setIsFormOpen(true); }}>
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteTarget(contact)}>
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium">No contacts found</p>
                    <p className="text-xs text-muted-foreground">
                      {filters.q || filters.priority !== 'ALL' || filters.consent !== 'ALL'
                        ? 'Try adjusting your search or filters.'
                        : 'Add your first contact or import a CSV to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} — {total} contacts
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setFilter('page', String(page - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setFilter('page', String(page + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit contact' : 'New contact'}</DialogTitle>
            <DialogDescription>
              Duplicate phone numbers and emails are rejected automatically.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            key={editTarget?.$id ?? 'new'}
            contact={editTarget}
            onFormSuccess={() => {
              setIsFormOpen(false);
              setEditTarget(null);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV content with a header row. Required column: <code>Name</code>. Optional:{' '}
              <code>Phone</code>, <code>Email</code>, <code>Company</code>, <code>JobTitle</code>,{' '}
              <code>Source</code>, <code>Tags</code>, <code>Notes</code>. Duplicates are skipped.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'Name,Phone,Email\nJane Doe,+15551234567,jane@acme.com'}
            className="min-h-48 w-full border bg-background p-3 font-mono text-xs outline-none ring-ring focus-visible:ring-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isPending || !importText.trim()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{deleteTarget?.name}</span> from your
              contacts. Their pipeline entry and call history will no longer be linked.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
