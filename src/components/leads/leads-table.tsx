'use client';

import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, MoreHorizontal, Loader2, Phone } from 'lucide-react';
import type { Lead } from '@/app/leads/page';
import { updateLeadStatus, initiateCall } from '@/app/leads/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const statusColors: { [key: string]: 'default' | 'secondary' | 'success' | 'warning' } = {
  New: 'secondary',
  Qualified: 'warning',
  Contacted: 'default',
  Converted: 'success',
};

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const handleStatusChange = (leadId: string, newStatus: string) => {
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, newStatus);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error updating status',
          description: result.error,
        });
      } else {
        toast({
          title: 'Status Updated',
          description: 'The lead status has been successfully updated.',
        });
      }
    });
  };

  const handleInitiateCall = (lead: Lead) => {
    startTransition(async () => {
        toast({
          title: 'Generating Script...',
          description: `AI is creating a script for ${lead.name}.`,
        });
        const result = await initiateCall({
            leadName: lead.name,
            leadStatus: lead.status,
            leadScore: lead.score,
        });
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: result.error,
            });
        } else {
            toast({
                title: result.message || 'Script Generated!',
                description: (
                    <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                        <code className="text-white text-xs whitespace-pre-wrap">{result.script}</code>
                    </pre>
                ),
                duration: 20000, // show for longer
            });
        }
    });
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Status', 'Score', 'Last Activity', 'Created At'];
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

  return (
    <div className="space-y-4">
       <div className="flex justify-end">
         <Button onClick={handleExport} disabled={leads.length === 0}>
           <Download className="mr-2 h-4 w-4" />
           Export to CSV
         </Button>
       </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <TableRow key={lead.$id}>
                  <TableCell>
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-muted-foreground">{lead.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{lead.score}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[lead.status] || 'default'}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {new Date(lead.lastActivity).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => handleInitiateCall(lead)} disabled={isPending}>
                            <Phone className="mr-2 h-4 w-4" />
                            Generate Script & Call
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                        {Object.keys(statusColors).map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusChange(lead.$id, status)}
                            disabled={isPending}
                          >
                            Set as {status}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No leads found. New users who sign up will appear here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
