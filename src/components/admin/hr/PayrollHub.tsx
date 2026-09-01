import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ArrowLeft, Download, Loader2, Printer, UserPlus, Plus, Trash2, CheckCircle2, Banknote, Lock } from 'lucide-react';
import { printNode } from '@/lib/print-node';
import { fetchSchoolBranding, DEFAULT_SCHOOL_BRANDING, SchoolBranding } from '@/lib/school-branding';

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

const num = (v: any) => Number(v || 0);

export interface PayComponent { name: string; amount: number }

interface Item {
  id: string;
  staff_id: string;
  basic_salary: number | null;
  gross_salary: number | null;
  allowances: PayComponent[];
  deductions: PayComponent[];
  net_pay: number | null;
  status: string | null;
  notes: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  payment_reference?: string | null;
  full_name?: string;
  employee_id?: string | null;
  designation?: string | null;
}

interface Period {
  id: string;
  period_month: string;
  status: string;
  pay_date: string | null;
  paid_at: string | null;
  closed_at: string | null;
  expense_id: string | null;
  notes: string | null;
}

const toList = (v: any): PayComponent[] => {
  if (Array.isArray(v)) return v.map((x: any) => ({ name: String(x?.name ?? 'Item'), amount: num(x?.amount) }));
  if (v && typeof v === 'object') return Object.entries(v).map(([name, amount]) => ({ name, amount: num(amount) }));
  if (num(v) > 0) return [{ name: 'General', amount: num(v) }];
  return [];
};
const sum = (list: PayComponent[]) => list.reduce((a, c) => a + num(c.amount), 0);
const computed = (i: Item) => {
  const allow = sum(i.allowances);
  const deduct = sum(i.deductions);
  const gross = num(i.basic_salary) + allow;
  return { allow, deduct, gross, net: gross - deduct };
};

const STATUS_FLOW: Record<string, { next?: string; label?: string }> = {
  draft: { next: 'approved', label: 'Approve' },
  processing: { next: 'approved', label: 'Approve' },
  approved: { next: 'paid', label: 'Mark paid' },
  paid: { next: 'closed', label: 'Close period' },
  closed: {},
};

