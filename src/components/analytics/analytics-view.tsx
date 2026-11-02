'use client'

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Loader2, BarChart3, Bot, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { exportCallsCsv } from '@/app/analytics/actions';

type AnalyticsData = {
  totals: {
    calls: number;
    connected: number;
    answerRate: number;
    avgDurationSec: number;
    totalLeads: number;
    conversionRate: number;
    followUpCompletionRate: number;
    tasksTotal: number;
    tasksCompleted: number;
  };
  volumeByDay: { day: string; date: string; calls: number; connected: number }[];
  directionSplit: { INBOUND: number; OUTBOUND: number };
  aiVsHuman: { ai: number; human: number; unassigned: number };
  outcomeData: { name: string; value: number }[];
  funnel: { stage: string; count: number }[];
  agentPerformanceData: { name: string; type: string; calls: number; avgDurationSec: number }[];
  campaignPerformanceData: {
    name: string;
    status: string;
    contacts: number;
    completed: number;
    failed: number;
    calls: number;
    connected: number;
    connectRate: number;
  }[];
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
  'hsl(240 60% 60%)',
];

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
};

function formatDuration(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function AnalyticsView({
  data,
  canExport,
  filters,
  options,
}: {
  data: AnalyticsData;
  canExport: boolean;
  filters: { days: number; direction: string; from: string; to: string };
  options: {
    agents: { id: string; name: string }[];
    campaigns: { id: string; name: string }[];
    members: { id: string; name: string }[];
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams();
    params.set('range', String(filters.days));
    params.set('direction', value);
    router.push(`/analytics?${params.toString()}`);
  };

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportCallsCsv({
        from: filters.from,
        to: filters.to,
        direction: filters.direction,
      });
      if (result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cally-calls-${filters.from.split('T')[0]}-to-${filters.to.split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Export complete', description: 'Filtered call rows downloaded.' });
      } else {
        toast({ variant: 'destructive', title: 'Export failed', description: result.error });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(filters.days)} onValueChange={(v) => setFilter('range', v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.direction} onValueChange={(v) => setFilter('direction', v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All directions</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
          </SelectContent>
        </Select>
        {canExport && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport} disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            Export CSV
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Calls', value: data.totals.calls },
          { label: 'Connected', value: data.totals.connected },
          { label: 'Answer Rate', value: `${data.totals.answerRate}%` },
          { label: 'Avg Handling', value: formatDuration(data.totals.avgDurationSec) },
          { label: 'Conversion', value: `${data.totals.conversionRate}%` },
          { label: 'Follow-ups Done', value: `${data.totals.followUpCompletionRate}%` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-xl font-semibold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Call volume and connections</CardTitle>
          <CardDescription>Daily totals for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.volumeByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="connected" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inbound vs outbound</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Pie
                  data={[
                    { name: 'Inbound', value: data.directionSplit.INBOUND },
                    { name: 'Outbound', value: data.directionSplit.OUTBOUND },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  strokeWidth={1}
                >
                  {['hsl(var(--primary))', 'hsl(var(--muted-foreground))'].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI vs human handling</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Pie
                  data={[
                    { name: 'AI', value: data.aiVsHuman.ai },
                    { name: 'Human', value: data.aiVsHuman.human },
                    { name: 'Unassigned', value: data.aiVsHuman.unassigned },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  strokeWidth={1}
                >
                  {CHART_COLORS.map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.outcomeData.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No completed outcomes yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Pie
                    data={data.outcomeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    strokeWidth={1}
                  >
                    {data.outcomeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversion funnel</CardTitle>
            <CardDescription>All-time lead stage distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.funnel} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} className="text-xs" width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="hsl(var(--primary))" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Agent performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agent performance</CardTitle>
            <CardDescription>Volume only — not a quality measure</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agentPerformanceData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No calls in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.agentPerformanceData.map((agent) => (
                    <TableRow key={agent.name}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {agent.type === 'AI' ? <Bot className="size-3" /> : <User className="size-3" />}
                          {agent.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{agent.calls}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatDuration(agent.avgDurationSec)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Campaign effectiveness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaign effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Connected</TableHead>
                <TableHead className="text-right">Connect Rate</TableHead>
                <TableHead className="text-right">Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.campaignPerformanceData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    No campaigns yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.campaignPerformanceData.map((campaign) => (
                  <TableRow key={campaign.name}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge variant={campaign.status === 'RUNNING' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.contacts}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.calls}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.connected}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.connectRate}%</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.failed}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}