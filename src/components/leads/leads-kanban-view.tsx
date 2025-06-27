
'use client';

import * as React from 'react';
import type { Lead } from '@/app/leads/page';
import { LeadCard } from './lead-card';
import { createLead, updateLeadStatus } from '@/app/leads/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Search, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useActionState } from 'react';
import { Label } from '../ui/label';


const statuses: Lead['status'][] = ['New', 'Qualified', 'Called', 'Converted'];

const statusStyles = {
    New: { title: 'New Leads', color: 'bg-blue-500' },
    Qualified: { title: 'Qualified', color: 'bg-yellow-500' },
    Called: { title: 'Called', color: 'bg-purple-500' },
    Converted: { title: 'Converted', color: 'bg-green-500' },
};

function CreateLeadForm({ onFormSuccess }: { onFormSuccess: () => void }) {
    const [state, formAction, isPending] = useActionState(createLead, null);
    const { toast } = useToast();

    React.useEffect(() => {
        if (state?.status === 'success') {
            toast({ title: 'Success', description: state.message });
            onFormSuccess();
        } else if (state?.status === 'error' && typeof state.message === 'string') {
            toast({ variant: 'destructive', title: 'Error', description: state.message });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form action={formAction} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Lead Name</Label>
                <Input id="name" name="name" placeholder="e.g., Jane Doe" required />
                {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Lead Email</Label>
                <Input id="email" name="email" type="email" placeholder="e.g., jane.doe@example.com" required />
                {state?.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
            </div>
            <DialogFooter>
                 <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Create Lead
                </Button>
            </DialogFooter>
        </form>
    );
}

export function LeadsKanbanView({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        setLeads(initialLeads);
    }, [initialLeads]);

    const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
        const originalLeads = [...leads];
        // Optimistically update the UI
        setLeads(prevLeads =>
            prevLeads.map(lead =>
                lead.$id === leadId ? { ...lead, status: newStatus } : lead
            )
        );

        const result = await updateLeadStatus(leadId, newStatus);
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Error updating status',
                description: result.error,
            });
            // Revert on error
            setLeads(originalLeads);
        } else {
            toast({
                title: 'Status Updated',
                description: 'The lead status has been successfully updated.',
            });
        }
    };
    
    const handleExport = () => {
        if (leads.length === 0) {
            toast({ title: "No leads to export.", variant: "default" });
            return;
        }
        const headers = ['Name', 'Email', 'Status', 'Score', 'Last Activity', 'Created At', 'Agent ID'];
        const csvRows = [
          headers.join(','),
          ...leads.map((lead) =>
            [
              `"${lead.name.replace(/"/g, '""')}"`,
              `"${lead.email}"`,
              `"${lead.status}"`,
              lead.score,
              `"${new Date(lead.lastActivity).toLocaleString()}"`,
              `"${new Date(lead.$createdAt).toLocaleString()}"`,
              `"${lead.agentId || 'N/A'}"`
            ].join(',')
          ),
        ];
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'leads.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
          title: 'Exporting Leads',
          description: 'Your leads.csv file has started downloading.',
        });
    };

    const filteredLeads = leads.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const leadsByStatus = statuses.reduce((acc, status) => {
        acc[status] = filteredLeads.filter(lead => lead.status === status);
        return acc;
    }, {} as Record<Lead['status'], Lead[]>);

    return (
        <div className="flex flex-col flex-1 min-h-0">
             <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search leads by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Lead
                    </Button>
                    <Button onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 overflow-y-auto">
                {statuses.map(status => (
                    <div key={status} className="bg-muted/50 rounded-lg flex flex-col">
                        <div className="p-4 border-b border-border sticky top-0 bg-muted/50 rounded-t-lg z-10">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${statusStyles[status].color}`} />
                                <h3 className="font-semibold">{statusStyles[status].title}</h3>
                                <span className="text-sm font-normal text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                                    {leadsByStatus[status].length}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {leadsByStatus[status].length > 0 ? (
                                leadsByStatus[status].map(lead => (
                                    <LeadCard
                                        key={lead.$id}
                                        lead={lead}
                                        onStatusChange={handleStatusChange}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-10">
                                    No leads in this stage.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Lead</DialogTitle>
                        <DialogDescription>
                            Manually add a new lead to your pipeline. This lead will be assigned to you.
                        </DialogDescription>
                    </DialogHeader>
                    <CreateLeadForm onFormSuccess={() => setIsCreateDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
