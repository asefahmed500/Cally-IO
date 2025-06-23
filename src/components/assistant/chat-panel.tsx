'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowUp, Bot, User, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

async function chatAction(prevState: any, formData: FormData): Promise<{ messages: Message[] }> {
    const query = formData.get('query') as string;
    if (!query) return { messages: [] };

    const userMessage: Message = { role: 'user', content: query };
    const newMessages: Message[] = [...prevState.messages, userMessage];

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        if (!response.body) throw new Error('No response body');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Request failed: ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantResponse = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            assistantResponse += decoder.decode(value, { stream: true });
            
            // This part is tricky as we can't update state mid-stream in a server action.
            // The full response will be added at the end.
        }
        
        newMessages.push({ role: 'assistant', content: assistantResponse });

    } catch (error: any) {
        console.error("Chat error:", error);
        newMessages.push({ role: 'assistant', content: `Sorry, something went wrong: ${error.message}` });
    }
    
    return { messages: newMessages };
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="icon" className="absolute bottom-2 right-2" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            <span className="sr-only">Send</span>
        </Button>
    );
}

export function ChatPanel() {
    const [messages, setMessages] = useState<Message[]>([]);
    const formRef = useRef<HTMLFormElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);
    
    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const query = formData.get('query') as string;

        if (!query.trim()) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
        
        formRef.current?.reset();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            if (!response.body) throw new Error('No response body');
             if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'An unknown error occurred.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg.role === 'assistant') {
                        lastMsg.content += chunk;
                    }
                    return newMsgs;
                });
            }
        } catch (error: any) {
             console.error("Chat error:", error);
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                 if (lastMsg.role === 'assistant') {
                    lastMsg.content = `Sorry, something went wrong. Please check the server logs for more details.`;
                }
                return newMsgs;
            });
            toast({
                variant: 'destructive',
                title: 'An error occurred',
                description: error.message,
            })
        }
    };


    return (
        <div className="flex flex-col h-full border rounded-lg">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-6">
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground">
                            <Bot className="mx-auto h-12 w-12" />
                            <p className="mt-2">Ask me anything about your documents!</p>
                        </div>
                    )}
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={cn(
                                'flex items-start gap-3',
                                message.role === 'user' ? 'justify-end' : 'justify-start'
                            )}
                        >
                            {message.role === 'assistant' && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                            )}
                            <div
                                className={cn(
                                    'max-w-prose rounded-lg px-4 py-2 whitespace-pre-wrap',
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                )}
                            >
                                {message.content || <Loader2 className="h-5 w-5 animate-spin" />}
                            </div>
                             {message.role === 'user' && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><User /></AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <div className="p-4 border-t">
                <form
                    ref={formRef}
                    onSubmit={handleFormSubmit}
                    className="relative"
                >
                    <Textarea
                        name="query"
                        placeholder="Ask a question about your documents..."
                        className="pr-12 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                formRef.current?.requestSubmit();
                            }
                        }}
                    />
                    <Button type="submit" size="icon" className="absolute bottom-3 right-3">
                        <ArrowUp />
                        <span className="sr-only">Send</span>
                    </Button>
                </form>
            </div>
        </div>
    );
}
