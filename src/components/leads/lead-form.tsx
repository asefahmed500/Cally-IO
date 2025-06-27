'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveLead } from '@/app/leads/actions';
import type { Lead } from '@/app/leads/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, Save } from 'lucide-react';

export function LeadForm({ lead, onFormSuccess }: { lead?: Lead | null, onFormSuccess: () => void }) {
    const [state, formAction, isPending] = useActionState(saveLead, null);
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    React.useEffect(() => {
        if (state?.status === 'success') {
            toast({ title: 'Success', description: state.message });
            onFormSuccess();
        } else if (state?.status === 'error' && typeof state.message === 'string') {
            toast({ variant: 'destructive', title: 'Error', description: state.message });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={lead?.$id || ''} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Lead Name</Label>
                    <Input id="name" name="name" placeholder="e.g., Jane Doe" defaultValue={lead?.name} required />
                    {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Lead Email</Label>
                    <Input id="email" name="email" type="email" placeholder="e.g., jane.doe@example.com" defaultValue={lead?.email} required />
                    {state?.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="(555) 123-4567" defaultValue={lead?.phone} />
                    {state?.errors?.phone && <p className="text-sm text-destructive">{state.errors.phone[0]}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" placeholder="Acme Inc." defaultValue={lead?.company} />
                    {state?.errors?.company && <p className="text-sm text-destructive">{state.errors.company[0]}</p>}
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input id="jobTitle" name="jobTitle" placeholder="e.g., Director of Marketing" defaultValue={lead?.jobTitle} />
                {state?.errors?.jobTitle && <p className="text-sm text-destructive">{state.errors.jobTitle[0]}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="e.g., Met at the conference. Interested in AI features." defaultValue={lead?.notes} className="min-h-24" />
                {state?.errors?.notes && <p className="text-sm text-destructive">{state.errors.notes[0]}</p>}
            </div>
            <DialogFooter>
                 <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {lead ? 'Save Changes' : 'Create Lead'}
                </Button>
            </DialogFooter>
        </form>
    );
}
