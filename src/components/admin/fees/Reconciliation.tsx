import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload, RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

type PsTxn = { reference: string; amount: number; status: string; paid_at: string | null; customer_email: string | null; channel: string | null };
type FeeRow = { id: string; payment_reference: string | null; amount_paid: number; status: string; receipt_number: string | null; paid_at: string | null; created_at: string; student_id: string | null };
type MatchClass = 'consistent' | 'needs_update' | 'orphan_paystack' | 'orphan_local';
type Row = { key: string; klass: MatchClass; ps?: PsTxn; local?: FeeRow; reason?: string };

// Minimal CSV parser handling quoted values and commas
const parseCsv = (text: string): Record<string, string>[] => {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field !== '' || cur.length) { cur.push(field); lines.push(cur); cur = []; field = ''; }
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else field += c;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); lines.push(cur); }
  if (!lines.length) return [];
  const header = lines[0].map(h => h.trim().toLowerCase());
  return lines.slice(1).filter(r => r.some(v => v !== '')).map(r => {
    const o: Record<string, string> = {};
    header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
};

const pick = (r: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (r[k] != null && r[k] !== '') return r[k];
  return '';
};

const csvToTxns = (rows: Record<string, string>[]): PsTxn[] => rows.map(r => {
  const rawAmt = pick(r, ['amount', 'amount (ngn)', 'gross amount', 'amount ngn']).replace(/[₦,\s]/g, '');
  const amt = Number(rawAmt);
  return {
    reference: pick(r, ['reference', 'transaction reference', 'ref']),
    amount: isFinite(amt) ? amt : 0,
    status: (pick(r, ['status', 'transaction status']) || '').toLowerCase(),
    paid_at: pick(r, ['paid at', 'paidat', 'paid_at', 'transaction date', 'date']) || null,
    customer_email: pick(r, ['customer email', 'email', 'customer_email']) || null,
    channel: pick(r, ['channel']) || null,
  };
}).filter(t => t.reference);

const klassBadge = (k: MatchClass) => {
  if (k === 'consistent') return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1"/>Consistent</Badge>;
  if (k === 'needs_update') return <Badge className="bg-amber-500"><AlertTriangle className="h-3 w-3 mr-1"/>Needs update</Badge>;
  if (k === 'orphan_paystack') return <Badge variant="outline"><HelpCircle className="h-3 w-3 mr-1"/>Paystack only</Badge>;
  return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Unreconciled</Badge>;
};

export const Reconciliation: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [txns, setTxns] = useState<PsTxn[]>([]);
  const [locals, setLocals] = useState<FeeRow[]>([]);
  const [filter, setFilter] = useState<'all' | MatchClass>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLocals = async () => {
    const { data, error } = await supabase.from('fee_payments')
      .select('id, payment_reference, amount_paid, status, receipt_number, paid_at, created_at, student_id')
      .gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
      .order('created_at', { ascending: false }).limit(2000);
    if (error) throw error;
    setLocals((data || []) as any);
  };

  const fetchFromApi = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-reconcile', {
        body: { action: 'list', from, to },
      });
      if (error) throw error;
      setTxns((data?.transactions || []) as PsTxn[]);
      await loadLocals();
      toast({ title: 'Fetched', description: `${data?.transactions?.length || 0} Paystack transactions loaded` });
    } catch (e: any) {
      toast({ title: 'Fetch failed', description: e.message || 'Could not reach Paystack', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleCsv = async (f: File) => {
    setLoading(true);
    try {
      const text = await f.text();
      const parsed = csvToTxns(parseCsv(text));
      setTxns(parsed);
      await loadLocals();
      toast({ title: 'CSV loaded', description: `${parsed.length} rows parsed` });
    } catch (e: any) {
      toast({ title: 'CSV error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const rows: Row[] = useMemo(() => {
    const byRef = new Map(locals.filter(l => l.payment_reference).map(l => [l.payment_reference!.toLowerCase(), l]));
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const t of txns) {
      const local = byRef.get(t.reference.toLowerCase());
      if (!local) {
        out.push({ key: `ps:${t.reference}`, klass: 'orphan_paystack', ps: t });
      } else {
        seen.add(local.id);
        const psSuccess = t.status === 'success';
        const amountMatch = Math.round(Number(local.amount_paid) * 100) === Math.round(t.amount * 100);
        const localCompleted = local.status === 'completed';
        if (psSuccess && localCompleted && amountMatch) {
          out.push({ key: local.id, klass: 'consistent', ps: t, local });
        } else {
          const reasons: string[] = [];
          if (psSuccess && !localCompleted) reasons.push(`local status is ${local.status}`);
          if (!amountMatch) reasons.push('amount mismatch');
          if (psSuccess && localCompleted && !local.receipt_number) reasons.push('missing receipt');
          out.push({ key: local.id, klass: 'needs_update', ps: t, local, reason: reasons.join(', ') || 'differs' });
        }
      }
    }
    for (const l of locals) {
      if (seen.has(l.id)) continue;
      if (l.status === 'pending' || l.status === 'failed') {
        out.push({ key: l.id, klass: 'orphan_local', local: l, reason: `no matching Paystack txn in range` });
      }
    }
    return out;
  }, [txns, locals]);

  const visible = rows.filter(r => filter === 'all' ? true : r.klass === filter);
  const counts = useMemo(() => rows.reduce((a, r) => (a[r.klass] = (a[r.klass] || 0) + 1, a), {} as Record<string, number>), [rows]);

  const reconcile = async (reference: string, key: string) => {
    setBusyRow(key);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-reconcile', { body: { action: 'apply', reference } });
      if (error) throw error;
      toast({ title: 'Reconciled', description: `Receipt ${data?.receipt_number}` });
      await loadLocals();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusyRow(null); }
  };

  const markFailed = async (payment_id: string) => {
    setBusyRow(payment_id);
    try {
      const { error } = await supabase.functions.invoke('paystack-reconcile', {
        body: { action: 'mark_failed', payment_id, reason: 'No matching Paystack transaction' },
      });
      if (error) throw error;
      toast({ title: 'Marked failed' });
      await loadLocals();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusyRow(null); }
  };

  const reconcileAll = async () => {
    const targets = rows.filter(r => r.klass === 'needs_update' && r.ps);
    if (!targets.length) return;
    setBusyAll(true);
    let ok = 0, fail = 0;
    for (const t of targets) {
      try {
        const { error } = await supabase.functions.invoke('paystack-reconcile', { body: { action: 'apply', reference: t.ps!.reference } });
        if (error) throw error; ok++;
      } catch { fail++; }
    }
    await loadLocals();
    setBusyAll(false);
    toast({ title: 'Bulk reconcile done', description: `${ok} succeeded, ${fail} failed` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paystack Reconciliation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="api">
          <TabsList>
            <TabsTrigger value="api">From Paystack API</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          </TabsList>
          <TabsContent value="api" className="pt-3">
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              <Button onClick={fetchFromApi} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Fetch
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="csv" className="pt-3">
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1"><Label>Paystack CSV export</Label>
                <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsv(f); }} />
              </div>
              <p className="text-xs text-muted-foreground">Local records are pulled from {from} → {to}</p>
            </div>
          </TabsContent>
        </Tabs>

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {(['all','consistent','needs_update','orphan_paystack','orphan_local'] as const).map(k => (
                <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>
                  {k === 'all' ? `All (${rows.length})` : `${k.replace('_',' ')} (${counts[k] || 0})`}
                </Button>
              ))}
              <div className="ml-auto">
                <Button size="sm" onClick={reconcileAll} disabled={busyAll || !(counts.needs_update)}>
                  {busyAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : null}
                  Reconcile all amber ({counts.needs_update || 0})
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Paystack</TableHead>
                  <TableHead className="text-right">Local</TableHead>
                  <TableHead>Paid at</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visible.map(r => (
                    <TableRow key={r.key}>
                      <TableCell>{klassBadge(r.klass)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ps?.reference || r.local?.payment_reference || ''}</TableCell>
                      <TableCell className="text-right">{r.ps ? NGN(r.ps.amount) : ''}<div className="text-xs text-muted-foreground">{r.ps?.status || ''}</div></TableCell>
                      <TableCell className="text-right">{r.local ? NGN(Number(r.local.amount_paid)) : ''}<div className="text-xs text-muted-foreground">{r.local?.status || ''}</div></TableCell>
                      <TableCell className="text-xs">{r.ps?.paid_at ? format(new Date(r.ps.paid_at), 'PP') : r.local?.paid_at ? format(new Date(r.local.paid_at), 'PP') : ''}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.reason || ''}</TableCell>
                      <TableCell className="text-right">
                        {r.klass === 'needs_update' && r.ps && (
                          <Button size="sm" disabled={busyRow === r.key} onClick={() => reconcile(r.ps!.reference, r.key)}>
                            {busyRow === r.key ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Reconcile'}
                          </Button>
                        )}
                        {r.klass === 'orphan_local' && r.local && (
                          <Button size="sm" variant="outline" disabled={busyRow === r.key} onClick={() => markFailed(r.local!.id)}>
                            {busyRow === r.key ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Mark failed'}
                          </Button>
                        )}
                        {r.klass === 'orphan_paystack' && (
                          <span className="text-xs text-muted-foreground">Record manually</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {visible.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No rows for this filter</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {rows.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground pt-2">
            Fetch a date range from Paystack or upload a CSV to begin. The tool matches transactions to your fee payments by reference and flags any discrepancies.
          </p>
        )}
      </CardContent>
    </Card>
  );
};