"use client"

import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from 'lucide-react'
import { accurateComprehensiveAnswers } from '@/ai/flows/ai-agent'
import type { AccurateComprehensiveAnswersOutput } from '@/ai/flows/ai-agent'
import { generateCallScript } from '@/ai/flows/script-generator'
import type { GenerateCallScriptOutput } from '@/ai/flows/script-generator'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ChatPanel() {
    const { toast } = useToast()
    
    // AI Assistant state
    const [assistantLoading, setAssistantLoading] = useState(false)
    const [assistantInput, setAssistantInput] = useState({ query: '', companyDocs: '' })
    const [assistantResult, setAssistantResult] = useState<AccurateComprehensiveAnswersOutput | null>(null)

    // Script Generator state
    const [scriptLoading, setScriptLoading] = useState(false)
    const [scriptInput, setScriptInput] = useState({ companyDocuments: '', conversationHistory: '', leadProfile: '' })
    const [scriptResult, setScriptResult] = useState<GenerateCallScriptOutput | null>(null)

    const handleAssistantInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setAssistantInput({ ...assistantInput, [e.target.name]: e.target.value })
    }

    const handleScriptInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setScriptInput({ ...scriptInput, [e.target.name]: e.target.value })
    }

    const handleAssistantSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!assistantInput.query) {
            toast({ variant: 'destructive', title: 'Query is required.' })
            return
        }
        setAssistantLoading(true)
        setAssistantResult(null)
        try {
            const result = await accurateComprehensiveAnswers(assistantInput)
            setAssistantResult(result)
        } catch (error) {
            console.error(error)
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
                <Card>
                    <CardHeader>
                        <CardTitle>AI Assistant</CardTitle>
                        <CardDescription>Get answers based on documents and real-time web search.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleAssistantSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="query">Customer Query</Label>
                                <Textarea id="query" name="query" placeholder="e.g., 'What are your pricing plans?'" value={assistantInput.query} onChange={handleAssistantInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyDocs">Company Documents (Context)</Label>
                                <Textarea id="companyDocs" name="companyDocs" placeholder="Paste relevant company info here..." value={assistantInput.companyDocs} onChange={handleAssistantInputChange} rows={5} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={assistantLoading}>
                                {assistantLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate Answer
                            </Button>
                        </CardFooter>
                    </form>
                    {assistantResult && (
                         <CardContent>
                            <h3 className="font-semibold text-lg mb-2">Generated Answer</h3>
                            <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/50">
                                <p className="whitespace-pre-wrap">{assistantResult.answer}</p>
                                {assistantResult.sources && assistantResult.sources.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-semibold">Sources:</h4>
                                        <ul className="list-disc pl-5">
                                            {assistantResult.sources.map((source, i) => <li key={i} className="text-sm text-muted-foreground">{source}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    )}
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
                                <Label htmlFor="leadProfile">Lead Profile</Label>
                                <Textarea id="leadProfile" name="leadProfile" placeholder="e.g., 'John Doe, interested in Enterprise Plan...'" value={scriptInput.leadProfile} onChange={handleScriptInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="conversationHistory">Conversation History</Label>
                                <Textarea id="conversationHistory" name="conversationHistory" placeholder="Paste chat history here..." value={scriptInput.conversationHistory} onChange={handleScriptInputChange} rows={5} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="companyDocuments_script">Company Documents</Label>
                                <Textarea id="companyDocuments_script" name="companyDocuments" placeholder="Paste relevant product/company info here..." value={scriptInput.companyDocuments} onChange={handleScriptInputChange} rows={3} />
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
