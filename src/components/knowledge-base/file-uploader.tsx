'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { uploadDocument } from '@/app/knowledge-base/actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast"
import { useEffect, useRef } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
      {pending ? 'Uploading & Processing...' : 'Upload Document'}
    </Button>
  );
}

export function FileUploader() {
  const [state, formAction] = useFormState(uploadDocument, null);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    
    if (state.message.startsWith('Success')) {
        toast({
            title: "Success",
            description: state.message,
        });
        formRef.current?.reset();
    } else {
        toast({
            variant: "destructive",
            title: "Upload Error",
            description: state.message,
        });
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor="document">Document File (.txt)</Label>
        <Input id="document" name="document" type="file" accept=".txt" required />
      </div>
      <SubmitButton />
    </form>
  );
}
