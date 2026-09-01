import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { addMonths } from 'date-fns';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

export const InstallmentPlans: React.FC = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_id: '', fee_structure_id: '', total_amount: '', number_of_installments: '3', start_date: new Date().toISOString().slice(0,10), frequency: 'monthly' });

  const load = async () => {
    setLoading(true);
    const [{ data: pls }, { data: sts }, { data: fs }] = await Promise.all([
      supabase.from('fee_installment_plans').select('*, students(id, user_id, admission_number), fee_structures(fee_type,academic_year), fee_installments(id,status,amount,paid_amount)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, user_id, admission_number').order('admission_number'),
      supabase.from('fee_structures').select('id, fee_type, amount, academic_year'),
    ]);
    const userIds = [...new Set([
      ...((sts || []) as any[]).map(s => s.user_id),
      ...((pls || []) as any[]).map(p => p.students?.user_id),
    ].filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    }
    setPlans(((pls || []) as any[]).map(p => ({
      ...p,
      students: p.students ? { ...p.students, profiles: { full_name: nameMap.get(p.students.user_id) || 'Unknown' } } : null,
    })));
    setStudents(((sts || []) as any[]).map(s => ({ ...s, profiles: { full_name: nameMap.get(s.user_id) || 'Unknown' } })));
    setStructures(fs || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.student_id || !form.fee_structure_id || !form.total_amount || !form.number_of_installments) {
      toast({ title: 'Missing fields', variant: 'destructive' }); return;
    }
    setSaving(true);
    const total = Number(form.total_amount);
    const n = Math.max(1, parseInt(form.number_of_installments));
    const per = Math.round((total / n) * 100) / 100;
    const { data: plan, error } = await supabase.from('fee_installment_plans').insert({
      student_id: form.student_id, fee_structure_id: form.fee_structure_id,
      total_amount: total, number_of_installments: n, start_date: form.start_date, status: 'active',
    }).select().single();
    if (error || !plan) { setSaving(false); toast({ title: 'Failed', description: error?.message, variant: 'destructive' }); return; }
    const rows = Array.from({ length: n }).map((_, i) => {
      const due = form.frequency === 'monthly' ? addMonths(new Date(form.start_date), i) : addMonths(new Date(form.start_date), i * 4);
      return { plan_id: plan.id, installment_number: i + 1, amount: i === n - 1 ? Number((total - per * (n - 1)).toFixed(2)) : per, due_date: due.toISOString().slice(0,10), status: 'pending' };
    });
    const { error: ie } = await supabase.from('fee_installments').insert(rows);
    setSaving(false);
    if (ie) toast({ title: 'Installments failed', description: ie.message, variant: 'destructive' });
    else toast({ title: 'Installment plan created' });
    setOpen(false);
    setForm({ student_id: '', fee_structure_id: '', total_amount: '', number_of_installments: '3', start_date: new Date().toISOString().slice(0,10), frequency: 'monthly' });
    load();
  };

  const cancel = async (p: any) => {
    if (!confirm('Cancel this plan? Unpaid installments will be removed.')) return;
    await supabase.from('fee_installments').delete().eq('plan_id', p.id).neq('status', 'paid');
    await supabase.from('fee_installment_plans').update({ status: 'cancelled' }).eq('id', p.id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Installment Plans</CardTitle>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1"/>New Plan</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead>Total</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {plans.map((p: any) => {
                const paid = (p.fee_installments || []).reduce((a: number, b: any) => a + Number(b.paid_amount || 0), 0);
                return <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.students?.profiles?.full_name || ''}</div><div className="text-xs text-muted-foreground">{p.students?.admission_number}</div></TableCell>
                  <TableCell>{p.fee_structures?.fee_type} ({p.fee_structures?.academic_year})</TableCell>
                  <TableCell>{NGN(Number(p.total_amount))}</TableCell>
                  <TableCell>{NGN(paid)} / {p.number_of_installments} parts</TableCell>
                  <TableCell><Badge variant={p.status === 'active' ? 'default' : 'outline'}>{p.status}</Badge></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => cancel(p)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                </TableRow>;
              })}
              {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No installment plans yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Installment Plan</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Student</Label>
              <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose student"/></SelectTrigger>
                <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.profiles?.full_name || 'Unknown'} ({s.admission_number})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fee</Label>
              <Select value={form.fee_structure_id} onValueChange={v => { const f = structures.find((x: any) => x.id === v); setForm({ ...form, fee_structure_id: v, total_amount: f ? String(f.amount) : form.total_amount }); }}>
                <SelectTrigger><SelectValue placeholder="Choose fee"/></SelectTrigger>
                <SelectContent>{structures.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.fee_type}  {NGN(Number(f.amount))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })}/></div>
              <div><Label># Installments</Label><Input type="number" min={1} value={form.number_of_installments} onChange={e => setForm({ ...form, number_of_installments: e.target.value })}/></div>
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}/></div>
              <div><Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="termly">Termly (4 mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};