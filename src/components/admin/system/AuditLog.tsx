import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Download, RefreshCw, ShieldAlert, Activity, Users, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  table_name: string | null;
  row_id: string | null;
  before_data: any;
  after_data: any;
  metadata: any;
  created_at: string;
}

const PAGE_SIZE = 50;

const RANGES: Record<string, number | null> = {
  today: 0,
  week: 7,
  month: 30,
  quarter: 90,
  all: null,
};

const rangeStart = (key: string) => {
  const days = RANGES[key];
  if (days === null || days === undefined) return null;
  const d = new Date();
  if (days === 0) d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - days);
  return d.toISOString();
};

const actionTone = (action: string) => {
  if (/DELETE|failed|denied/i.test(action)) return 'destructive';
  if (/INSERT|created|sent/i.test(action)) return 'default';
  return 'secondary';
};

const prettyAction = (row: AuditRow) => {
  switch (row.action) {
    case 'INSERT': return `Created ${row.table_name ?? 'record'}`;
    case 'UPDATE': return `Updated ${row.table_name ?? 'record'}`;
    case 'DELETE': return `Deleted ${row.table_name ?? 'record'}`;
    default: return row.action.replace(/_/g, ' ');
  }
};

export const AuditLog: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('week');
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const { toast } = useToast();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      const from = rangeStart(rangeFilter);
      if (from) query = query.gte('created_at', from);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);

      const { data, error } = await query;
      if (error) throw error;

      const list = (data || []) as AuditRow[];
      setHasMore(list.length > PAGE_SIZE);
      setRows(list.slice(0, PAGE_SIZE));
      setTables((prev) => {
        const next = new Set(prev);
        list.forEach((r) => r.table_name && next.add(r.table_name));
        return Array.from(next).sort();
      });
    } catch (error: any) {
      toast({
        title: 'Could not load the audit log',
        description: error.message?.includes('permission')
          ? 'Only administrators can view the audit log.'
          : error.message,
        variant: 'destructive',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, rangeFilter, actionFilter, tableFilter, toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { setPage(0); }, [rangeFilter, actionFilter, tableFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.actor_email, r.action, r.table_name, r.row_id, JSON.stringify(r.metadata ?? {})]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    people: new Set(rows.map((r) => r.actor_email).filter(Boolean)).size,
    deletions: rows.filter((r) => r.action === 'DELETE').length,
    tables: new Set(rows.map((r) => r.table_name).filter(Boolean)).size,
  }), [rows]);

  const exportCsv = () => {
    const header = ['When', 'Person', 'Action', 'Area', 'Record', 'Details'];
    const lines = filtered.map((r) => [
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
      r.actor_email ?? 'System',
      prettyAction(r),
      r.table_name ?? '',
      r.row_id ?? '',
      JSON.stringify(r.metadata ?? {}),
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Recorded actions', value: stats.total, icon: Activity },
          { label: 'People involved', value: stats.people, icon: Users },
          { label: 'Areas touched', value: stats.tables, icon: FileText },
          { label: 'Deletions', value: stats.deletions, icon: ShieldAlert },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </div>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Audit log</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search person, action, record"
                className="pl-8 w-56"
              />
            </div>
            <Select value={rangeFilter} onValueChange={setRangeFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchRows} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!loading && !filtered.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No activity recorded for this period.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">{row.actor_email || 'System'}</TableCell>
                    <TableCell>
                      <Badge variant={actionTone(row.action) as any}>{prettyAction(row)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.table_name?.replace(/_/g, ' ') || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                      {row.row_id || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">Page {page + 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected ? prettyAction(selected) : ''}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">When</span>
                <span>{format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm:ss')}</span>
                <span className="text-muted-foreground">Person</span>
                <span>{selected.actor_email || 'System'}</span>
                <span className="text-muted-foreground">Area</span>
                <span>{selected.table_name?.replace(/_/g, ' ') || '—'}</span>
                <span className="text-muted-foreground">Record</span>
                <span className="break-all">{selected.row_id || '—'}</span>
              </div>
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div>
                  <p className="font-medium mb-1">Details</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              )}
              {selected.before_data && (
                <div>
                  <p className="font-medium mb-1">Before</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{JSON.stringify(selected.before_data, null, 2)}</pre>
                </div>
              )}
              {selected.after_data && (
                <div>
                  <p className="font-medium mb-1">After</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{JSON.stringify(selected.after_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AuditLog;
