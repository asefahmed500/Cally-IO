'use client';

import { useState, useTransition } from 'react';
import { storage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { processDocumentAction } from '@/app/knowledge-base/actions';
import { Loader2, UploadCloud } from 'lucide-react';
import { Progress } from '../ui/progress';

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;
const ACCEPTED_FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

export function FileUploader() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid File Type',
                    description: 'Please upload a PDF, DOCX, or TXT file.',
                });
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setIsProcessing(false);
        setUploadProgress(0);

        try {
            const response = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                file,
                undefined, // permissions
                (progress) => {
                    setUploadProgress(progress.progress);
                }
            );

            setIsUploading(false);
            setIsProcessing(true);
            toast({
                title: 'Upload Complete',
                description: 'Your document is now being processed by the AI.',
            });

            const result = await processDocumentAction(response.$id, file.name);
            
            if (result.success) {
                toast({
                    title: 'Processing Complete',
                    description: 'Your document has been added to the knowledge base.',
                });
            } else {
                 throw new Error(result.error || 'An unknown processing error occurred.');
            }

        } catch (error: any) {
            console.error('Upload failed:', error);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsUploading(false);
            setIsProcessing(false);
            setFile(null);
            // Consider using a form element to easily reset the input
            const input = document.getElementById('file-input') as HTMLInputElement;
            if (input) input.value = '';
        }
    };
    
    const isLoading = isUploading || isProcessing;

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-4">
                <Input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    accept=".pdf,.docx,.txt"
                    className="flex-1"
                />
                <Button onClick={handleUpload} disabled={!file || isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Upload'}
                </Button>
            </div>
            {isUploading && (
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Uploading: {file?.name}</p>
                    <Progress value={uploadProgress} />
                </div>
            )}
        </div>
    );
}
