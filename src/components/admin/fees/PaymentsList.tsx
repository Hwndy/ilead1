import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, Search } from 'lucide-react';
import { format } from 'date-fns';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

export const PaymentsList: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('fee_payments')
        .select('*, students(id, user_id, admission_number), fee_structures(fee_type,academic_year)')
        .order('created_at', { ascending: false }).limit(500);
      const rows = (data || []) as any[];
      const userIds = [...new Set(rows.map(r => r.students?.user_id).filter(Boolean))];
      let nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      setPayments(rows.map(r => ({
        ...r,
        students: r.students ? { ...r.students, profiles: { full_name: nameMap.get(r.students.user_id) || 'Unknown' } } : null,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => payments.filter((p: any) =>
    !q || (p.students?.profiles?.full_name || '').toLowerCase().includes(q.toLowerCase())
       || (p.students?.admission_number || '').toLowerCase().includes(q.toLowerCase())
       || (p.receipt_number || '').toLowerCase().includes(q.toLowerCase())
       || (p.payment_reference || '').toLowerCase().includes(q.toLowerCase())
  ), [payments, q]);

  const exportCsv = () => {
    const header = ['Date','Student','Admission','Fee','Amount','Method','Receipt','Reference','Status'];
    const rows = filtered.map((p: any) => [
      p.payment_date || '', p.students?.profiles?.full_name || '', p.students?.admission_number || '',
      p.fee_structures?.fee_type || '', p.amount_paid, p.payment_method || '',
      p.receipt_number || '', p.payment_reference || '', p.status || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `fee-payments-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle>All Payments</CardTitle>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input className="pl-9 w-64" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)}/></div>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1"/>CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead>Receipt</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date ? format(new Date(p.payment_date), 'PP') : ''}</TableCell>
                  <TableCell><div className="font-medium">{p.students?.profiles?.full_name || ''}</div><div className="text-xs text-muted-foreground">{p.students?.admission_number}</div></TableCell>
                  <TableCell>{p.fee_structures?.fee_type || ''}</TableCell>
                  <TableCell className="font-mono text-xs">{p.receipt_number || ''}</TableCell>
                  <TableCell className="capitalize">{p.payment_method || ''}</TableCell>
                  <TableCell className="text-right">{NGN(Number(p.amount_paid))}</TableCell>
                  <TableCell><Badge variant={p.status === 'completed' ? 'default' : 'outline'}>{p.status}</Badge></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No payments</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};