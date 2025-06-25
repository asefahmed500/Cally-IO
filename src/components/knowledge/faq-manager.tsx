'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useActionState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveFaq, deleteFaq, type Faq } from '@/app/knowledge/actions';
import { Label } from '../ui/label';

function FaqForm({ faq, onFormSuccess }: { faq?: Faq | null; onFormSuccess: () => void }) {
    const [state, formAction, isPending] = useActionState(saveFaq, null);
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
            <input type="hidden" name="id" value={faq?.$id || ''} />
            <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input id="question" name="question" placeholder="e.g., What is your return policy?" defaultValue={faq?.question} required />
                {state?.errors?.question && <p className="text-sm text-destructive">{state.errors.question[0]}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="answer">Answer</Label>
                <Textarea id="answer" name="answer" placeholder="e.g., We offer a 30-day money back guarantee..." className="min-h-32" defaultValue={faq?.answer} required />
                {state?.errors?.answer && <p className="text-sm text-destructive">{state.errors.answer[0]}</p>}
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {faq ? 'Save Changes' : 'Create FAQ'}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function FaqManager({ initialFaqs }: { initialFaqs: Faq[] }) {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [selectedFaq, setSelectedFaq] = React.useState<Faq | null>(null);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [isDeleting, startDeleteTransition] = useTransition();

    const handleEdit = (faq: Faq) => {
        setSelectedFaq(faq);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (faqId: string) => {
        setDeleteTargetId(faqId);
        setIsAlertOpen(true);
    }
    
    const handleDeleteConfirm = () => {
        if (!deleteTargetId) return;

        startDeleteTransition(async () => {
            const result = await deleteFaq(deleteTargetId);
            if (result.status === 'success') {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
            setIsAlertOpen(false);
            setDeleteTargetId(null);
        });
    }

    return (
        <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
                {initialFaqs.length > 0 ? initialFaqs.map(faq => (
                    <AccordionItem value={faq.$id} key={faq.$id}>
                        <AccordionTrigger className="hover:no-underline">
                            <span className="text-left flex-1 pr-4">{faq.question}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                {faq.answer}
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(faq)} disabled={isDeleting}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(faq.$id)} disabled={isDeleting}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No FAQs have been created yet.</p>
                )}
            </Accordion>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => setSelectedFaq(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New FAQ
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedFaq ? 'Edit FAQ' : 'Create New FAQ'}</DialogTitle>
                        <DialogDescription>
                            {selectedFaq ? 'Update the question and answer for this FAQ.' : 'Add a new question and answer to the knowledge base.'}
                        </DialogDescription>
                    </DialogHeader>
                    <FaqForm faq={selectedFaq} onFormSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
            
             <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this FAQ from the knowledge base. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Yes, delete FAQ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    