export const PayrollHub: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [openPeriod, setOpenPeriod] = useState<Period | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [branding, setBranding] = useState<SchoolBranding>(DEFAULT_SCHOOL_BRANDING);

  // recurring components tab
  const [staffOptions, setStaffOptions] = useState<{ user_id: string; full_name: string }[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [compForm, setCompForm] = useState({ staff_id: '', name: '', kind: 'allowance', amount: '', is_percentage: false });

  const load = async () => {
    const { data } = await supabase.from('payroll_periods').select('*').order('period_month', { ascending: false });
    setPeriods((data || []) as any);
  };

  const loadStaffOptions = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['teacher', 'admin']);
    const ids = [...new Set(((roles as any[]) || []).map(r => r.user_id))];
    if (!ids.length) { setStaffOptions([]); return; }
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
    setStaffOptions((((profs as any[]) || []).map(p => ({ user_id: p.user_id, full_name: p.full_name || 'Unnamed' })))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  const loadComponents = async () => {
    const { data } = await supabase.from('salary_components').select('*').order('created_at', { ascending: false });
    setComponents((data as any[]) || []);
  };

  useEffect(() => {
    load();
    loadStaffOptions();
    loadComponents();
    fetchSchoolBranding().then(setBranding).catch(() => {});
  }, []);

  const loadItems = async (period: Period) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase.from('payroll_items').select('*').eq('period_id', period.id);
      if (error) throw error;
      const rows = (data as any[]) || [];
      const ids = [...new Set(rows.map(r => r.staff_id).filter(Boolean))];
      let nameMap = new Map<string, string>();
      let detailMap = new Map<string, any>();
      if (ids.length) {
        const [{ data: profs }, { data: details }] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', ids),
          supabase.from('staff_details').select('user_id, employee_id, designation, bank_details').in('user_id', ids),
        ]);
        nameMap = new Map(((profs as any[]) || []).map(p => [p.user_id, p.full_name]));
        detailMap = new Map(((details as any[]) || []).map(d => [d.user_id, d]));
      }
      setItems(rows.map(r => {
        const d = detailMap.get(r.staff_id) || {};
        return {
          ...r,
          allowances: toList(r.allowances),
          deductions: toList(r.deductions),
          basic_salary: r.basic_salary ?? r.gross_salary ?? 0,
          full_name: nameMap.get(r.staff_id) || 'Unknown',
          employee_id: d.employee_id || null,
          designation: d.designation || null,
          bank_name: r.bank_name || d.bank_details?.bank_name || null,
          bank_account: r.bank_account || d.bank_details?.account_number || null,
        } as Item;
      }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
    } catch (e: any) {
      toast({ title: 'Failed to load payroll lines', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingItems(false);
    }
  };

  const openDetail = async (period: Period) => {
    setOpenPeriod(period);
    await loadItems(period);
  };

  /** Pull every staff member onto the period, seeding basic pay and recurring components. */
  const loadStaff = async () => {
    if (!openPeriod) return;
    setLoadingItems(true);
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['teacher', 'admin']);
      const staffIds = [...new Set(((roles as any[]) || []).map(r => r.user_id))];
      const existing = new Set(items.map(i => i.staff_id));
      const toAdd = staffIds.filter(id => !existing.has(id));
      if (!toAdd.length) { toast({ title: 'All staff already on this period' }); setLoadingItems(false); return; }

      const [{ data: details }, { data: comps }] = await Promise.all([
        supabase.from('staff_details').select('user_id, salary, bank_details').in('user_id', toAdd),
        supabase.from('salary_components').select('*').eq('is_active', true).in('staff_id', toAdd),
      ]);
      const detailMap = new Map(((details as any[]) || []).map(d => [d.user_id, d]));
      const compMap = new Map<string, any[]>();
      ((comps as any[]) || []).forEach(c => {
        compMap.set(c.staff_id, [...(compMap.get(c.staff_id) || []), c]);
      });

      const rows = toAdd.map(id => {
        const d = detailMap.get(id) || {};
        const basic = num(d.salary);
        const mine = compMap.get(id) || [];
        const build = (kind: string) => mine.filter(c => c.kind === kind).map(c => ({
          name: c.name,
          amount: c.is_percentage ? Math.round((basic * num(c.amount)) / 100) : num(c.amount),
        }));
        const allowances = build('allowance');
        const deductions = build('deduction');
        const gross = basic + sum(allowances);
        return {
          period_id: openPeriod.id,
          staff_id: id,
          basic_salary: basic,
          gross_salary: gross,
          allowances,
          deductions,
          net_pay: gross - sum(deductions),
          status: 'draft',
          bank_name: d.bank_details?.bank_name || null,
          bank_account: d.bank_details?.account_number || null,
        };
      });
      const { error } = await supabase.from('payroll_items').insert(rows as any);
      if (error) throw error;
      toast({ title: `${rows.length} staff added` });
      await loadItems(openPeriod);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
      setLoadingItems(false);
    }
  };

  const saveItem = async (item: Item) => {
    setSavingId(item.id);
    const c = computed(item);
    const { error } = await supabase.from('payroll_items').update({
      basic_salary: num(item.basic_salary),
      gross_salary: c.gross,
      allowances: item.allowances as any,
      deductions: item.deductions as any,
      net_pay: c.net,
      notes: item.notes || null,
      bank_name: item.bank_name || null,
      bank_account: item.bank_account || null,
    } as any).eq('id', item.id);
    setSavingId(null);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    setItems(prev => prev.map(i => (i.id === item.id ? { ...item, gross_salary: c.gross, net_pay: c.net } : i)));
    setEditing(null);
    toast({ title: 'Payroll line saved' });
  };

  const removeItem = async (item: Item) => {
    if (!confirm(`Remove ${item.full_name} from this period?`)) return;
    await supabase.from('payroll_items').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const totals = useMemo(() => items.reduce((a, i) => {
    const c = computed(i);
    return { basic: a.basic + num(i.basic_salary), allow: a.allow + c.allow, deduct: a.deduct + c.deduct, gross: a.gross + c.gross, net: a.net + c.net };
  }, { basic: 0, allow: 0, deduct: 0, gross: 0, net: 0 }), [items]);

  const exportCsv = () => {
    const header = 'Staff,Employee ID,Bank,Account,Basic,Allowances,Deductions,Net\n';
    const body = items.map(i => {
      const c = computed(i);
      return [i.full_name, i.employee_id || '', i.bank_name || '', i.bank_account || '', num(i.basic_salary), c.allow, c.deduct, c.net].join(',');
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll-${openPeriod?.period_month}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const createPeriod = async () => {
    const { error } = await supabase.from('payroll_periods').insert({
      period_month: `${month}-01`, status: 'draft', created_by: user?.id,
    } as any);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Period created' }); load(); }
  };

  /** Post the paid payroll into the finance module as a single salaries expense. */
  const postToFinance = async (period: Period, amount: number) => {
    if (period.expense_id || amount <= 0) return null;
    let categoryId: string | null = null;
    const { data: cat } = await supabase.from('expense_categories').select('id').ilike('name', '%salar%').limit(1).maybeSingle();
    if (cat?.id) categoryId = cat.id;
    else {
      const { data: created } = await supabase.from('expense_categories')
        .insert({ name: 'Salaries & Wages', description: 'Staff payroll' } as any).select('id').maybeSingle();
      categoryId = created?.id ?? null;
    }
    const { data: exp, error } = await supabase.from('expenses').insert({
      expense_date: new Date().toISOString().slice(0, 10),
      category_id: categoryId,
      payee: 'Staff Payroll',
      description: `Payroll for ${format(new Date(period.period_month), 'MMMM yyyy')}`,
      amount,
      payment_method: 'bank_transfer',
      status: 'paid',
      source: 'payroll',
      recorded_by: user?.id,
    } as any).select('id').maybeSingle();
    if (error) { toast({ title: 'Finance posting failed', description: error.message, variant: 'destructive' }); return null; }
    return exp?.id ?? null;
  };

  const advance = async (period: Period) => {
    const next = STATUS_FLOW[period.status]?.next;
    if (!next) return;
    if (next === 'paid' && !items.length && openPeriod?.id === period.id) {
      toast({ title: 'No payroll lines', description: 'Add staff before marking the period paid.', variant: 'destructive' });
      return;
    }
    const patch: any = { status: next };
    if (next === 'approved') { patch.approved_by = user?.id; patch.approved_at = new Date().toISOString(); }
    if (next === 'paid') {
      patch.paid_at = new Date().toISOString();
      patch.pay_date = new Date().toISOString().slice(0, 10);
      let net = totals.net;
      if (openPeriod?.id !== period.id) {
        const { data } = await supabase.from('payroll_items').select('net_pay').eq('period_id', period.id);
        net = ((data as any[]) || []).reduce((a, r) => a + num(r.net_pay), 0);
      }
      const expenseId = await postToFinance(period, net);
      if (expenseId) patch.expense_id = expenseId;
    }
    if (next === 'closed') patch.closed_at = new Date().toISOString();

    const { error } = await supabase.from('payroll_periods').update(patch).eq('id', period.id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    if (next === 'paid') {
      await supabase.from('payroll_items').update({ status: 'paid', paid_at: new Date().toISOString() } as any).eq('period_id', period.id);
      if (openPeriod?.id === period.id) await loadItems(period);
    }
    if (openPeriod?.id === period.id) setOpenPeriod({ ...period, ...patch });
    toast({ title: `Period ${next}` });
    load();
  };

  const addComponent = async () => {
    if (!compForm.staff_id || !compForm.name || !compForm.amount) {
      toast({ title: 'Fill staff, name and amount', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('salary_components').insert({
      staff_id: compForm.staff_id,
      name: compForm.name,
      kind: compForm.kind,
      amount: Number(compForm.amount),
      is_percentage: compForm.is_percentage,
      is_active: true,
    } as any);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { setCompForm({ staff_id: '', name: '', kind: 'allowance', amount: '', is_percentage: false }); loadComponents(); toast({ title: 'Component added' }); }
  };

  const deleteComponent = async (id: string) => {
    await supabase.from('salary_components').delete().eq('id', id);
    loadComponents();
  };

  /* ------------------------------- period view ------------------------------ */
  if (openPeriod) {
    const readOnly = openPeriod.status === 'paid' || openPeriod.status === 'closed';
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setOpenPeriod(null); setItems([]); }}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h2 className="text-2xl font-bold">{format(new Date(openPeriod.period_month), 'MMMM yyyy')} Payroll</h2>
              <p className="text-muted-foreground capitalize">Status: {openPeriod.status}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly && <Button variant="outline" onClick={loadStaff}><UserPlus className="h-4 w-4 mr-1" />Load staff</Button>}
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Bank schedule (CSV)</Button>
            {STATUS_FLOW[openPeriod.status]?.next && (
              <Button onClick={() => advance(openPeriod)}>
                {openPeriod.status === 'approved' ? <Banknote className="h-4 w-4 mr-1" /> : openPeriod.status === 'paid' ? <Lock className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {STATUS_FLOW[openPeriod.status]?.label}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Staff" value={String(items.length)} />
          <Stat label="Basic" value={NGN(totals.basic)} />
          <Stat label="Allowances" value={NGN(totals.allow)} />
          <Stat label="Deductions" value={NGN(totals.deduct)} />
          <Stat label="Net payable" value={NGN(totals.net)} />
        </div>

        <Card>
          <CardHeader><CardTitle>Payroll Lines</CardTitle></CardHeader>
          <CardContent>
            {loadingItems ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No staff on this period yet. Use "Load staff" to add them.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead>
                      <TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(i => {
                      const c = computed(i);
                      return (
                        <TableRow key={i.id}>
                          <TableCell>
                            <p className="font-medium">{i.full_name}</p>
                            <p className="text-xs text-muted-foreground">{i.employee_id || 'No employee ID'}</p>
                          </TableCell>
                          <TableCell>{NGN(num(i.basic_salary))}</TableCell>
                          <TableCell>{NGN(c.allow)}</TableCell>
                          <TableCell>{NGN(c.deduct)}</TableCell>
                          <TableCell className="font-semibold">{NGN(c.net)}</TableCell>
                          <TableCell className="space-x-1 whitespace-nowrap">
                            {!readOnly && <Button size="sm" variant="outline" onClick={() => setEditing({ ...i, allowances: [...i.allowances], deductions: [...i.deductions] })}>Edit</Button>}
                            <Button size="sm" variant="outline" onClick={() => printNode(document.getElementById(`payslip-${i.id}`), { title: `Payslip ${i.full_name}` })}><Printer className="h-4 w-4" /></Button>
                            {!readOnly && <Button size="sm" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line editor */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.full_name}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div>
                  <Label>Basic salary</Label>
                  <Input type="number" value={editing.basic_salary ?? 0}
                    onChange={e => setEditing({ ...editing, basic_salary: Number(e.target.value || 0) })} />
                </div>
                <ComponentEditor
                  title="Allowances"
                  list={editing.allowances}
                  onChange={(list) => setEditing({ ...editing, allowances: list })}
                />
                <ComponentEditor
                  title="Deductions"
                  list={editing.deductions}
                  onChange={(list) => setEditing({ ...editing, deductions: list })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Bank</Label><Input value={editing.bank_name || ''} onChange={e => setEditing({ ...editing, bank_name: e.target.value })} /></div>
                  <div><Label>Account number</Label><Input value={editing.bank_account || ''} onChange={e => setEditing({ ...editing, bank_account: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Input value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm text-muted-foreground">Net pay</span>
                  <span className="text-lg font-bold">{NGN(computed(editing).net)}</span>
                </div>
                <Button className="w-full" onClick={() => saveItem(editing)} disabled={savingId === editing.id}>
                  {savingId === editing.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save line
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Hidden payslips */}
        <div className="hidden">
          {items.map(i => {
            const c = computed(i);
            return (
              <div id={`payslip-${i.id}`} key={i.id} style={{ padding: 28, fontFamily: 'Helvetica, Arial, sans-serif', color: '#111' }}>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ margin: 0, textTransform: 'uppercase' }}>{branding.name}</h2>
                  {branding.address && <p style={{ margin: '2px 0', fontSize: 12 }}>{branding.address}</p>}
                  <p style={{ marginTop: 8, fontWeight: 700, letterSpacing: 1 }}>
                    PAYSLIP  {format(new Date(openPeriod.period_month), 'MMMM yyyy').toUpperCase()}
                  </p>
                </div>
                <hr />
                <table style={{ width: '100%', fontSize: 12, marginBottom: 12 }}>
                  <tbody>
                    <tr><td><strong>Staff:</strong> {i.full_name}</td><td><strong>Employee ID:</strong> {i.employee_id || ''}</td></tr>
                    <tr><td><strong>Role:</strong> {i.designation || ''}</td><td><strong>Bank:</strong> {i.bank_name || ''} {i.bank_account || ''}</td></tr>
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    <tr><td style={cell}><strong>Basic salary</strong></td><td style={cellR}>{NGN(num(i.basic_salary))}</td></tr>
                    {i.allowances.map((a, idx) => (
                      <tr key={`a${idx}`}><td style={cell}>{a.name}</td><td style={cellR}>{NGN(num(a.amount))}</td></tr>
                    ))}
                    <tr><td style={cell}><strong>Gross pay</strong></td><td style={cellR}><strong>{NGN(c.gross)}</strong></td></tr>
                    {i.deductions.map((d, idx) => (
                      <tr key={`d${idx}`}><td style={cell}>{d.name}</td><td style={cellR}>-{NGN(num(d.amount))}</td></tr>
                    ))}
                    <tr><td style={cell}><strong>Net pay</strong></td><td style={cellR}><strong>{NGN(c.net)}</strong></td></tr>
                  </tbody>
                </table>
                <p style={{ fontSize: 10, marginTop: 18, color: '#555' }}>
                  Computer-generated payslip. No signature required.
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* -------------------------------- list view ------------------------------- */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payroll</h2>
        <p className="text-muted-foreground">
          Run monthly payroll: draft the period, load staff and pay components, approve, pay, then close. Paid periods post automatically to Finance as a salaries expense.
        </p>
      </div>

      <Tabs defaultValue="periods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="components">Salary Components</TabsTrigger>
        </TabsList>

        <TabsContent value="periods" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>New Period</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div><Label>Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
                <Button onClick={createPeriod}><Plus className="h-4 w-4 mr-1" />Create</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Periods</CardTitle></CardHeader>
            <CardContent>
              {periods.length === 0 ? <p className="text-muted-foreground text-center py-6">No periods yet.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Month</TableHead><TableHead>Status</TableHead><TableHead>Pay date</TableHead><TableHead>Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.period_month), 'MMMM yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'paid' ? 'default' : p.status === 'closed' ? 'outline' : 'secondary'} className="capitalize">{p.status}</Badge>
                          </TableCell>
                          <TableCell>{p.pay_date ? format(new Date(p.pay_date), 'dd MMM yyyy') : ''}</TableCell>
                          <TableCell className="space-x-2 whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => openDetail(p)}>Open</Button>
                            {STATUS_FLOW[p.status]?.next && (
                              <Button size="sm" onClick={() => advance(p)}>{STATUS_FLOW[p.status]?.label}</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Allowances & Deductions</CardTitle>
              <CardDescription>
                Applied automatically when staff are loaded onto a payroll period. Percentages are calculated on basic salary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label>Staff</Label>
                  <Select value={compForm.staff_id} onValueChange={v => setCompForm({ ...compForm, staff_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {staffOptions.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Name</Label><Input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} placeholder="Housing, Pension, PAYE…" /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={compForm.kind} onValueChange={v => setCompForm({ ...compForm, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowance">Allowance</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input type="number" value={compForm.amount} onChange={e => setCompForm({ ...compForm, amount: e.target.value })} /></div>
                <div>
                  <Label>Basis</Label>
                  <Select value={compForm.is_percentage ? 'percent' : 'fixed'} onValueChange={v => setCompForm({ ...compForm, is_percentage: v === 'percent' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="percent">% of basic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addComponent}><Plus className="h-4 w-4 mr-1" />Add component</Button>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Staff</TableHead><TableHead>Component</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No recurring components yet.</TableCell></TableRow>
                    ) : components.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{staffOptions.find(s => s.user_id === c.staff_id)?.full_name || ''}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="capitalize">{c.kind}</TableCell>
                        <TableCell>{c.is_percentage ? `${num(c.amount)}% of basic` : NGN(num(c.amount))}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => deleteComponent(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const cell: React.CSSProperties = { padding: 6, border: '1px solid #ddd' };
const cellR: React.CSSProperties = { ...cell, textAlign: 'right' };

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
    <CardContent className="text-xl font-bold">{value}</CardContent>
  </Card>
);

const ComponentEditor: React.FC<{ title: string; list: PayComponent[]; onChange: (l: PayComponent[]) => void }> = ({ title, list, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>{title}</Label>
      <Button size="sm" variant="outline" onClick={() => onChange([...list, { name: '', amount: 0 }])}>
        <Plus className="h-3 w-3 mr-1" />Add
      </Button>
    </div>
    {list.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
    {list.map((c, idx) => (
      <div key={idx} className="flex gap-2">
        <Input placeholder="Name" value={c.name}
          onChange={e => onChange(list.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
        <Input className="w-32" type="number" value={c.amount}
          onChange={e => onChange(list.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value || 0) } : x)))} />
        <Button size="icon" variant="ghost" onClick={() => onChange(list.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ))}
  </div>
);

export default PayrollHub;
