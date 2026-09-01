import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

interface Props { studentId: string; name: string; onClose: () => void; }

export const StudentBalanceDrawer: React.FC<Props> = ({ studentId, name, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [form, setForm] = useState({ fee_structure_id: '', amount: '', payment_method: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: ca } = await supabase.from('class_assignments').select('class_id').eq('student_id', studentId).maybeSingle();
    const classId = ca?.class_id;
    const [{ data: fs }, { data: pays }] = await Promise.all([
      supabase.from('fee_structures').select('*').or(`class_id.eq.${classId || '00000000-0000-0000-0000-000000000000'},class_id.is.null`),
      supabase.from('fee_payments').select('*, fee_structure:fee_structures(fee_type,academic_year)').eq('student_id', studentId).order('created_at', { ascending: false }),
    ]);
    setStructures(fs || []);
    setPayments(pays || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [studentId]);

  const paidFor = (id: string) => payments.filter(p => p.status === 'completed' && p.fee_structure_id === id).reduce((a, b) => a + Number(b.amount_paid || 0), 0);

  const record = async () => {
    if (!form.fee_structure_id || !form.amount) { toast({ title: 'Select fee and amount', variant: 'destructive' }); return; }
    setSaving(true);
    const receipt = `REC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const now = new Date().toISOString();
    const { error } = await supabase.from('fee_payments').insert({
      student_id: studentId, fee_structure_id: form.fee_structure_id,
      amount_paid: Number(form.amount), payment_method: form.payment_method,
      status: 'completed', payment_date: now.slice(0,10), paid_at: now,
      receipt_number: receipt, notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Payment recorded', description: `Receipt ${receipt}` });
    setForm({ fee_structure_id: '', amount: '', payment_method: 'cash', notes: '' });
    load();
  };

  const totalBilled = structures.reduce((a, b) => a + Number(b.amount), 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((a, b) => a + Number(b.amount_paid || 0), 0);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{name}</SheetTitle></SheetHeader>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Billed</div><div className="font-semibold">{NGN(totalBilled)}</div></div>
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Paid</div><div className="font-semibold text-green-600">{NGN(totalPaid)}</div></div>
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-semibold text-red-600">{NGN(Math.max(0, totalBilled - totalPaid))}</div></div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Fee Breakdown</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Fee</TableHead><TableHead>Year/Term</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {structures.map(s => {
                    const paid = paidFor(s.id); const bal = Number(s.amount) - paid;
                    return <TableRow key={s.id}>
                      <TableCell>{s.fee_type}</TableCell>
                      <TableCell>{s.academic_year}{s.term ? ` • ${s.term}` : ''}</TableCell>
                      <TableCell className="text-right">{NGN(Number(s.amount))}</TableCell>
                      <TableCell className="text-right text-green-600">{NGN(paid)}</TableCell>
                      <TableCell className="text-right">{bal <= 0 ? <Badge>Paid</Badge> : NGN(bal)}</TableCell>
                    </TableRow>;
                  })}
                  {structures.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No fees configured</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div className="border rounded p-4 space-y-3">
              <h3 className="font-semibold">Record Offline Payment</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fee</Label>
                  <Select value={form.fee_structure_id} onValueChange={v => setForm({ ...form, fee_structure_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select fee"/></SelectTrigger>
                    <SelectContent>{structures.map(s => <SelectItem key={s.id} value={s.id}>{s.fee_type}  {NGN(Number(s.amount))}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></div>
                <div><Label>Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="pos">POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ref / bank / cheque #"/></div>
              </div>
              <Button onClick={record} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Record Payment'}</Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Payment History</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Fee</TableHead><TableHead>Receipt</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date ? format(new Date(p.payment_date), 'PP') : ''}</TableCell>
                      <TableCell>{p.fee_structure?.fee_type || ''}</TableCell>
                      <TableCell className="font-mono text-xs">{p.receipt_number || ''}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>
                      <TableCell className="text-right">{NGN(Number(p.amount_paid))}</TableCell>
                      <TableCell><Badge variant={p.status === 'completed' ? 'default' : 'outline'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No payments yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};