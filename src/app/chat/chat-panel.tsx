"use client"

import { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Send, User, Bot } from 'lucide-react'
import { researchAssistant } from '@/ai/flows/ai-agent'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

const SESSION_ID_KEY = 'cally-io-session-id';
const MESSAGES_KEY_PREFIX = 'cally-io-messages-';

export function ContentPanel() {
    const { toast } = useToast()
    const viewportRef = useRef<HTMLDivElement>(null);

    const [sessionId, setSessionId] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<Message[]>([])

    useEffect(() => {
        let storedSessionId = localStorage.getItem(SESSION_ID_KEY);
        if (!storedSessionId) {
            storedSessionId = crypto.randomUUID();
            localStorage.setItem(SESSION_ID_KEY, storedSessionId);
        }
        setSessionId(storedSessionId);

        const storedMessages = localStorage.getItem(`${MESSAGES_KEY_PREFIX}${storedSessionId}`);
        if (storedMessages) {
            setMessages(JSON.parse(storedMessages));
        } else {
            setMessages([
                {
                    role: 'assistant',
                    content: "Welcome to the Content Studio! What topic should I write about for you today?",
                }
            ]);
        }
    }, []);

    useEffect(() => {
        if (sessionId && messages.length > 0) {
            localStorage.setItem(`${MESSAGES_KEY_PREFIX}${sessionId}`, JSON.stringify(messages));
        }
    }, [messages, sessionId]);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);
    
    const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
    }

    const handleSubmit = useCallback(async (currentQuery: string) => {
        if (!currentQuery.trim() || !sessionId) {
            return
        }
        setLoading(true)
        
        const newUserMessage: Message = { role: 'user', content: currentQuery };
        setMessages(prev => [...prev, newUserMessage]);
        
        try {
            const result = await researchAssistant({ query: currentQuery, sessionId })
            const newAssistantMessage: Message = { role: 'assistant', content: result.answer };
            setMessages(prev => [...prev, newAssistantMessage]);
        } catch (error) {
            console.error(error)
            const errorMessage: Message = { role: 'assistant', content: "Sorry, I ran into an error. Please try again." };
            setMessages(prev => [...prev, errorMessage]);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate content.' })
        } finally {
            setLoading(false)
        }
    }, [toast, sessionId]);

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        const query = input;
        setInput('');
        handleSubmit(query);
    }

    return (
        <Card className="flex flex-col h-[75vh]">
            <CardHeader>
                <CardTitle>AI Content Writer</CardTitle>
                <CardDescription>Generate articles, blog posts, and more with the power of AI.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" viewportRef={viewportRef}>
                    <div className="space-y-4 p-6">
                        {messages.map((message, index) => (
                            <div key={index} className={cn("flex items-start gap-4", message.role === 'user' ? 'justify-end' : '')}>
                                {message.role === 'assistant' && (
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback><Bot size={20} className="text-primary" /></AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("max-w-[85%] rounded-lg p-3", message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                </div>
                                 {message.role === 'user' && (
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback><User size={20} /></AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                        {loading && (
                             <div className="flex items-start gap-4">
                                <Avatar className="h-8 w-8 border">
                                    <AvatarFallback><Bot size={20} className="text-primary"/></AvatarFallback>
                                </Avatar>
                                <div className="max-w-[75%] rounded-lg p-3 bg-muted flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Writing...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="pt-4 border-t">
                 <form onSubmit={handleFormSubmit} className="flex w-full items-start gap-4">
                    <Textarea
                        id="query"
                        name="query"
                        placeholder="e.g., Write a blog post about the benefits of AI in content creation..."
                        value={input}
                        onChange={handleInputChange}
                        required
                        className="flex-1 resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleFormSubmit(e);
                            }
                        }}
                    />
                    <Button type="submit" size="icon" className="shrink-0" disabled={loading || !input.trim()}>
                        <Sparkles className="h-4 w-4" />
                        <span className="sr-only">Generate Content</span>
                    </Button>
                </form>
            </CardFooter>
        </Card>
    )
}
