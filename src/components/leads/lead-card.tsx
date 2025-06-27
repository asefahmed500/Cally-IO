
'use client';

import * as React from 'react';
import type { Lead } from '@/app/leads/page';
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
import { MoreHorizontal, Loader2, Phone, User, Star, Edit, Trash2 } from 'lucide-react';
import { initiateCall } from '@/app/leads/actions';
import { useToast } from '@/hooks/use-toast';
import { LeadProfileCard } from './lead-profile-card';

const statuses: Lead['status'][] = ['New', 'Qualified', 'Called', 'Converted'];

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
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1" disabled={isPending}>
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                                    <User className="mr-2 h-4 w-4" />
                                    View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleInitiateCall(lead)}>
                                    <Phone className="mr-2 h-4 w-4" />
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
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(lead)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Lead
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span>{lead.score}</span>
                        </div>
                        <span>{new Date(lead.lastActivity).toLocaleDateString()}</span>
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
