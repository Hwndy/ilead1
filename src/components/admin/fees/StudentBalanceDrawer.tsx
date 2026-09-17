import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { RecordCashPaymentDialog } from './RecordCashPaymentDialog';
import { FeeReceiptView, FeeReceiptData } from '@/components/fees/FeeReceiptView';
import { fetchPlacement, Placement, EMPTY_PLACEMENT } from '@/lib/student-placement';
import { fetchStudentInvoices, fetchStudentCredits, invoiceBillable, StudentInvoice } from '@/lib/student-billing';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

interface Props { studentId: string; name: string; admission?: string | null; onClose: () => void; }

export const StudentBalanceDrawer: React.FC<Props> = ({ studentId, name, admission, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>(EMPTY_PLACEMENT);
  const [structures, setStructures] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [credit, setCredit] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<FeeReceiptData | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const place = await fetchPlacement(studentId);
      setPlacement(place);
      const [{ data: fs, error: fsErr }, { data: pays, error: payErr }, invs, cr] = await Promise.all([
        supabase.from('fee_structures').select('*'),
        supabase.from('fee_payments').select('*, fee_structure:fee_structures(fee_type,academic_year)').eq('student_id', studentId).order('created_at', { ascending: false }),
        fetchStudentInvoices(studentId),
        fetchStudentCredits(studentId),
      ]);
      if (fsErr) throw fsErr;
      if (payErr) throw payErr;
      setStructures((fs || []).filter((f: any) => f.is_active !== false && (!f.class_id || f.class_id === place.class_id)));
      setPayments(pays || []);
      setInvoices(invs);
      setCredit(cr);
    } catch (e: any) {
      setError(e.message || 'Could not load this student’s fees.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [studentId]);

  const className = placement.class_name;
  const paidFor = (id: string) => payments.filter(p => p.status === 'completed' && p.fee_structure_id === id).reduce((a, b) => a + Number(b.amount_paid || 0), 0);
  const totalBilled = invoices.length
    ? invoices.reduce((a, i) => a + invoiceBillable(i), 0)
    : structures.reduce((a, b) => a + Number(b.amount), 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((a, b) => a + Number(b.amount_paid || 0), 0);

  const showReceipt = (p: any) => setReceipt({
    title: 'FEE PAYMENT RECEIPT',
    receiptNumber: p.receipt_number,
    date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : null,
    amount: Number(p.amount_paid || 0),
    fields: [
      { label: 'Student', value: name },
      { label: 'Admission No.', value: admission || '' },
      { label: 'Class', value: className || 'Not placed' },
      { label: 'Payment for', value: p.fee_structure?.fee_type || (p.metadata as any)?.description || 'School fee' },
      { label: 'Method', value: (p.payment_method || '').replace('_', ' ') },
      { label: 'Reference', value: p.payment_reference || '' },
    ],
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{name}{placement.label ? ` — ${placement.label}` : ''}</SheetTitle>
        </SheetHeader>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error} <Button variant="link" className="px-1 h-auto" onClick={load}>Try again</Button></AlertDescription>
          </Alert>
        )}
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Billed</div><div className="font-semibold">{NGN(totalBilled)}</div></div>
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Paid</div><div className="font-semibold text-green-600">{NGN(totalPaid)}</div></div>
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Credit</div><div className="font-semibold">{NGN(credit)}</div></div>
              <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-semibold text-red-600">{NGN(Math.max(0, totalBilled - totalPaid - credit))}</div></div>
            </div>

            {invoices.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Invoices</h3>
                {invoices.map(inv => (
                  <div key={inv.id} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{inv.term} • {inv.academic_year}</div>
                      <Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>{inv.status.replace('_', ' ')}</Badge>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {inv.items.filter(i => !i.is_optional || i.selected).map(i => (
                          <TableRow key={i.id}>
                            <TableCell>{i.description}{i.is_optional && <span className="ml-2 text-xs text-muted-foreground">optional</span>}</TableCell>
                            <TableCell className="text-right">{NGN(i.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="font-semibold">Invoice total</TableCell>
                          <TableCell className="text-right font-semibold">{NGN(invoiceBillable(inv))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
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
                  {structures.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No fees configured for this class yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            )}

            <Button className="w-full" onClick={() => setPayOpen(true)}>
              <Banknote className="h-4 w-4 mr-1" />Record a payment received
            </Button>

            <div>
              <h3 className="font-semibold mb-2">Payment History</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Fee</TableHead><TableHead>Receipt</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date ? format(new Date(p.payment_date), 'PP') : ''}</TableCell>
                      <TableCell>{p.fee_structure?.fee_type || (p.metadata as any)?.description || ''}</TableCell>
                      <TableCell className="font-mono text-xs">{p.receipt_number || ''}</TableCell>
                      <TableCell className="capitalize">{(p.payment_method || '').replace('_', ' ')}</TableCell>
                      <TableCell className="text-right">{NGN(Number(p.amount_paid))}</TableCell>
                      <TableCell className="text-right">
                        {p.status === 'completed'
                          ? <Button size="sm" variant="ghost" onClick={() => showReceipt(p)}>Receipt</Button>
                          : <Badge variant="outline">{p.status}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No payments yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            {receipt && (
              <div className="border-t pt-4">
                <FeeReceiptView data={receipt} />
                <Button variant="ghost" className="mt-2" onClick={() => setReceipt(null)}>Close receipt</Button>
              </div>
            )}
          </div>
        )}
        <RecordCashPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          student={{ id: studentId, name, admission_number: admission }}
          onSaved={load}
        />
      </SheetContent>
    </Sheet>
  );
};
