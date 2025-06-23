'use client'

import { useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AddLeadForm } from './add-lead-form';
import { scoreLead, type LeadData, type LeadScore } from '@/ai/flows/score-lead-flow';
import { generateScript, type CallScript } from '@/ai/flows/script-generator';
import { Wand2, Loader2, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';

type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Lost';
export interface Lead {
    id: number;
    name: string;
    company: string;
    description: string;
    title: string;
    industry: string;
    status: LeadStatus;
    score: number | null;
    rationale: string | null;
}

const initialLeads: Lead[] = [
    { id: 1, name: 'Alice Johnson', company: 'Innovate Inc.', description: 'A leading provider of cloud-based enterprise solutions.', title: 'VP of Engineering', industry: 'SaaS', status: 'New', score: null, rationale: null },
    { id: 2, name: 'Bob Williams', company: 'Data Systems LLC', description: 'Specializes in data analytics and business intelligence.', title: 'Data Analyst', industry: 'Technology', status: 'Contacted', score: 65, rationale: 'Good industry match, but the contact is not a primary decision-maker.' },
    { id: 3, name: 'Charlie Brown', company: 'Creative Solutions', description: 'A full-service digital marketing agency.', title: 'Marketing Manager', industry: 'Marketing', status: 'New', score: null, rationale: null },
    { id: 4, name: 'Diana Miller', company: 'HealthWell Group', description: 'Operates a chain of wellness clinics.', title: 'COO', industry: 'Healthcare', status: 'Qualified', score: 92, rationale: 'High-level decision-maker in a target industry. Strong potential for a large contract.' },
];

function getStatusBadgeVariant(status: LeadStatus) {
    switch (status) {
        case 'New': return 'secondary';
        case 'Contacted': return 'default';
        case 'Qualified': return 'success';
        case 'Lost': return 'destructive';
        default: return 'outline';
    }
}

function getScoreBadgeVariant(score: number | null) {
    if (score === null) return 'secondary';
    if (score > 80) return 'success';
    if (score > 60) return 'warning';
    return 'danger';
}

export function LeadList() {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [isScoringId, setIsScoringId] = useState<number | null>(null);
    const [isGeneratingScriptId, setIsGeneratingScriptId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isAddLeadOpen, setAddLeadOpen] = useState(false);
    const [generatedScript, setGeneratedScript] = useState<string | null>(null);
    const [scriptForLead, setScriptForLead] = useState<Lead | null>(null);

    const { toast } = useToast();

    const handleAddLead = (newLead: Omit<Lead, 'id' | 'score' | 'rationale' | 'status'>) => {
        const leadWithId: Lead = {
            ...newLead,
            id: Math.max(...leads.map(l => l.id), 0) + 1,
            status: 'New',
            score: null,
            rationale: null,
        };
        setLeads(prev => [leadWithId, ...prev]);
        setAddLeadOpen(false);
        toast({
            title: "Lead Added",
            description: `${newLead.name} from ${newLead.company} has been added.`,
        });
    };
    
    const handleScoreLead = (lead: Lead) => {
        setIsScoringId(lead.id);
        startTransition(async () => {
            try {
                const leadData: LeadData = {
                    companyName: lead.company,
                    companyDescription: lead.description,
                    contactTitle: lead.title,
                    industry: lead.industry,
                };
                const result = await scoreLead(leadData);
                setLeads(prevLeads => prevLeads.map(l => 
                    l.id === lead.id ? { ...l, score: result.score, rationale: result.rationale } : l
                ));
                toast({
                    title: "Lead Scored!",
                    description: `${lead.name}'s score is ${result.score}.`,
                });
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Scoring Error",
                    description: "Could not score lead. Please try again.",
                });
                console.error("Scoring failed:", error);
            } finally {
                setIsScoringId(null);
            }
        });
    };

    const handleGenerateScript = (lead: Lead) => {
        setIsGeneratingScriptId(lead.id);
        setScriptForLead(lead);
        setGeneratedScript(null); // Clear previous script
        startTransition(async () => {
             try {
                const leadData: LeadData = {
                    companyName: lead.company,
                    companyDescription: lead.description,
                    contactTitle: lead.title,
                    industry: lead.industry,
                };
                const result = await generateScript(leadData);
                setGeneratedScript(result.script);
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Script Generation Error",
                    description: "Could not generate script. Please try again.",
                });
                console.error("Script generation failed:", error);
            } finally {
                setIsGeneratingScriptId(null);
            }
        });
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Sales Leads</CardTitle>
                        <CardDescription>
                            A list of your current sales leads. Click the wand to score or the phone to generate a call script.
                        </CardDescription>
                    </div>
                    <Dialog open={isAddLeadOpen} onOpenChange={setAddLeadOpen}>
                        <DialogTrigger asChild>
                            <Button>Add Lead</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Lead</DialogTitle>
                            </DialogHeader>
                            <AddLeadForm onSubmit={handleAddLead} />
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center">AI Score</TableHead>
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
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(lead.status)}>{lead.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {lead.score !== null ? (
                                                <Badge variant={getScoreBadgeVariant(lead.score)} className="text-base">
                                                    {lead.score}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog onOpenChange={(open) => !open && setGeneratedScript(null)}>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleGenerateScript(lead)}
                                                        title="Generate Script"
                                                    >
                                                        {isGeneratingScriptId === lead.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Phone className="h-4 w-4 text-primary" />
                                                        )}
                                                        <span className="sr-only">Generate Script</span>
                                                    </Button>
                                                </DialogTrigger>
                                            </Dialog>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleScoreLead(lead)}
                                                disabled={isScoringId === lead.id}
                                                title="Score Lead"
                                            >
                                                {isScoringId === lead.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Wand2 className="h-4 w-4 text-primary" />
                                                )}
                                                <span className="sr-only">Score Lead</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!scriptForLead && !!generatedScript} onOpenChange={(open) => !open && setScriptForLead(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Call Script for {scriptForLead?.name}</DialogTitle>
                        <DialogDescription>
                            AI-generated script to guide your conversation with {scriptForLead?.company}.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-4 border rounded-md">
                        {generatedScript ? (
                             <pre className="text-sm whitespace-pre-wrap font-sans">{generatedScript}</pre>
                        ) : (
                           <div className="flex justify-center items-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                           </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
