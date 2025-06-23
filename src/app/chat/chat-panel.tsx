"use client"

import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Send, User, Bot } from 'lucide-react'
import { accurateComprehensiveAnswers } from '@/ai/flows/ai-agent'
import type { AccurateComprehensiveAnswersOutput } from '@/ai/flows/ai-agent'
import { generateCallScript } from '@/ai/flows/script-generator'
import type { GenerateCallScriptOutput } from '@/ai/flows/script-generator'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Message {
    role: 'user' | 'assistant'
    content: string
    sources?: string[]
}

export function ChatPanel() {
    const { toast } = useToast()
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    // AI Assistant state
    const [sessionId, setSessionId] = useState('')
    const [assistantLoading, setAssistantLoading] = useState(false)
    const [assistantInput, setAssistantInput] = useState({ query: '', companyDocs: '' })
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hi! I'm your AI assistant. How can I help you today?",
        }
    ])

    // Script Generator state
    const [scriptLoading, setScriptLoading] = useState(false)
    const [scriptInput, setScriptInput] = useState({ companyDocuments: '', conversationHistory: '', leadProfile: '' })
    const [scriptResult, setScriptResult] = useState<GenerateCallScriptOutput | null>(null)

    useEffect(() => {
        // Generate a unique session ID for the chat when the component mounts.
        setSessionId(crypto.randomUUID())
    }, [])

    useEffect(() => {
        // Scroll to the bottom of the chat on new messages
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const handleAssistantInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setAssistantInput({ ...assistantInput, [e.target.name]: e.target.value })
    }

    const handleScriptInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setScriptInput({ ...scriptInput, [e.target.name]: e.target.value })
    }

    const handleAssistantSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!assistantInput.query.trim() || !sessionId) {
            return
        }
        setAssistantLoading(true)
        
        const newUserMessage: Message = { role: 'user', content: assistantInput.query };
        setMessages(prev => [...prev, newUserMessage]);
        
        const currentQuery = assistantInput.query;
        setAssistantInput(prev => ({ ...prev, query: '' })); // Clear input immediately

        try {
            const result = await accurateComprehensiveAnswers({ ...assistantInput, query: currentQuery, sessionId })
            const newAssistantMessage: Message = { role: 'assistant', content: result.answer, sources: result.sources };
            setMessages(prev => [...prev, newAssistantMessage]);
        } catch (error) {
            console.error(error)
            const errorMessage: Message = { role: 'assistant', content: "Sorry, I ran into an error. Please try again." };
            setMessages(prev => [...prev, errorMessage]);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate answer.' })
        } finally {
            setAssistantLoading(false)
        }
    }

    const handleScriptSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!scriptInput.leadProfile) {
            toast({ variant: 'destructive', title: 'Lead Profile is required.' })
            return
        }
        setScriptLoading(true)
        setScriptResult(null)
        try {
            const result = await generateCallScript(scriptInput)
            setScriptResult(result)
        } catch (error) {
            console.error(error)
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate script.' })
        } finally {
            setScriptLoading(false)
        }
    }

    return (
        <Tabs defaultValue="assistant" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
                <TabsTrigger value="generator">Script Generator</TabsTrigger>
            </TabsList>
            <TabsContent value="assistant">
                <Card className="flex flex-col h-[75vh]">
                    <CardHeader>
                        <CardTitle>AI Assistant</CardTitle>
                        <CardDescription>A conversational agent with web search and memory.</CardDescription>
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
                                        <div className={cn("max-w-[75%] rounded-lg p-3", message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                            {message.sources && message.sources.length > 0 && (
                                                <div className="mt-2 border-t pt-2">
                                                    <h4 className="font-semibold text-xs mb-1">Sources:</h4>
                                                    <ul className="list-disc pl-4 space-y-1">
                                                        {message.sources.map((source, i) => <li key={i} className="text-xs opacity-80">{source}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                         {message.role === 'user' && (
                                            <Avatar className="h-8 w-8 border">
                                                <AvatarFallback><User size={20} /></AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                {assistantLoading && (
                                     <div className="flex items-start gap-4">
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarFallback><Bot size={20} className="text-primary"/></AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[75%] rounded-lg p-3 bg-muted flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm text-muted-foreground">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="pt-4 border-t">
                         <form onSubmit={handleAssistantSubmit} className="flex w-full items-start gap-4">
                            <Textarea
                                id="query"
                                name="query"
                                placeholder="Ask the AI assistant anything..."
                                value={assistantInput.query}
                                onChange={handleAssistantInputChange}
                                required
                                className="flex-1 resize-none"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAssistantSubmit(e);
                                    }
                                }}
                            />
                            <Button type="submit" size="icon" className="shrink-0" disabled={assistantLoading || !assistantInput.query.trim()}>
                                <Send className="h-4 w-4" />
                                <span className="sr-only">Send message</span>
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="generator">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Script Generator</CardTitle>
                        <CardDescription>Create personalized call scripts for qualified leads.</CardDescription>
                    </CardHeader>
                     <form onSubmit={handleScriptSubmit}>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="companyDocuments_script">Company Documents</Label>
                                <Textarea id="companyDocuments_script" name="companyDocuments" placeholder="Paste relevant product/company info here..." value={scriptInput.companyDocuments} onChange={handleScriptInputChange} rows={3} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="conversationHistory">Conversation History</Label>
                                <Textarea id="conversationHistory" name="conversationHistory" placeholder="Paste chat history here..." value={scriptInput.conversationHistory} onChange={handleScriptInputChange} rows={5} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="leadProfile">Lead Profile</Label>
                                <Textarea id="leadProfile" name="leadProfile" placeholder="e.g., 'John Doe, interested in Enterprise Plan...'" value={scriptInput.leadProfile} onChange={handleScriptInputChange} required />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={scriptLoading}>
                                {scriptLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate Script
                            </Button>
                        </CardFooter>
                    </form>
                    {scriptResult && (
                        <CardContent>
                            <h3 className="font-semibold text-lg mb-2">Generated Script</h3>
                            <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/50">
                                <p className="whitespace-pre-wrap">{scriptResult.callScript}</p>
                            </ScrollArea>
                        </CardContent>
                    )}
                </Card>
            </TabsContent>
        </Tabs>
    )
}
