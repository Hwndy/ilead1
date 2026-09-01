import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye } from 'lucide-react';
import { StudentBalanceDrawer } from './StudentBalanceDrawer';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

interface Row { id: string; name: string; admission: string; class_id: string | null; class_name: string; billed: number; paid: number; outstanding: number; }

export const StudentBalances: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: sts }, { data: cls }, { data: fs }, { data: pays }] = await Promise.all([
      supabase.from('students').select('id, admission_number, user_id, class_assignments(class_id, classes(id,name))'),
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('fee_structures').select('amount, class_id'),
      supabase.from('fee_payments').select('student_id, amount_paid, status').eq('status', 'completed'),
    ]);
    setClasses((cls || []) as any);
    const userIds = [...new Set((sts || []).map((s: any) => s.user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    }
    const paidMap: Record<string, number> = {};
    (pays || []).forEach((p: any) => { paidMap[p.student_id] = (paidMap[p.student_id] || 0) + Number(p.amount_paid || 0); });
    const out: Row[] = (sts || []).map((s: any) => {
      const ca = s.class_assignments?.[0];
      const classId = ca?.class_id || null;
      const className = ca?.classes?.name || '';
      const billed = (fs || []).filter((f: any) => !f.class_id || f.class_id === classId).reduce((a: number, b: any) => a + Number(b.amount), 0);
      const paid = paidMap[s.id] || 0;
      return { id: s.id, name: nameMap.get(s.user_id) || 'Unknown', admission: s.admission_number || '', class_id: classId, class_name: className, billed, paid, outstanding: Math.max(0, billed - paid) };
    });
    setRows(out); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r =>
      (classFilter === 'ALL' || r.class_id === classFilter) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.admission.toLowerCase().includes(q.toLowerCase()))
    );
  }, [rows, q, classFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Balances</CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Search name or admission #" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Class</TableHead>
              <TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.admission}</div></TableCell>
                  <TableCell>{r.class_name}</TableCell>
                  <TableCell className="text-right">{NGN(r.billed)}</TableCell>
                  <TableCell className="text-right text-green-600">{NGN(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold">{NGN(r.outstanding)}</TableCell>
                  <TableCell>{r.outstanding <= 0 ? <Badge>Cleared</Badge> : r.paid > 0 ? <Badge variant="outline">Partial</Badge> : <Badge variant="destructive">Owing</Badge>}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="h-4 w-4"/></Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No students match</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
        {selected && <StudentBalanceDrawer studentId={selected.id} name={selected.name} onClose={() => { setSelected(null); load(); }}/>}
      </CardContent>
    </Card>
  );
};