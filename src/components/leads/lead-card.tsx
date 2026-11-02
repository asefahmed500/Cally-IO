'use client';

import * as React from 'react';
import type { Lead } from '@/app/leads/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Loader2, Phone, User, Star, Edit, Trash2, CalendarDays } from 'lucide-react';
import { initiateCall } from '@/app/leads/actions';
import { useToast } from '@/hooks/use-toast';
import { LeadProfileCard } from './lead-profile-card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const statuses: Lead['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'PROPOSAL', 'WON', 'LOST'];

export function LeadCard({ 
    lead, 
    onStatusChange,
    onEdit,
    onDelete,
}: { 
    lead: Lead; 
    onStatusChange: (leadId: string, newStatus: Lead['status']) => void;
    onEdit: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
}) {
    const { toast } = useToast();
    const [isPending, startTransition] = React.useTransition();
    const [isProfileOpen, setProfileOpen] = React.useState(false);

    const handleInitiateCall = (lead: Lead) => {
        startTransition(async () => {
            toast({
              title: 'Initiating Automated Call...',
              description: `The system is placing a call to ${lead.name}.`,
            });
            const result = await initiateCall(lead);
            if (result.error) {
                toast({
                    variant: 'destructive',
                    title: 'Call Failed',
                    description: result.error,
                });
            } else {
                toast({
                    title: 'Call Successfully Initiated!',
                    description: `The call SID is ${result.callSid}. You can track its status in your Twilio console.`,
                    duration: 10000,
                });
            }
        });
    };

    const isFollowUpDue = lead.followUpDate && new Date(lead.followUpDate) < new Date();

    return (
        <>
            <Card>
                <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                        <div>
                             <CardTitle className="text-base">{lead.name}</CardTitle>
                             <CardDescription>{lead.email}</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 -mt-1 -mr-1">
                                    {isPending ? <Loader2 className="size-4 animate-spin"/> : <MoreHorizontal className="size-4" />}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                                    <User />
                                    View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleInitiateCall(lead)} disabled={isPending}>
                                    <Phone />
                                    Start Automated Call
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            {statuses.map(status => (
                                                <DropdownMenuItem 
                                                    key={status} 
                                                    onSelect={() => onStatusChange(lead.$id, status)}
                                                    disabled={lead.status === status}
                                                >
                                                    {status}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => onEdit(lead)}>
                                    <Edit />
                                    Edit Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(lead)}>
                                    <Trash2 />
                                    Delete Lead
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Star className="size-3 text-warning" />
                            <span>{lead.score}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {!lead.agentId && (
                                <Badge variant="secondary">Unclaimed</Badge>
                            )}
                            {lead.followUpDate && (
                                <div className={cn("flex items-center gap-1", isFollowUpDue && "text-destructive font-semibold")}>
                                    <CalendarDays className="size-3" />
                                    <span>{new Date(lead.followUpDate).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Dialog open={isProfileOpen} onOpenChange={setProfileOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Lead Profile</DialogTitle>
                        <DialogDescription>
                            Detailed information for this lead.
                        </DialogDescription>
                    </DialogHeader>
                    <LeadProfileCard lead={lead} />
                </DialogContent>
             </Dialog>
        </>
    );
}
