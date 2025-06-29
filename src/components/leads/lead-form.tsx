'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { saveLead } from '@/app/leads/actions';
import type { Lead } from '@/app/leads/types';
import type { UserSummary } from '@/app/settings/users_actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, Save, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTransition } from 'react';

export function LeadForm({ lead, onFormSuccess, allUsers, isAdmin }: { lead?: Lead | null, onFormSuccess: () => void, allUsers: UserSummary[], isAdmin: boolean }) {
    const [state, formAction] = useFormState(saveLead, null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);
    const [followUpDate, setFollowUpDate] = React.useState<Date | undefined>(
        lead?.followUpDate ? new Date(lead.followUpDate) : undefined
    );

    React.useEffect(() => {
        if (state?.status === 'success') {
            toast({ title: 'Success', description: state.message });
            onFormSuccess();
        } else if (state?.status === 'error' && typeof state.message === 'string') {
            toast({ variant: 'destructive', title: 'Error', description: state.message });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form 
            ref={formRef} 
            action={(formData) => startTransition(() => formAction(formData))}
            className="space-y-4"
        >
            <input type="hidden" name="id" value={lead?.$id || ''} />
            <input type="hidden" name="followUpDate" value={followUpDate ? followUpDate.toISOString() : ''} />
            
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
            {isAdmin && (
                <div className="space-y-2">
                    <Label htmlFor="agentId">Assigned Agent</Label>
                    <Select name="agentId" defaultValue={lead?.agentId || ''}>
                        <SelectTrigger id="agentId">
                            <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {allUsers.map(user => (
                                <SelectItem key={user.$id} value={user.$id}>
                                    {user.name} ({user.email})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {state?.errors?.agentId && <p className="text-sm text-destructive">{state.errors.agentId[0]}</p>}
                </div>
            )}
             <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="e.g., Met at the conference. Interested in AI features." defaultValue={lead?.notes} className="min-h-24" />
                {state?.errors?.notes && <p className="text-sm text-destructive">{state.errors.notes[0]}</p>}
            </div>

            <div className="space-y-2 pt-4 border-t">
                <Label>Follow-up</Label>
                <div className="grid md:grid-cols-2 gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !followUpDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {followUpDate ? format(followUpDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={followUpDate}
                                onSelect={setFollowUpDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Textarea name="followUpNotes" placeholder="Follow-up notes..." defaultValue={lead?.followUpNotes} />
                </div>
                {state?.errors?.followUpDate && <p className="text-sm text-destructive">{state.errors.followUpDate[0]}</p>}
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
