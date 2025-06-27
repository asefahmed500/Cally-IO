
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsChartProps {
    data: {
        name: string;
        good: number;
        bad: number;
    }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {label}
              </span>
            </div>
            {payload.map((item: any) => (
               <div key={item.name} className="flex flex-col space-y-1 text-right">
                 <span className="text-[0.70rem] uppercase" style={{color: item.color}}>{item.name}</span>
                 <span className="font-bold" style={{color: item.color}}>{item.value.toLocaleString()}</span>
               </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Feedback Breakdown</CardTitle>
        <CardDescription>A summary of feedback received on AI responses.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
           <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Legend wrapperStyle={{fontSize: "14px"}} iconSize={10} />
              <Bar dataKey="good" fill="hsl(var(--primary))" name="Good" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bad" fill="hsl(var(--destructive))" name="Bad" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
