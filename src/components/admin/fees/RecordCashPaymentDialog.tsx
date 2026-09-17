import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchStudentClass } from '@/lib/class-roster';
import { FeeReceiptView, FeeReceiptData } from '@/components/fees/FeeReceiptView';
import { fetchStudentInvoices, invoiceBillable, StudentInvoice } from '@/lib/student-billing';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

const OTHER = 'OTHER';
const INVOICE_PREFIX = 'INV:';

export interface CashPaymentStudent {
  id: string;
  name: string;
  admission_number?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: CashPaymentStudent | null;
  onSaved?: () => void;
}

interface Installment { id: string; installment_number: number; amount: number; paid_amount: number | null; status: string | null; due_date: string; }

export const RecordCashPaymentDialog: React.FC<Props> = ({ open, onOpenChange, student, onSaved }) => {
  const { toast } = useToast();

  const [students, setStudents] = useState<CashPaymentStudent[]>([]);
  const [studentId, setStudentId] = useState(student?.id || '');
  const [studentQuery, setStudentQuery] = useState('');
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [classInfo, setClassInfo] = useState<{ class_id: string | null; class_name: string } | null>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<FeeReceiptData | null>(null);

  const [form, setForm] = useState({
    fee_structure_id: '',
    installment_id: '',
    description: '',
    amount: '',
    method: 'cash',
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  });

  const activeStudent = useMemo(
    () => student || students.find(s => s.id === studentId) || null,
    [student, students, studentId],
  );

  // Student list (only when no student was passed in)
  useEffect(() => {
    if (!open || student) return;
    (async () => {
      const { data: sts } = await supabase
        .from('students')
        .select('id, user_id, admission_number')
        .is('archived_at', null)
        .limit(1000);
      const userIds = (sts || []).map((s: any) => s.user_id).filter(Boolean);
      const nameByUser = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        (profs || []).forEach((p: any) => nameByUser.set(p.user_id, p.full_name));
      }
      setStudents((sts || []).map((s: any) => ({
        id: s.id,
        admission_number: s.admission_number,
        name: nameByUser.get(s.user_id) || s.admission_number || 'Unnamed student',
      })).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, [open, student]);

  useEffect(() => { if (open) { setStudentId(student?.id || ''); setReceipt(null); } }, [open, student]);

  // Fees + installments for the selected student
  useEffect(() => {
    if (!open || !studentId) { setFees([]); setClassInfo(null); setInstallments([]); return; }
    (async () => {
      setLoadingCtx(true);
      try {
        const info = await fetchStudentClass(studentId);
        setClassInfo(info);
        const { data: fs } = await supabase.from('fee_structures').select('*');
        const applicable = (fs || []).filter((f: any) =>
          f.is_active !== false && (!f.class_id || (info.class_id && f.class_id === info.class_id)),
        );
        setFees(applicable);
        setInvoices(await fetchStudentInvoices(studentId));
        const { data: plans } = await supabase.from('fee_installment_plans').select('id').eq('student_id', studentId);
        const planIds = (plans || []).map((p: any) => p.id);
        if (planIds.length) {
          const { data: ins } = await supabase
            .from('fee_installments')
            .select('id, installment_number, amount, paid_amount, status, due_date, plan_id')
            .in('plan_id', planIds)
            .neq('status', 'paid')
            .order('installment_number');
          setInstallments((ins || []) as any);
        } else setInstallments([]);
      } finally {
        setLoadingCtx(false);
      }
    })();
  }, [open, studentId]);

  const selectedInvoice = form.fee_structure_id.startsWith(INVOICE_PREFIX)
    ? invoices.find(i => i.id === form.fee_structure_id.slice(INVOICE_PREFIX.length)) || null
    : null;
  const invoiceBalance = selectedInvoice
    ? Math.max(0, invoiceBillable(selectedInvoice) - Number(selectedInvoice.amount_paid || 0))
    : null;
  const selectedInstallment = installments.find(i => i.id === form.installment_id) || null;
  const installmentBalance = selectedInstallment
    ? Number(selectedInstallment.amount) - Number(selectedInstallment.paid_amount || 0)
    : null;

  const reset = () => setForm({
    fee_structure_id: '', installment_id: '', description: '', amount: '',
    method: 'cash', date: new Date().toISOString().slice(0, 10), reference: '', notes: '',
  });

  const save = async () => {
    const amount = Number(form.amount);
    if (!studentId) { toast({ title: 'Select a student', variant: 'destructive' }); return; }
    if (!form.fee_structure_id) { toast({ title: 'Select what the payment is for', variant: 'destructive' }); return; }
    if (form.fee_structure_id === OTHER && !form.description.trim()) {
      toast({ title: 'Describe the payment', description: 'A description is required for a payment that is not on the fee list.', variant: 'destructive' });
      return;
    }
    if (!amount || amount <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (installmentBalance !== null && amount > installmentBalance) {
      toast({ title: 'Amount too high', description: `The selected installment only has ${NGN(installmentBalance)} outstanding.`, variant: 'destructive' });
      return;
    }
    if (invoiceBalance !== null && amount > invoiceBalance) {
      toast({ title: 'Amount too high', description: `That invoice only has ${NGN(invoiceBalance)} outstanding.`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const receiptNumber = `REC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const paidAt = new Date(`${form.date}T12:00:00`).toISOString();
      const { data: auth } = await supabase.auth.getUser();
      const feeStructureId = form.fee_structure_id === OTHER || selectedInvoice ? null : form.fee_structure_id;
      const feeLabel = selectedInvoice
        ? `${selectedInvoice.term} ${selectedInvoice.academic_year} fees`
        : feeStructureId
          ? (fees.find(f => f.id === feeStructureId)?.fee_type || 'School fee')
          : form.description.trim();

      const payload: any = {
        student_id: studentId,
        fee_structure_id: feeStructureId,
        fee_installment_id: form.installment_id || null,
        amount_paid: amount,
        payment_method: form.method,
        status: 'completed',
        payment_date: form.date,
        paid_at: paidAt,
        receipt_number: receiptNumber,
        payment_reference: form.reference || null,
        notes: [form.fee_structure_id === OTHER ? `Other: ${form.description.trim()}` : null, form.notes || null]
          .filter(Boolean).join(' — ') || null,
        metadata: { source: 'office', description: feeLabel, recorded_by: auth?.user?.id || null },
        created_by: auth?.user?.id || null,
      };
      if (selectedInvoice) payload.invoice_id = selectedInvoice.id;

      const { error } = await supabase.from('fee_payments').insert(payload);
      if (error) throw error;

      if (form.installment_id && selectedInstallment) {
        const newPaid = Number(selectedInstallment.paid_amount || 0) + amount;
        await supabase.from('fee_installments').update({
          paid_amount: newPaid,
          status: newPaid >= Number(selectedInstallment.amount) ? 'paid' : 'partial',
          paid_at: paidAt,
        }).eq('id', form.installment_id);
      }

      setReceipt({
        title: 'FEE PAYMENT RECEIPT',
        receiptNumber,
        date: new Date(form.date).toLocaleDateString(),
        amount,
        fields: [
          { label: 'Student', value: activeStudent?.name },
          { label: 'Admission No.', value: activeStudent?.admission_number || '' },
          { label: 'Class', value: classInfo?.class_name || 'Not placed' },
          { label: 'Payment for', value: feeLabel },
          { label: 'Method', value: form.method.replace('_', ' ') },
          { label: 'Reference', value: form.reference },
        ],
      });
      toast({ title: 'Payment recorded', description: `Receipt ${receiptNumber}` });
      reset();
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not record the payment', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s =>
    !studentQuery ||
    s.name.toLowerCase().includes(studentQuery.toLowerCase()) ||
    (s.admission_number || '').toLowerCase().includes(studentQuery.toLowerCase()),
  ).slice(0, 50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{receipt ? 'Payment recorded' : 'Record a payment received'}</DialogTitle>
          {!receipt && <DialogDescription>Cash, bank transfer, POS or cheque taken at the school office.</DialogDescription>}
        </DialogHeader>

        {receipt ? (
          <div className="space-y-4">
            <FeeReceiptView data={receipt} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceipt(null)}>Record another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3">
            {!student && (
              <div>
                <Label>Student *</Label>
                <Input placeholder="Search name or admission number" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} className="mb-2" />
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.admission_number ? ` — ${s.admission_number}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {studentId && !loadingCtx && !classInfo?.class_id && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This student has not been placed in a class yet, so only fees that apply to everyone are listed. You can still record the payment using “Other / not listed”.
                </AlertDescription>
              </Alert>
            )}
            {studentId && !loadingCtx && classInfo?.class_id && fees.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No fee has been set up for {classInfo.class_name || 'this class'} yet. Use “Other / not listed” for now and add the fee under Fee Structures.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Payment for *</Label>
              <Select
                value={form.fee_structure_id}
                onValueChange={v => {
                  const inv = v.startsWith(INVOICE_PREFIX)
                    ? invoices.find(i => i.id === v.slice(INVOICE_PREFIX.length)) || null
                    : null;
                  const due = inv ? Math.max(0, invoiceBillable(inv) - Number(inv.amount_paid || 0)) : null;
                  setForm({ ...form, fee_structure_id: v, installment_id: '', amount: due ? String(due) : form.amount });
                }}
                disabled={!studentId || loadingCtx}
              >
                <SelectTrigger><SelectValue placeholder={loadingCtx ? 'Loading fees…' : 'Select an invoice or fee'} /></SelectTrigger>
                <SelectContent>
                  {invoices.map(inv => {
                    const due = Math.max(0, invoiceBillable(inv) - Number(inv.amount_paid || 0));
                    return (
                      <SelectItem key={inv.id} value={`${INVOICE_PREFIX}${inv.id}`}>
                        {inv.term} {inv.academic_year} invoice — {NGN(due)} outstanding
                      </SelectItem>
                    );
                  })}
                  {fees.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.fee_type} — {NGN(Number(f.amount))}{f.term ? ` (${f.term})` : ''}</SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other / not listed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.fee_structure_id === OTHER && (
              <div>
                <Label>What is this payment for? *</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Replacement ID card" />
              </div>
            )}

            {installments.length > 0 && form.fee_structure_id !== OTHER && !selectedInvoice && (
              <div>
                <Label>Installment (optional)</Label>
                <Select value={form.installment_id || 'none'} onValueChange={v => setForm({ ...form, installment_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not against an installment</SelectItem>
                    {installments.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        #{i.installment_number} — {NGN(Number(i.amount) - Number(i.paid_amount || 0))} outstanding
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₦) *</Label>
                <Input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                {installmentBalance !== null && <p className="text-xs text-muted-foreground mt-1">Max {NGN(installmentBalance)}</p>}
                {invoiceBalance !== null && <p className="text-xs text-muted-foreground mt-1">Outstanding on this invoice: {NGN(invoiceBalance)}</p>}
              </div>
              <div>
                <Label>Date received *</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Method *</Label>
                <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teller / reference</Label>
                <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save payment'}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecordCashPaymentDialog;
