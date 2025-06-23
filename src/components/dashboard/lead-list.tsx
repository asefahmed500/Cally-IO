'use client';

import * as React from 'react';
import type { Lead } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { ScriptGeneratorDialog } from './script-generator-dialog';

interface LeadListProps {
    leads: Lead[];
}

export function LeadList({ leads }: LeadListProps) {
    const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const handleGenerateScript = (lead: Lead) => {
        setSelectedLead(lead);
        setIsDialogOpen(true);
    };

    const getStatusVariant = (status: 'Hot' | 'Warm' | 'Cold'): 'success' | 'warning' | 'secondary' => {
        switch (status) {
            case 'Hot': return 'success';
            case 'Warm': return 'warning';
            case 'Cold': return 'secondary';
            default: return 'secondary';
        }
    };

    return (
        <>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Lead Score</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leads.map(lead => (
                            <TableRow key={lead.id}>
                                <TableCell>
                                    <div className="font-medium">{lead.name}</div>
                                    <div className="text-sm text-muted-foreground">{lead.title}</div>
                                </TableCell>
                                <TableCell>{lead.company}</TableCell>
                                <TableCell>{lead.score}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(lead.status)}>{lead.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleGenerateScript(lead)}
                                        title="Generate Audio Script"
                                    >
                                        <Phone className="h-4 w-4" />
                                        <span className="sr-only">Generate Script</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {selectedLead && (
                <ScriptGeneratorDialog
                    lead={selectedLead}
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                />
            )}
        </>
    );
}
