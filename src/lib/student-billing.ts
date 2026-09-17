import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  fee_id: string | null;
  description: string;
  amount: number;
  is_optional: boolean;
  selected: boolean;
}

export interface StudentInvoice {
  id: string;
  student_id: string;
  academic_year: string;
  term: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  issued_at: string | null;
  items: InvoiceLine[];
}

export interface StudentBillingSummary {
  invoicedTotal: number;
  paidTotal: number;
  creditTotal: number;
  balance: number;
  hasInvoices: boolean;
}

/** Amount actually owed on an invoice: only selected lines count. */
export const invoiceBillable = (inv: StudentInvoice): number => {
  if (!inv.items || inv.items.length === 0) return Number(inv.total_amount || 0);
  return inv.items
    .filter(i => !i.is_optional || i.selected)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
};

/**
 * Every invoice (with its lines) for one student, newest first.
 * Returns an empty list when the billing tables are not available yet.
 */
export async function fetchStudentInvoices(studentId: string): Promise<StudentInvoice[]> {
  if (!studentId) return [];
  try {
    const { data: invs, error } = await db
      .from('student_invoices')
      .select('*')
      .eq('student_id', studentId)
      .neq('status', 'cancelled')
      .order('issued_at', { ascending: false });
    if (error) throw error;
    const list = (invs || []) as any[];
    if (list.length === 0) return [];

    const { data: items } = await db
      .from('invoice_items')
      .select('*')
      .in('invoice_id', list.map(i => i.id));

    const byInvoice = new Map<string, InvoiceLine[]>();
    ((items || []) as any[]).forEach(it => {
      const arr = byInvoice.get(it.invoice_id) || [];
      arr.push({
        id: it.id,
        invoice_id: it.invoice_id,
        fee_id: it.fee_id ?? null,
        description: it.description,
        amount: Number(it.amount || 0),
        is_optional: !!it.is_optional,
        selected: it.selected !== false,
      });
      byInvoice.set(it.invoice_id, arr);
    });

    return list.map(i => ({
      id: i.id,
      student_id: i.student_id,
      academic_year: i.academic_year,
      term: i.term,
      total_amount: Number(i.total_amount || 0),
      amount_paid: Number(i.amount_paid || 0),
      status: i.status,
      due_date: i.due_date ?? null,
      issued_at: i.issued_at ?? null,
      items: byInvoice.get(i.id) || [],
    }));
  } catch {
    return [];
  }
}

/** Invoiced total per student id (selected lines only). */
export async function fetchInvoicedTotals(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const [{ data: invs }, { data: items }] = await Promise.all([
      db.from('student_invoices').select('id, student_id, total_amount, status'),
      db.from('invoice_items').select('invoice_id, amount, is_optional, selected'),
    ]);
    const lineTotals = new Map<string, number>();
    ((items || []) as any[]).forEach(it => {
      if (it.is_optional && it.selected === false) return;
      lineTotals.set(it.invoice_id, (lineTotals.get(it.invoice_id) || 0) + Number(it.amount || 0));
    });
    ((invs || []) as any[])
      .filter(i => i.status !== 'cancelled')
      .forEach(i => {
        const amount = lineTotals.has(i.id) ? lineTotals.get(i.id)! : Number(i.total_amount || 0);
        map.set(i.student_id, (map.get(i.student_id) || 0) + amount);
      });
  } catch {
    /* billing tables not available */
  }
  return map;
}

/** Credit balance per student id. */
export async function fetchCreditTotals(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { data } = await db.from('student_credits').select('student_id, amount');
    ((data || []) as any[]).forEach(c => {
      map.set(c.student_id, (map.get(c.student_id) || 0) + Number(c.amount || 0));
    });
  } catch {
    /* credits table not available */
  }
  return map;
}

export async function fetchStudentCredits(studentId: string): Promise<number> {
  if (!studentId) return 0;
  try {
    const { data } = await db.from('student_credits').select('amount').eq('student_id', studentId);
    return ((data || []) as any[]).reduce((s, c) => s + Number(c.amount || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * One student's money position. Invoices are the source of truth; when a
 * student has no invoice yet the caller's fee-structure total is used so the
 * office and the parent never see two different figures.
 */
export function summariseBilling(opts: {
  invoices: StudentInvoice[];
  paidTotal: number;
  creditTotal: number;
  fallbackBilled: number;
}): StudentBillingSummary {
  const hasInvoices = opts.invoices.length > 0;
  const invoicedTotal = hasInvoices
    ? opts.invoices.reduce((s, i) => s + invoiceBillable(i), 0)
    : opts.fallbackBilled;
  return {
    invoicedTotal,
    paidTotal: opts.paidTotal,
    creditTotal: opts.creditTotal,
    balance: Math.max(0, invoicedTotal - opts.paidTotal - opts.creditTotal),
    hasInvoices,
  };
}
