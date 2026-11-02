'use client'

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Log = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
};

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return '—';
  return Object.entries(metadata)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('  ');
}

function severity(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (/(delete|purge|removed|revoked)/i.test(action)) return 'destructive';
  if (/(created|invited|started)/i.test(action)) return 'default';
  if (/(updated|changed|login)/i.test(action)) return 'secondary';
  return 'outline';
}

export function AuditLogTable({
  logs,
  actions,
  users,
  currentPage,
  totalPages,
  filters,
}: {
  logs: Log[];
  actions: { action: string; count: number }[];
  users: { id: string; name: string }[];
  currentPage: number;
  totalPages: number;
  filters: { action: string; user: string };
}) {
  const router = useRouter();

  const apply = (key: 'action' | 'user', value: string) => {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value === 'all' ? '' : value };
    if (next.action) params.set('action', next.action);
    if (next.user) params.set('user', next.user);
    params.set('page', '1');
    router.push(`/settings/audit-log?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.action || 'all'} onValueChange={(v) => apply('action', v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a.action} value={a.action}>
                {a.action} ({a.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.user || 'all'} onValueChange={(v) => apply('user', v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No audit entries match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor?.name ?? <span className="text-muted-foreground">System</span>}
                      {log.actor?.name && (
                        <span className="block text-xs text-muted-foreground">{log.actor.email}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={severity(log.action)}>{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.entityType ?? '—'}
                      {log.entityId && <span className="block font-mono text-[10px]">{log.entityId}</span>}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground">
                      {formatMetadata(log.metadata)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(`/settings/audit-log?page=${currentPage - 1}`)}
          >
            <ChevronLeft />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(`/settings/audit-log?page=${currentPage + 1}`)}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      )}
    </div>
  );
}