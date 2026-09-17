import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye, AlertTriangle, Banknote, RefreshCw } from 'lucide-react';
import { StudentBalanceDrawer } from './StudentBalanceDrawer';
import { RecordCashPaymentDialog, CashPaymentStudent } from './RecordCashPaymentDialog';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { fetchPlacementMap, fetchStructureOptions, CampusOption } from '@/lib/student-placement';
import { fetchInvoicedTotals, fetchCreditTotals } from '@/lib/student-billing';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string; name: string; admission: string;
  class_id: string | null; class_name: string;
  campus_id: string | null; campus_name: string; arm_name: string;
  billed: number; paid: number; credit: number; outstanding: number; invoiced: boolean;
}

export const StudentBalances: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [campusFilter, setCampusFilter] = useState('ALL');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [payFor, setPayFor] = useState<CashPaymentStudent | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stsRes, clsRes, fsRes, paysRes, placementMap, invoicedMap, creditMap, structure] = await Promise.all([
        supabase.from('students').select('id, admission_number, user_id').is('archived_at', null),
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('fee_structures').select('id, amount, class_id, is_active'),
        supabase.from('fee_payments').select('student_id, amount_paid, status').eq('status', 'completed'),
        fetchPlacementMap(),
        fetchInvoicedTotals(),
        fetchCreditTotals(),
        fetchStructureOptions(),
      ]);
      const firstError = stsRes.error || clsRes.error || fsRes.error || paysRes.error;
      if (firstError) throw firstError;

      setClasses((clsRes.data || []) as any);
      setCampuses(structure.campuses);
      const activeFees = (fsRes.data || []).filter((f: any) => f.is_active !== false);

      const userIds = [...new Set((stsRes.data || []).map((s: any) => s.user_id).filter(Boolean))];
      let nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }

      const paidMap: Record<string, number> = {};
      (paysRes.data || []).forEach((p: any) => { paidMap[p.student_id] = (paidMap[p.student_id] || 0) + Number(p.amount_paid || 0); });

      const out: Row[] = (stsRes.data || []).map((s: any) => {
        const placement = placementMap.get(s.id);
        const classId = placement?.class_id || null;
        const fallbackBilled = activeFees
          .filter((f: any) => !f.class_id || f.class_id === classId)
          .reduce((a: number, b: any) => a + Number(b.amount), 0);
        const invoiced = invoicedMap.get(s.id);
        const billed = invoiced !== undefined ? invoiced : fallbackBilled;
        const paid = paidMap[s.id] || 0;
        const credit = creditMap.get(s.id) || 0;
        return {
          id: s.id,
          name: nameMap.get(s.user_id) || s.admission_number || 'Unnamed student',
          admission: s.admission_number || '',
          class_id: classId,
          class_name: placement?.class_name || '',
          campus_id: placement?.campus_id || null,
          campus_name: placement?.campus_name || '',
          arm_name: placement?.arm_name || '',
          billed,
          paid,
          credit,
          outstanding: Math.max(0, billed - paid - credit),
          invoiced: invoiced !== undefined,
        };
      });
      setRows(out);
    } catch (e: any) {
      setError(e.message || 'Could not load student balances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRealtimeRefresh(['fee_payments', 'fee_structures', 'students'], load, 'fees-balances');

  const filtered = useMemo(() => {
    return rows.filter(r =>
      (classFilter === 'ALL' || r.class_id === classFilter) &&
      (campusFilter === 'ALL' || r.campus_id === campusFilter) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.admission.toLowerCase().includes(q.toLowerCase()))
    );
  }, [rows, q, classFilter, campusFilter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Student Balances</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button size="sm" onClick={() => setPayFor({ id: '', name: '' })}><Banknote className="h-4 w-4 mr-1" />Record payment</Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Search name or admission #" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {campuses.length > 0 && (
            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All campuses</SelectItem>
                {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error} <Button variant="link" className="px-1 h-auto" onClick={load}>Try again</Button></AlertDescription>
          </Alert>
        )}
        {loading ? <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Class</TableHead>
              <TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.admission}</div></TableCell>
                  <TableCell>
                    {r.class_name ? (
                      <>
                        <div>{[r.class_name, r.arm_name].filter(Boolean).join(' ')}</div>
                        {r.campus_name && <div className="text-xs text-muted-foreground">{r.campus_name}</div>}
                      </>
                    ) : <span className="text-xs text-muted-foreground">Not placed</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {NGN(r.billed)}
                    {!r.invoiced && <div className="text-[10px] text-muted-foreground">not invoiced yet</div>}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {NGN(r.paid)}
                    {r.credit > 0 && <div className="text-[10px] text-muted-foreground">+{NGN(r.credit)} credit</div>}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{NGN(r.outstanding)}</TableCell>
                  <TableCell>{r.outstanding <= 0 ? <Badge>Cleared</Badge> : r.paid > 0 ? <Badge variant="outline">Partial</Badge> : <Badge variant="destructive">Owing</Badge>}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setPayFor({ id: r.id, name: r.name, admission_number: r.admission })}><Banknote className="h-4 w-4"/></Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="h-4 w-4"/></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !error && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No students match</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
        {selected && <StudentBalanceDrawer studentId={selected.id} name={selected.name} admission={selected.admission} onClose={() => { setSelected(null); load(); }}/>}
        <RecordCashPaymentDialog
          open={payFor !== null}
          onOpenChange={(v) => { if (!v) setPayFor(null); }}
          student={payFor && payFor.id ? payFor : null}
          onSaved={load}
        />
      </CardContent>
    </Card>
  );
};
