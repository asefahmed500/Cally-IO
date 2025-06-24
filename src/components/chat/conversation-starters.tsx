'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

const starterPrompts = [
    "Tell me about the key features.",
    "How does pricing work?",
    "What kind of integrations do you support?",
    "Compare your product to a competitor.",
];

interface ConversationStartersProps {
    onStarterClick: (prompt: string) => void;
}

export function ConversationStarters({ onStarterClick }: ConversationStartersProps) {
    return (
        <div className="p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-center text-muted-foreground">
                Start a Conversation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {starterPrompts.map((prompt) => (
                    <Button
                        key={prompt}
                        variant="outline"
                        className="w-full h-auto py-3 text-left justify-start whitespace-normal"
                        onClick={() => onStarterClick(prompt)}
                    >
                        <Lightbulb className="mr-3 h-4 w-4 shrink-0" />
                        {prompt}
                    </Button>
                ))}
            </div>
        </div>
    );
}
