'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getDocuments, deleteDocument } from '@/app/knowledge-base/actions';
import { useToast } from '@/hooks/use-toast';
import type { Models } from 'appwrite';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function DocumentList() {
    const [documents, setDocuments] = useState<Models.File[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchDocuments = async () => {
        setLoading(true);
        const files = await getDocuments();
        setDocuments(files);
        setLoading(false);
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleDelete = async (fileId: string) => {
        const originalDocuments = [...documents];
        setDocuments(docs => docs.filter(doc => doc.$id !== fileId));
        
        const result = await deleteDocument(fileId);
        if (!result.success) {
            setDocuments(originalDocuments);
            toast({
                variant: 'destructive',
                title: 'Error deleting source file',
                description: result.error,
            });
        } else {
            toast({
                title: 'Source file deleted',
                description: 'The source file has been removed.',
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Managed Sources</CardTitle>
                <CardDescription>A list of your custom uploaded news source files.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No source files uploaded yet.</p>
                        <p className="text-sm text-muted-foreground">Use the uploader to add custom sources.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.map((doc) => (
                                <TableRow key={doc.$id}>
                                    <TableCell className="font-medium truncate max-w-xs">{doc.name}</TableCell>
                                    <TableCell>{doc.mimeType}</TableCell>
                                    <TableCell>{formatBytes(doc.sizeOriginal)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleDelete(doc.$id)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
