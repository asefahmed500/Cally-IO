'use client';

import { useState, useTransition } from 'react';
import type { Models } from 'appwrite';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, FileText, FileUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteDocumentAction } from '@/app/knowledge-base/actions';
import { formatDistanceToNow } from 'date-fns';

interface DocumentListProps {
    initialDocuments: Models.File[];
}

export function DocumentList({ initialDocuments }: DocumentListProps) {
    const [documents, setDocuments] = useState(initialDocuments);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = (fileId: string) => {
        setIsDeletingId(fileId);
        startTransition(async () => {
            const result = await deleteDocumentAction(fileId);
            if (result.success) {
                setDocuments(docs => docs.filter(doc => doc.$id !== fileId));
                toast({
                    title: 'Document Deleted',
                    description: 'The document and its embeddings have been removed.',
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error Deleting Document',
                    description: result.error || 'An unknown error occurred.',
                });
            }
            setIsDeletingId(null);
        });
    };

    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">No Documents Yet</h3>
                <p className="text-muted-foreground mt-1">Upload your first document to start building your knowledge base.</p>
            </div>
        );
    }
    
    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {documents.map(doc => (
                        <TableRow key={doc.$id}>
                            <TableCell className="font-medium">{doc.name}</TableCell>
                            <TableCell>{(doc.sizeOriginal / 1024).toFixed(2)} KB</TableCell>
                            <TableCell>{formatDistanceToNow(new Date(doc.$createdAt), { addSuffix: true })}</TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDelete(doc.$id)}
                                    disabled={isDeletingId === doc.$id}
                                    title="Delete Document"
                                >
                                    {isDeletingId === doc.$id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    )}
                                    <span className="sr-only">Delete Document</span>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
