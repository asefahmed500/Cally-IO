
"use client"

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Newspaper } from 'lucide-react'
import { generateNewsBriefing } from '@/ai/flows/ai-agent'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'

export function BriefingPanel() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [briefing, setBriefing] = useState<string | null>(null)

    const handleGenerateBriefing = useCallback(async () => {
        setLoading(true)
        setBriefing(null)
        
        try {
            // In a real app, these interests would come from user settings.
            const interests = ["Technology", "Artificial Intelligence", "Global Economy"];
            const result = await generateNewsBriefing({ interests });
            setBriefing(result.briefing);
        } catch (error) {
            console.error(error)
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate briefing.' })
        } finally {
            setLoading(false)
        }
    }, [toast]);


    return (
        <Card className="flex flex-col h-full min-h-[60vh]">
            <CardHeader>
                <CardTitle>Briefing Studio</CardTitle>
                <CardDescription>Your personalized news summary, powered by AI.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-1">
                        {loading && (
                             <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                                <Loader2 className="h-12 w-12 animate-spin" />
                                <p>Generating your briefing...</p>
                                <p className="text-sm">This may take a moment.</p>
                            </div>
                        )}

                        {!loading && !briefing && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                <Newspaper className="h-16 w-16 text-muted-foreground" />
                                <h3 className="text-xl font-semibold">Ready for your news?</h3>
                                <p className="text-muted-foreground">Click the button below to generate your personalized briefing.</p>
                            </div>
                        )}

                        {briefing && (
                             <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-muted p-4">
                                {briefing}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="pt-4 border-t">
                 <Button onClick={handleGenerateBriefing} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Newspaper className="mr-2 h-4 w-4" />}
                    {loading ? 'Generating...' : 'Generate New Briefing'}
                </Button>
            </CardFooter>
        </Card>
    )
}
