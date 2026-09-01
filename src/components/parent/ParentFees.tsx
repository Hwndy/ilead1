import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useChildren } from '@/contexts/ChildContext';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Receipt, Loader2, AlertCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { buildBrandedReceipt } from '@/lib/receipt-pdf';

interface FeeStructure {
  id: string;
  fee_type: string;
  academic_year: string;
  amount: number;
  due_date: string | null;
  class_id: string | null;
  is_mandatory: boolean;
}
interface FeePayment {
  id: string;
  amount_paid: number;
  payment_date: string;
  status: string;
  receipt_number: string | null;
  fee_structure_id: string | null;
  fee_installment_id: string | null;
  payment_reference: string | null;
  paid_at: string | null;
}
interface Plan {
  id: string;
  fee_structure_id: string;
  total_amount: number;
  number_of_installments: number;
  status: string;
}
interface Installment {
  id: string;
  plan_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_amount: number;
  status: string;
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

export const ParentFees: React.FC = () => {
  const { selectedChild } = useChildren();
  const { toast } = useToast();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<FeePayment | null>(null);

  useEffect(() => {
    if (selectedChild) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.student_id]);

  const load = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const [{ data: fs }, { data: pay }, { data: pl }] = await Promise.all([
        supabase
          .from('fee_structures')
          .select('*')
          .or(`class_id.eq.${selectedChild.class_id || '00000000-0000-0000-0000-000000000000'},class_id.is.null`),
        supabase.from('fee_payments').select('*').eq('student_id', selectedChild.student_id).order('payment_date', { ascending: false }),
        supabase.from('fee_installment_plans').select('*').eq('student_id', selectedChild.student_id),
      ]);
      setStructures((fs || []) as FeeStructure[]);
      setPayments((pay || []) as FeePayment[]);
      setPlans((pl || []) as Plan[]);
      const planIds = (pl || []).map((p: any) => p.id);
      if (planIds.length) {
        const { data: ins } = await supabase.from('fee_installments').select('*').in('plan_id', planIds).order('installment_number');
        setInstallments((ins || []) as Installment[]);
      } else {
        setInstallments([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const paidFor = (structureId: string) =>
    payments
      .filter(p => p.status === 'completed' && p.fee_structure_id === structureId)
      .reduce((s, p) => s + Number(p.amount_paid || 0), 0);

  // Payments recorded without a fee structure (e.g. the acceptance fee credited
  // towards school fees) reduce the outstanding balance of the mandatory fee.
  const unallocatedCredit = payments
    .filter(p => p.status === 'completed' && !p.fee_structure_id && !p.fee_installment_id)
    .reduce((s, p) => s + Number(p.amount_paid || 0), 0);

  const pay = async (opts: { fee_structure_id?: string; fee_installment_id?: string; amount: number; label: string }) => {
    if (!selectedChild) return;
    setPaying(opts.fee_structure_id || opts.fee_installment_id || 'x');
    try {
      const { data, error } = await supabase.functions.invoke('initialize-fee-payment', {
        body: {
          student_id: selectedChild.student_id,
          fee_structure_id: opts.fee_structure_id,
          fee_installment_id: opts.fee_installment_id,
          amount: opts.amount,
          label: opts.label,
          callback_url: `${window.location.origin}/fees/payment-callback`,
        },
      });
      if (error) throw error;
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (e: any) {
      toast({ title: 'Payment error', description: e.message || 'Could not start payment', variant: 'destructive' });
      setPaying(null);
    }
  };

  if (!selectedChild) {
    return (
      <Card><CardContent className="p-6 text-center text-muted-foreground">Select a child to view fees.</CardContent></Card>
    );
  }
  if (!selectedChild.can_view_fees) {
    return (
      <Card><CardContent className="p-6 text-center text-muted-foreground">You don't have fee access for this child.</CardContent></Card>
    );
  }
  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;
  }

  const totalBilled = structures.reduce((s, f) => s + Number(f.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const outstanding = Math.max(0, totalBilled - totalPaid);
  // Apply any unallocated credit to the first mandatory fee (falls back to the first fee).
  const creditTargetId =
    (structures.find(s => s.is_mandatory) || structures[0])?.id ?? null;
  const nextDue = structures
    .filter(s => s.due_date && paidFor(s.id) < s.amount)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];

  const downloadReceipt = async (p: FeePayment) => {
    const structure = structures.find(s => s.id === p.fee_structure_id);
    const doc = await buildBrandedReceipt({
      title: 'FEE PAYMENT RECEIPT',
      receiptNumber: p.receipt_number,
      date: p.paid_at || p.payment_date ? format(new Date(p.paid_at || p.payment_date), 'PP') : null,
      fields: [
        { label: 'Student', value: selectedChild?.full_name },
        { label: 'Admission No.', value: selectedChild?.admission_number },
        { label: 'Class', value: selectedChild?.class_name },
        { label: 'Fee', value: structure?.fee_type },
        { label: 'Academic Year', value: structure?.academic_year },
        { label: 'Payment Reference', value: p.payment_reference },
        { label: 'Status', value: p.status },
      ],
      amount: Number(p.amount_paid),
    });
    doc.save(`receipt-${p.receipt_number || p.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Billed</CardDescription><CardTitle>{NGN(totalBilled)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Paid</CardDescription><CardTitle className="text-green-600">{NGN(totalPaid)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Outstanding</CardDescription><CardTitle className={outstanding ? 'text-red-600' : 'text-green-600'}>{NGN(outstanding)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Next Due</CardDescription><CardTitle className="text-base">{nextDue?.due_date ? format(new Date(nextDue.due_date), 'PP') : ''}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fees for {selectedChild.full_name}</CardTitle>
          <CardDescription>Class: {selectedChild.class_name || 'Not assigned'}</CardDescription>
        </CardHeader>
        <CardContent>
          {structures.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              No fee structures set up for this class yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map(f => {
                  const paid = paidFor(f.id);
                  const credit = f.id === creditTargetId ? unallocatedCredit : 0;
                  const balance = Math.max(0, Number(f.amount) - paid - credit);
                  const plan = plans.find(p => p.fee_structure_id === f.id);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.fee_type}</TableCell>
                      <TableCell>{f.academic_year}</TableCell>
                      <TableCell>{f.due_date ? format(new Date(f.due_date), 'PP') : ''}</TableCell>
                      <TableCell className="text-right">{NGN(Number(f.amount))}</TableCell>
                      <TableCell className="text-right text-green-600">{NGN(paid + credit)}</TableCell>
                      <TableCell className="text-right">{NGN(balance)}</TableCell>
                      <TableCell className="text-right">
                        {balance <= 0 ? (
                          <Badge variant="secondary">Paid</Badge>
                        ) : plan ? (
                          <Badge variant="outline">On plan</Badge>
                        ) : (
                          <Button size="sm" disabled={paying === f.id} onClick={() => pay({ fee_structure_id: f.id, amount: balance, label: f.fee_type })}>
                            {paying === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-1" /> Pay {NGN(balance)}</>}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {installments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Installment Schedule</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map(i => {
                  const balance = Number(i.amount) - Number(i.paid_amount || 0);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>#{i.installment_number}</TableCell>
                      <TableCell>{format(new Date(i.due_date), 'PP')}</TableCell>
                      <TableCell className="text-right">{NGN(Number(i.amount))}</TableCell>
                      <TableCell className="text-right text-green-600">{NGN(Number(i.paid_amount || 0))}</TableCell>
                      <TableCell><Badge variant={i.status === 'paid' ? 'secondary' : 'outline'}>{i.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {balance <= 0 ? (
                          <Badge variant="secondary">Paid</Badge>
                        ) : (
                          <Button size="sm" disabled={paying === i.id} onClick={() => pay({ fee_installment_id: i.id, amount: balance, label: `Installment #${i.installment_number}` })}>
                            {paying === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-1" /> Pay {NGN(balance)}</>}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Payment History</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No payments yet</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Receipt</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.paid_at || p.payment_date), 'PP')}</TableCell>
                    <TableCell className="font-mono text-xs">{p.payment_reference || ''}</TableCell>
                    <TableCell className="font-mono text-xs">{p.receipt_number || ''}</TableCell>
                    <TableCell className="text-right">{NGN(Number(p.amount_paid))}</TableCell>
                    <TableCell><Badge variant={p.status === 'completed' ? 'secondary' : 'outline'}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {p.status === 'completed' && (
                        <Button size="sm" variant="ghost" onClick={() => downloadReceipt(p)}><Download className="h-4 w-4"/></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};