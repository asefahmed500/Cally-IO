'use client';

import * as React from 'react';
import { getContentSuggestions, type ContentSuggestion } from '@/app/settings/analytics_actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Lightbulb, RefreshCw } from 'lucide-react';

export function ContentSuggestions() {
    const [suggestions, setSuggestions] = React.useState<ContentSuggestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchSuggestions = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getContentSuggestions();
            setSuggestions(data);
        } catch (e: any) {
            setError("Failed to load suggestions.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <Lightbulb />
                         <CardTitle>Content Suggestions</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchSuggestions} disabled={isLoading}>
                        <RefreshCw className={isLoading ? "animate-spin" : ""} />
                    </Button>
                </div>
                <CardDescription>AI-powered suggestions for new content based on user questions that were not answered effectively.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {isLoading ? (
                    <div className="text-center text-muted-foreground">Loading suggestions...</div>
                ) : error ? (
                    <div className="text-center text-destructive">{error}</div>
                ) : suggestions.length === 0 ? (
                    <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                        <p>No content suggestions available yet. Check back after users have interacted with the AI.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {suggestions.map((item) => (
                            <li key={item.prompt} className="text-sm border-b pb-2">
                                <p className="font-semibold text-primary">"{item.prompt}"</p>
                                <p className="text-xs text-muted-foreground">Asked {item.count} time(s). Consider creating an FAQ for this.</p>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
