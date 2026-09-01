import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, CalendarDays } from 'lucide-react';

interface ClassRow { id: string; name: string; }
interface Row {
  student_id: string; full_name: string; admission_number: string; class_name: string;
  present: number; absent: number; late: number; total: number;
}

const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const AttendanceReports: React.FC = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>('all');
  const [start, setStart] = useState<string>(() => { const d = new Date(); d.setDate(1); return toISO(d); });
  const [end, setEnd] = useState<string>(() => toISO(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('classes').select('id, name').order('name').then(({ data }) => setClasses((data || []) as any));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_attendance_summary', {
        p_start: start, p_end: end, p_class_id: classId === 'all' ? null : classId,
      });
      if (error) throw error;
      setRows(((data as any)?.rows || []) as Row[]);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const stats = useMemo(() => {
    const p = rows.reduce((s, r) => s + r.present, 0);
    const a = rows.reduce((s, r) => s + r.absent, 0);
    const l = rows.reduce((s, r) => s + r.late, 0);
    const t = p + a + l;
    return { p, a, l, t, rate: t ? Math.round(((p + l) / t) * 100) : 0 };
  }, [rows]);

  const exportCsv = () => {
    const header = 'Name,Admission #,Class,Present,Absent,Late,Total,Rate %\n';
    const body = rows.map(r => {
      const total = r.present + r.absent + r.late;
      const rate = total ? Math.round(((r.present + r.late) / total) * 100) : 0;
      return [r.full_name, r.admission_number, r.class_name || '', r.present, r.absent, r.late, total, rate].join(',');
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${start}_${end}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Attendance Reports</CardTitle>
          <CardDescription>Filter by date range and class. Export to CSV.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="grid gap-1"><Label>From</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="grid gap-1"><Label>To</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
            <div className="grid gap-1 md:col-span-2"><Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run'}</Button>
              <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Attendance rate</CardDescription><CardTitle className="text-3xl">{stats.rate}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Present</CardDescription><CardTitle className="text-green-600">{stats.p}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Late</CardDescription><CardTitle className="text-yellow-600">{stats.l}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Absent</CardDescription><CardTitle className="text-red-600">{stats.a}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Per-student summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div> : rows.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No data in the selected range.</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Adm #</TableHead><TableHead>Class</TableHead>
                  <TableHead className="text-right">Present</TableHead><TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Rate</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => {
                    const t = r.present + r.absent + r.late;
                    const rate = t ? Math.round(((r.present + r.late) / t) * 100) : 0;
                    return (
                      <TableRow key={r.student_id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell>{r.admission_number}</TableCell>
                        <TableCell>{r.class_name || ''}</TableCell>
                        <TableCell className="text-right">{r.present}</TableCell>
                        <TableCell className="text-right">{r.late}</TableCell>
                        <TableCell className="text-right">{r.absent}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rate >= 80 ? 'default' : rate >= 60 ? 'secondary' : 'destructive'}>{rate}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReports;