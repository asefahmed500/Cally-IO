'use client'

import { useEffect, useState, useTransition } from 'react';
import type { Models } from 'appwrite';
import { listDocuments, deleteDocument } from '@/app/knowledge-base/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"

export function DocumentList() {
    const [documents, setDocuments] = useState<Models.File[]>([]);
    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        startTransition(async () => {
            const docs = await listDocuments();
            setDocuments(docs);
        });
    }, []);

    const handleDelete = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this document and all its processed data?')) {
            return;
        }
        setDeletingId(fileId);
        startTransition(async () => {
            const result = await deleteDocument(fileId);
            if (result.success) {
                setDocuments(docs => docs.filter(d => d.$id !== fileId));
                toast({
                    title: "Success",
                    description: "Document deleted successfully.",
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.message || "Failed to delete document.",
                });
            }
            setDeletingId(null);
        });
    };

    if (isPending && documents.length === 0) {
        return <div className="text-center text-muted-foreground">Loading documents...</div>;
    }
    
    if (documents.length === 0) {
        return <p className="text-sm text-muted-foreground">No documents have been uploaded yet.</p>
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {documents.map(doc => (
                        <TableRow key={doc.$id}>
                            <TableCell className="font-medium truncate max-w-xs">{doc.name}</TableCell>
                            <TableCell>{new Date(doc.$createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(doc.$id)}
                                    disabled={deletingId === doc.$id}
                                >
                                    {deletingId === doc.$id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    )}
                                    <span className="sr-only">Delete</span>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
