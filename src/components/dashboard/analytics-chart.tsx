"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import React from "react"

export function AnalyticsChart() {
    const [data, setData] = React.useState<any[]>([]);

    React.useEffect(() => {
        setData([
            { name: "Jan", total: Math.floor(Math.random() * 50) + 50 },
            { name: "Feb", total: Math.floor(Math.random() * 50) + 60 },
            { name: "Mar", total: Math.floor(Math.random() * 50) + 70 },
            { name: "Apr", total: Math.floor(Math.random() * 50) + 80 },
            { name: "May", total: Math.floor(Math.random() * 50) + 90 },
            { name: "Jun", total: Math.floor(Math.random() * 50) + 100 },
            { name: "Jul", total: Math.floor(Math.random() * 50) + 110 },
          ]);
    }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Analytics</CardTitle>
        <CardDescription>Performance and success rates of automated calls.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--background))' }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        )}
      </CardContent>
    </Card>
  )
}
