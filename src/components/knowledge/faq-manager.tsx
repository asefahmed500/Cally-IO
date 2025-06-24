'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface FaqItem {
    id: number;
    question: string;
    answer: string;
}

export function FaqManager() {
    const [faqs, setFaqs] = React.useState<FaqItem[]>([
        { id: 1, question: 'What is your return policy?', answer: 'We offer a 30-day money-back guarantee on all purchases.' },
        { id: 2, question: 'How do I track my order?', answer: 'You can track your order status from your account dashboard under "My Orders".' }
    ]);

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 space-y-4">
                     {faqs.map(faq => (
                        <div key={faq.id} className="p-3 border rounded-lg space-y-2 relative group">
                             <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <label className="text-sm font-medium">Question</label>
                            <Input defaultValue={faq.question} readOnly />
                            <label className="text-sm font-medium">Answer</label>
                            <Textarea defaultValue={faq.answer} readOnly className="min-h-20" />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Button disabled>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New FAQ
            </Button>
            <p className="text-sm text-muted-foreground">
                Note: FAQ management is not yet fully implemented. This is a UI placeholder.
            </p>
        </div>
    );
}
