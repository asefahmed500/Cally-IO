'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Lead } from '@/lib/types';
import { scoreLead } from '@/ai/flows/score-lead';
import { Loader2, PlusCircle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Mock data for initial display
const initialLeads: Lead[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@innovatech.com', company: 'Innovatech', title: 'CTO', status: 'New' },
  { id: '2', name: 'Bob Williams', email: 'bob@datasphere.io', company: 'DataSphere', title: 'Product Manager', status: 'New' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@solutioncorp.net', company: 'SolutionCorp', title: 'Marketing Lead', status: 'Contacted', score: 78, scoreCategory: 'Warm', scoreRationale: 'Good industry fit, but not a primary decision-maker.' },
];

export function LeadManager() {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [isScoring, setIsScoring] = React.useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = React.useState(false);
  const { toast } = useToast();

  const handleScoreLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsScoring(true);
    try {
      const result = await scoreLead({
        company: lead.company,
        title: lead.title,
        industry: "Technology", // Assuming a default industry for now
      });
      
      const updatedLead = { ...lead, ...result };

      setLeads(prevLeads => prevLeads.map(l => 
        l.id === lead.id ? updatedLead : l
      ));
      setSelectedLead(updatedLead);

    } catch (error) {
      console.error("Error scoring lead:", error);
      toast({
        variant: 'destructive',
        title: 'Scoring Failed',
        description: 'Could not get AI-powered score.',
      });
      // Close the dialog on error
      setSelectedLead(null);
    } finally {
      setIsScoring(false);
    }
  };

  const handleAddLead = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newLead: Lead = {
      id: (leads.length + 1).toString(),
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string,
      title: formData.get('title') as string,
      status: 'New',
    };
    setLeads([newLead, ...leads]);
    setIsAddLeadOpen(false);
    toast({
      title: 'Lead Added',
      description: `${newLead.name} has been added to your pipeline.`,
    });
  };

  const getBadgeVariant = (category?: 'Hot' | 'Warm' | 'Cold') => {
    switch (category) {
      case 'Hot': return 'destructive';
      case 'Warm': return 'warning';
      case 'Cold': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Lead Pipeline</h2>
        
        <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>Enter the details for the new lead.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLead}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" name="email" type="email" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="company" className="text-right">Company</Label>
                  <Input id="company" name="company" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <Input id="title" name="title" className="col-span-3" required />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Add Lead</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">AI Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-muted-foreground">{lead.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{lead.company}</div>
                    <div className="text-sm text-muted-foreground">{lead.title}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {lead.score ? (
                      <Badge variant={getBadgeVariant(lead.scoreCategory)}>{lead.scoreCategory} ({lead.score})</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not Scored</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleScoreLead(lead)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Score Lead
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLead} onOpenChange={(isOpen) => !isOpen && setSelectedLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Lead Score: {selectedLead?.name}</DialogTitle>
            <DialogDescription>
              AI-powered analysis of this lead's potential.
            </DialogDescription>
          </DialogHeader>
          {isScoring ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4">Scoring...</span>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Category</p>
                <Badge variant={getBadgeVariant(selectedLead?.scoreCategory)} className="text-lg px-4 py-1">{selectedLead?.scoreCategory}</Badge>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-4xl font-bold">{selectedLead?.score}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Rationale</p>
                <p className="text-muted-foreground text-sm p-3 bg-muted/50 rounded-md">{selectedLead?.scoreRationale}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
