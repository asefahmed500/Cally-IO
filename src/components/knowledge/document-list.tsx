
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
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { type KnowledgeDocument } from '@/app/knowledge/page';
import { useToast } from '@/hooks/use-toast';
import { deleteDocument } from '@/app/knowledge/actions';
import { Input } from '../ui/input';

export function DocumentList({ documents, isAdmin }: { documents: KnowledgeDocument[], isAdmin: boolean }) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [localDocuments, setLocalDocuments] = React.useState(documents);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeDocument | null>(null);

  React.useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  const handleDelete = (docToDelete: KnowledgeDocument) => {
    const originalDocuments = [...localDocuments];
    // Optimistically remove the document from the list for a real-time feel
    setLocalDocuments(currentDocs => currentDocs.filter(doc => doc.documentId !== docToDelete.documentId));

    startTransition(async () => {
      const result = await deleteDocument(docToDelete.documentId);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error deleting document',
          description: result.error,
        });
        // If deletion fails, revert the change
        setLocalDocuments(originalDocuments);
      } else {
        toast({
          title: 'Document Deleted',
          description: `"${docToDelete.fileName}" has been removed from the knowledge base.`,
        });
      }
      setDeleteTarget(null);
    });
  };

  const filteredDocuments = localDocuments.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (isAdmin && doc.userId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const tableColSpan = isAdmin ? 4 : 3;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input 
          placeholder={isAdmin ? "Filter by name or user ID..." : "Filter by file name..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              {isAdmin && <TableHead>Uploaded By (User ID)</TableHead>}
              <TableHead className="hidden md:table-cell">Date Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((doc) => (
                <TableRow key={doc.documentId}>
                  <TableCell className="font-medium">{doc.fileName}</TableCell>
                  {isAdmin && <TableCell className="text-muted-foreground font-mono text-xs">{doc.userId}</TableCell>}
                  <TableCell className="hidden md:table-cell">
                    {new Date(doc.$createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="h-24 text-center">
                  No documents found.
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
              This action cannot be undone. This will permanently delete the document{' '}
              <span className="font-semibold">"{deleteTarget?.fileName}"</span> and all of its associated data from your knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}
