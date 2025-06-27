'use client';

import * as React from 'react';
import { getUsageStatistics, type UsageStatistic } from '@/app/settings/analytics_actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Book, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
           <p className="font-bold text-primary">{`${label}`}</p>
           <p className="text-sm text-muted-foreground">{`Used in ${payload[0].value} conversations`}</p>
        </div>
      );
    }
    return null;
  };

export function UsageStatistics() {
    const [stats, setStats] = React.useState<UsageStatistic[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchStats = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getUsageStatistics();
            setStats(data);
        } catch (e: any) {
            setError("Failed to load statistics.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Book />
                        <CardTitle>Document Usage Statistics</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchStats} disabled={isLoading}>
                        <RefreshCw className={isLoading ? "animate-spin" : ""} />
                    </Button>
                </div>
                <CardDescription>Insights into which documents are most frequently used by the AI to answer user questions.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
                 {isLoading ? (
                    <div className="text-center text-muted-foreground h-full flex items-center justify-center">Loading statistics...</div>
                ) : error ? (
                    <div className="text-center text-destructive h-full flex items-center justify-center">{error}</div>
                ) : stats.length === 0 ? (
                    <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                        <p>No usage data available yet. Data will appear here after the AI uses documents to answer questions.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis 
                                dataKey="fileName" 
                                type="category" 
                                width={120} 
                                tick={{fontSize: 12}} 
                                tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
