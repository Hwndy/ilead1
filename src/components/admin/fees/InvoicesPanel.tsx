import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Receipt, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchStudentClassMap } from '@/lib/class-roster';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

const db = supabase as any;
const TERMS = ['First Term', 'Second Term', 'Third Term'];

type Invoice = {
  id: string; student_id: string; academic_year: string; term: string;
  total_amount: number; amount_paid: number; status: string;
};
type Item = { id: string; invoice_id: string; description: string; amount: number; is_optional: boolean; selected: boolean };

export const InvoicesPanel: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [running, setRunning] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [studentNames, setStudentNames] = useState<Map<string, string>>(new Map());
  const [classNames, setClassNames] = useState<Map<string, string>>(new Map());
  const [year, setYear] = useState('2026/2027');
  const [term, setTerm] = useState(TERMS[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.from('student_invoices').select('*').order('issued_at', { ascending: false });
    if (error) { setSetupNeeded(true); setLoading(false); return; }
    setSetupNeeded(false);
    setInvoices(data || []);

    const { data: itemData } = await db.from('invoice_items').select('*');
    setItems(itemData || []);

    const { data: students } = await db.from('students').select('id, user_id, admission_number').is('archived_at', null);
    const userIds = (students || []).map((s: any) => s.user_id).filter(Boolean);
    const nameByUser = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await db.from('profiles').select('user_id, full_name').in('user_id', userIds);
      (profs || []).forEach((p: any) => nameByUser.set(p.user_id, p.full_name));
    }
    setStudentNames(new Map((students || []).map((s: any) => [s.id, (s.user_id && nameByUser.get(s.user_id)) || s.admission_number || 'Unnamed student'])));
    try {
      const classMap = await fetchStudentClassMap();
      setClassNames(new Map(Array.from(classMap.entries()).map(([id, c]) => [id, c.class_name])));
    } catch { /* class names are optional here */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(['student_invoices', 'invoice_items'], () => load(), 'invoices-panel');

  const runBilling = async () => {
    setRunning(true);
    try {
      const [{ data: fees }, { data: rules }, { data: students }] = await Promise.all([
        db.from('fees').select('*').eq('is_active', true),
        db.from('fee_rules').select('*').eq('is_active', true),
        db.from('students').select('id, campus_id, arm_id, is_boarder').is('archived_at', null),
      ]);
      const classMap = await fetchStudentClassMap();
      const feeById = new Map<string, any>((fees || []).map((f: any) => [f.id, f]));

      let created = 0, skipped = 0;
      for (const s of students || []) {
        const classId = classMap.get(s.id)?.class_id || null;
        const type = s.is_boarder ? 'boarding' : 'day';
        const matched = (rules || []).filter((r: any) =>
          (!r.campus_id || r.campus_id === s.campus_id) &&
          (!r.class_id || r.class_id === classId) &&
          (!r.arm_id || r.arm_id === s.arm_id) &&
          (!r.student_type || r.student_type === type) &&
          (!r.term || r.term === term) &&
          (!r.academic_year || r.academic_year === year));
        const feeIds = Array.from(new Set(matched.map((r: any) => r.fee_id)));
        if (feeIds.length === 0) { skipped++; continue; }

        const { data: existing } = await db.from('student_invoices')
          .select('id').eq('student_id', s.id).eq('academic_year', year).eq('term', term).maybeSingle();
        if (existing?.id) { skipped++; continue; }

        const lines = feeIds.map(id => feeById.get(id)).filter(Boolean);
        const total = lines.filter((f: any) => !f.is_optional).reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0);
        const { data: invoice, error } = await db.from('student_invoices')
          .insert({ student_id: s.id, academic_year: year, term, total_amount: total })
          .select('id').single();
        if (error || !invoice) { continue; }
        await db.from('invoice_items').insert(lines.map((f: any) => ({
          invoice_id: invoice.id,
          fee_id: f.id,
          description: f.name,
          amount: Number(f.amount || 0),
          is_optional: f.is_optional,
          selected: !f.is_optional,
        })));
        created++;
      }
      toast({ title: 'Billing run finished', description: `${created} invoice(s) created, ${skipped} student(s) skipped.` });
      load();
    } catch (e: any) {
      toast({ title: 'Billing run failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const toggleOptional = async (item: Item) => {
    const { error } = await db.from('invoice_items').update({ selected: !item.selected }).eq('id', item.id);
    if (error) { toast({ title: 'Could not update the invoice', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const visible = useMemo(() => invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search.trim()) return (studentNames.get(i.student_id) || '').toLowerCase().includes(search.toLowerCase());
    return true;
  }), [invoices, statusFilter, search, studentNames]);

  const totals = useMemo(() => ({
    billed: visible.reduce((s, i) => s + Number(i.total_amount || 0), 0),
    paid: visible.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
  }), [visible]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (setupNeeded) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>The billing tables are not in the database yet. Run db/phase4-billing.sql in your database SQL editor.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Create termly invoices</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Academic year</Label><Input className="w-40" value={year} onChange={e => setYear(e.target.value)} /></div>
          <div>
            <Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={runBilling} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            {running ? 'Working…' : 'Run billing'}
          </Button>
          <p className="text-xs text-muted-foreground">Students who already have an invoice for this term are left untouched.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search student" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Unpaid</SelectItem>
            <SelectItem value="part_paid">Part paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          Billed ₦{totals.billed.toLocaleString()} · Paid ₦{totals.paid.toLocaleString()}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {visible.map(inv => {
            const lines = items.filter(i => i.invoice_id === inv.id);
            return (
              <div key={inv.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3 cursor-pointer" onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium">{studentNames.get(inv.student_id) || 'Unknown student'}</p>
                    <p className="text-xs text-muted-foreground">{classNames.get(inv.student_id) || '—'} · {inv.term} {inv.academic_year}</p>
                  </div>
                  <span className="text-sm">₦{Number(inv.total_amount).toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">paid ₦{Number(inv.amount_paid).toLocaleString()}</span>
                  <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'part_paid' ? 'secondary' : 'destructive'}>
                    {inv.status === 'paid' ? 'Paid' : inv.status === 'part_paid' ? 'Part paid' : inv.status === 'cancelled' ? 'Cancelled' : 'Unpaid'}
                  </Badge>
                </div>
                {expanded === inv.id && (
                  <div className="mt-3 space-y-1">
                    {lines.map(line => (
                      <div key={line.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                        <span>{line.description}{line.is_optional && <Badge variant="outline" className="ml-2">Optional</Badge>}</span>
                        <span className="flex items-center gap-3">
                          ₦{Number(line.amount).toLocaleString()}
                          {line.is_optional && (
                            <Button size="sm" variant="outline" onClick={() => toggleOptional(line)}>
                              {line.selected ? 'Remove' : 'Add'}
                            </Button>
                          )}
                        </span>
                      </div>
                    ))}
                    {lines.length === 0 && <p className="text-sm text-muted-foreground">No items on this invoice.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <p className="p-6 text-sm text-muted-foreground">No invoices yet — run billing above.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPanel;
