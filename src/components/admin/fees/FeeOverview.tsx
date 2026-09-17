import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wallet, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';
import { fetchStudentClassMap } from '@/lib/class-roster';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

export const FeeOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ billed: 0, collected: 0, outstanding: 0, thisMonth: 0, overdue: 0, defaulters: [] as any[] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const [{ data: students }, { data: structures }, { data: payments }, { count: overdue }, classMap] = await Promise.all([
        supabase.from('students').select('id').is('archived_at', null),
        supabase.from('fee_structures').select('amount, class_id, is_active'),
        supabase.from('fee_payments').select('amount_paid, payment_date, status, student_id').eq('status', 'completed'),
        supabase.from('fee_installments').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        fetchStudentClassMap(),
      ]);
      const activeFees = (structures || []).filter((f: any) => f.is_active !== false);
      // Estimate billed = sum(structure.amount) applied to each student who matches class (or global)
      let billed = 0;
      const paidByStudent: Record<string, number> = {};
      const perStudentBill: Record<string, number> = {};
      (students || []).forEach((s: any) => {
        const classId = classMap.get(s.id)?.class_id || null;
        const sum = activeFees.filter((f: any) => !f.class_id || f.class_id === classId).reduce((a, b: any) => a + Number(b.amount), 0);
        perStudentBill[s.id] = sum; billed += sum;
      });
      let collected = 0, thisMonth = 0;
      (payments || []).forEach((p: any) => {
        const amt = Number(p.amount_paid || 0);
        collected += amt;
        paidByStudent[p.student_id] = (paidByStudent[p.student_id] || 0) + amt;
        if (p.payment_date && new Date(p.payment_date) >= monthStart) thisMonth += amt;
      });
      const defaulters = Object.entries(perStudentBill)
        .map(([id, bill]) => ({ id, outstanding: bill - (paidByStudent[id] || 0) }))
        .filter(d => d.outstanding > 0).sort((a,b) => b.outstanding - a.outstanding).slice(0, 5);
      const ids = defaulters.map(d => d.id);
      let named: any[] = [];
      if (ids.length) {
        const { data: sts } = await supabase.from('students').select('id, admission_number, user_id').in('id', ids);
        const userIds = (sts || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: profs } = userIds.length
          ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [] as any[] };
        const nameByUser = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
        named = defaulters.map(d => {
          const s: any = (sts || []).find((x: any) => x.id === d.id);
          return { ...d, name: nameByUser.get(s?.user_id) || 'Unknown', admission: s?.admission_number };
        });
      }
      setStats({ billed, collected, outstanding: Math.max(0, billed - collected), thisMonth, overdue: overdue || 0, defaulters: named });
    } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Wallet className="h-4 w-4"/>Total Billed</CardDescription><CardTitle>{NGN(stats.billed)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4"/>Collected</CardDescription><CardTitle className="text-green-600">{NGN(stats.collected)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>Outstanding</CardDescription><CardTitle className="text-red-600">{NGN(stats.outstanding)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><CalendarClock className="h-4 w-4"/>This Month</CardDescription><CardTitle>{NGN(stats.thisMonth)}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Top Defaulters</CardTitle><CardDescription>{stats.overdue} overdue installments</CardDescription></CardHeader>
        <CardContent>
          {stats.defaulters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding balances 🎉</p>
          ) : (
            <div className="space-y-2">
              {stats.defaulters.map((d: any) => (
                <div key={d.id} className="flex justify-between text-sm border-b pb-2">
                  <div><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.admission}</div></div>
                  <div className="text-red-600 font-semibold">{NGN(d.outstanding)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};