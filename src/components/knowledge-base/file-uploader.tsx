'use client';

import { useState } from 'react';
import { UploadCloud, File as FileIcon, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';

export function FileUploader({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID;
    if (!bucketId) {
        toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Appwrite storage bucket is not configured.',
        });
        setIsUploading(false);
        return;
    }

    try {
        const uploadPromises = files.map(file => 
            storage.createFile(bucketId, ID.unique(), file)
        );
        
        await Promise.all(uploadPromises);

        toast({
            title: 'Upload Successful',
            description: `${files.length} document(s) have been added to your data sources.`,
        });
        setFiles([]);
        onUploadComplete();
    } catch (error) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Could not upload files. Please check console for details.',
        });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer border-border hover:bg-muted/50 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('file-upload-input')?.click()}
      >
        <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
        <p className="mb-2 text-sm text-muted-foreground">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground">CSV, PDF, DOCX, or TXT (MAX. 10MB each)</p>
        <input id="file-upload-input" type="file" className="hidden" multiple onChange={handleFileChange} disabled={isUploading} />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
            <h4 className="font-medium">Files to upload:</h4>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((file, index) => (
                    <li key={index} className="flex items-center justify-between p-2 text-sm rounded-md bg-muted">
                        <div className="flex items-center gap-2 truncate">
                            <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0" onClick={() => removeFile(index)} disabled={isUploading}>
                            <X className="w-4 h-4" />
                        </Button>
                    </li>
                ))}
            </ul>
            <Button onClick={handleUpload} className="w-full mt-2" disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isUploading ? 'Uploading...' : `Upload ${files.length} file(s)`}
            </Button>
        </div>
      )}
    </div>
  );
}
