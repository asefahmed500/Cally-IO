'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, FileText } from 'lucide-react';
import { type Lead } from '@/lib/types';
import { generateScriptAndAudio, type ScriptGeneratorOutput } from '@/ai/flows/script-generator';
import { useToast } from '@/hooks/use-toast';

interface ScriptGeneratorDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScriptGeneratorDialog({ lead, open, onOpenChange }: ScriptGeneratorDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ScriptGeneratorOutput | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
      setResult(null);
      generateScriptAndAudio({
        leadName: lead.name,
        companyName: lead.company,
        companyDescription: lead.companyDescription,
        title: lead.title,
      })
        .then(setResult)
        .catch((error) => {
          console.error("Failed to generate script:", error);
          toast({
            variant: 'destructive',
            title: 'Generation Failed',
            description: 'Could not generate the script. Please check the server logs.',
          });
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, lead, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI-Generated Call Script</DialogTitle>
          <DialogDescription>
            For {lead.name} at {lead.company}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating script and audio...</p>
            </div>
          )}
          {result && (
            <div className="space-y-6">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-2"><Mic className="h-5 w-5" /> Audio Preview</h3>
                     <audio controls className="w-full">
                        <source src={result.audioDataUri} type="audio/wav" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
                <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-2"><FileText className="h-5 w-5" /> Script Text</h3>
                    <div className="p-4 bg-muted rounded-md max-h-64 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm">{result.scriptText}</p>
                    </div>
                </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
