'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';
import { Loader2, UploadCloud } from 'lucide-react';
import { processDocument } from '@/ai/flows/process-document';

interface DocumentUploaderProps {
  userId: string;
}

export function DocumentUploader({ userId }: DocumentUploaderProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: 'No file selected',
        description: 'Please select a file to upload.',
      });
      return;
    }
    
    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID;
    if (!bucketId) {
        toast({
            variant: 'destructive',
            title: 'Configuration Error',
            description: 'Appwrite storage bucket ID is not set.',
        });
        return;
    }

    setIsUploading(true);
    let uploadedFile;
    try {
      uploadedFile = await storage.createFile(bucketId, ID.unique(), file);
      toast({
        title: 'Upload Successful',
        description: `${file.name} has been uploaded. Starting processing.`,
      });
      setIsUploading(false);
      setIsProcessing(true);

      const result = await processDocument({ 
        fileId: uploadedFile.$id,
        fileName: file.name,
        userId: userId
      });

      if (result.success) {
        toast({
          title: 'Processing Complete',
          description: result.message,
        });
        // This is a simple way to trigger a refresh. A more robust solution might use React Query or SWR.
        window.location.reload();
      } else {
        toast({
            variant: 'destructive',
            title: 'Processing Failed',
            description: result.message,
        });
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'An unknown error occurred during upload.',
      });
    } finally {
        setIsUploading(false);
        setIsProcessing(false);
        setFile(null);
        setIsOpen(false);
    }
  };

  const isLoading = isUploading || isProcessing;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a PDF, DOCX, or TXT file to add to your knowledge base.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="document">Document</Label>
            <Input 
              id="document" 
              type="file" 
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt"
              disabled={isLoading}
            />
          </div>
          {isLoading && (
            <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isUploading ? 'Uploading...' : 'Processing...'}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleUpload} disabled={isLoading || !file}>
            Upload and Process
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
