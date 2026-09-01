import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Loader2, Plus, Check, Trash2 } from 'lucide-react';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };

interface Category { id: string; name: string }
interface Expense {
  id: string; expense_date: string; category_id: string | null; payee: string | null; description: string | null;
  amount: number; payment_method: string; reference: string | null; status: string; source: string;
}

const emptyForm = () => ({
  expense_date: today(), category_id: '', payee: '', description: '',
  amount: '', payment_method: 'cash', reference: '',
});

export const ExpensesPanel: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }),
      supabase.from('expense_categories').select('id,name').eq('is_active', true).order('name'),
    ]);
    setRows((e || []) as any);
    setCats((c || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name || 'Uncategorised';

  const visible = useMemo(() => rows.filter(r =>
    (status === 'all' || r.status === status) && (category === 'all' || r.category_id === category)
  ), [rows, status, category]);

  const total = visible.reduce((a, r) => a + Number(r.amount || 0), 0);

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: 'Enter an amount', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      expense_date: form.expense_date,
      category_id: form.category_id || null,
      payee: form.payee || null,
      description: form.description || null,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      reference: form.reference || null,
      status: 'pending',
      recorded_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense recorded' });
    setOpen(false); setForm(emptyForm()); load();
  };

  const setStatusFor = async (row: Expense, next: string) => {
    const patch: any = { status: next };
    if (next === 'approved' || next === 'paid') { patch.approved_by = user?.id ?? null; patch.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from('expenses').update(patch).eq('id', row.id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, status: next } : r)));
  };

  const remove = async (row: Expense) => {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from('expense_categories').insert({ name: newCat.trim() });
    if (error) { toast({ title: 'Could not add', description: error.message, variant: 'destructive' }); return; }
    setNewCat(''); setCatOpen(false); load();
  };

  const exportCsv = () => {
    const header = 'Date,Category,Payee,Description,Amount,Method,Reference,Status\n';
    const body = visible.map(r => [
      r.expense_date, catName(r.category_id), r.payee || '', (r.description || '').replace(/,/g, ' '),
      r.amount, r.payment_method, r.reference || '', r.status,
    ].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `expenses-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const badge = (s: string) => s === 'paid' ? 'default' : s === 'approved' ? 'secondary' : s === 'rejected' ? 'destructive' : 'outline';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Expenses</CardTitle>
            <p className="text-sm text-muted-foreground">{visible.length} record(s) · {NGN(total)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCatOpen(true)}>Categories</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New expense</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            : visible.length === 0 ? <p className="py-10 text-center text-muted-foreground">No expenses in this range.</p>
            : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Payee</TableHead>
                  <TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visible.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.expense_date}</TableCell>
                      <TableCell>{catName(r.category_id)}</TableCell>
                      <TableCell>{r.payee || ''}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.description || ''}</TableCell>
                      <TableCell className="text-right font-medium">{NGN(Number(r.amount))}</TableCell>
                      <TableCell className="capitalize">{r.payment_method?.replace('_', ' ')}</TableCell>
                      <TableCell><Badge variant={badge(r.status) as any} className="capitalize">{r.status}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.status === 'pending' && (
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => setStatusFor(r, 'approved')}>
                            <Check className="h-3 w-3 mr-1" />Approve
                          </Button>
                        )}
                        {r.status === 'approved' && (
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => setStatusFor(r, 'paid')}>Mark paid</Button>
                        )}
                        {r.source === 'manual' && (
                          <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
            <DialogDescription>Log a school expense for the finance reports.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Amount (NGN)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category_id || undefined} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Payment method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Payee / vendor</Label><Input value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} /></div>
            <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense categories</DialogTitle>
            <DialogDescription>Group expenses so reports break down cleanly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {cats.map(c => <div key={c.id} className="text-sm border-b py-1">{c.name}</div>)}
            <div className="flex gap-2 pt-2">
              <Input placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} />
              <Button onClick={addCategory}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPanel;
