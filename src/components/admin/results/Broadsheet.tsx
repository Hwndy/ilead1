import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { fetchClassRoster, RosterStudent, toCsv, downloadCsv } from '@/lib/class-roster';
import { printNode } from '@/lib/print-node';

const TERMS: Record<string, 'first' | 'second' | 'third'> = {
  'First Term': 'first', 'Second Term': 'second', 'Third Term': 'third',
};

export const Broadsheet: React.FC = () => {
  const { classes, subjects, loading: scopeLoading } = useTeacherScope();
  const [sessions, setSessions] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admission_sessions')
        .select('id,session_name,is_current')
        .order('start_date', { ascending: false });
      const list = data || [];
      setSessions(list);
      const cur = list.find((x: any) => x.is_current) || list[0];
      if (cur) setSessionId(cur.id);
    })();
  }, []);

  useEffect(() => {
    if (!classId || !sessionId) { setRows([]); setStudents([]); return; }
    const id = ++requestId.current;
    (async () => {
      setLoading(true);
      try {
        const [roster, scores] = await Promise.all([
          fetchClassRoster(classId),
          supabase
            .from('v_student_term_scores')
            .select('*')
            .eq('class_id', classId)
            .eq('session_id', sessionId)
            .eq('term', TERMS[term]),
        ]);
        if (id !== requestId.current) return;
        setStudents(roster);
        setRows(scores.data || []);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
  }, [classId, sessionId, term]);

  const grid = useMemo(() => {
    const byStudent: Record<string, Record<string, number>> = {};
    rows.forEach((r: any) => {
      const total = (Number(r.test1) || 0) + (Number(r.test2) || 0) + (Number(r.exam_score) || 0);
      byStudent[r.student_id] = byStudent[r.student_id] || {};
      byStudent[r.student_id][r.subject_id] = total;
    });
    return byStudent;
  }, [rows]);

  const table = useMemo(() => {
    const body = students.map(st => {
      const scores = subjects.map(s => grid[st.student_id]?.[s.id]);
      const nums = scores.filter(v => typeof v === 'number') as number[];
      const total = nums.reduce((a, b) => a + b, 0);
      const avg = nums.length ? Math.round((total / nums.length) * 10) / 10 : 0;
      return { student: st, scores, total, avg, recorded: nums.length };
    });
    const ranked = [...body].sort((a, b) => b.total - a.total);
    const positionOf = new Map(ranked.map((r, i) => [r.student.student_id, i + 1]));
    return body.map(r => ({ ...r, position: r.recorded ? positionOf.get(r.student.student_id)! : null }));
  }, [students, subjects, grid]);

  const subjectAverages = useMemo(
    () => subjects.map(s => {
      const nums = students
        .map(st => grid[st.student_id]?.[s.id])
        .filter(v => typeof v === 'number') as number[];
      return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
    }),
    [subjects, students, grid]
  );

  const className = classes.find(c => c.id === classId)?.name || 'class';
  const sessionName = sessions.find((s: any) => s.id === sessionId)?.session_name || '';
  const hasScores = rows.length > 0;

  const exportCsv = () => {
    const header = ['Student', 'Admission No', ...subjects.map(s => s.name), 'Total', 'Average', 'Position'];
    const body = table.map(r => [
      r.student.full_name,
      r.student.admission_number || '',
      ...r.scores.map(v => (typeof v === 'number' ? v : '')),
      r.total,
      r.avg,
      r.position ?? '',
    ]);
    downloadCsv(
      `broadsheet-${className}-${term}-${sessionName}.csv`.replace(/\s+/g, '-').toLowerCase(),
      toCsv([header, ...body])
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Termly Broadsheet</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId} disabled={scopeLoading}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(TERMS).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>{sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !classId || !sessionId ? (
            <div className="py-12 text-center text-muted-foreground">Select a class, term and session.</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No students are assigned to this class yet.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
                {!hasScores ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    No scores recorded for {className} in {term}, {sessionName}. Enter them under Enter Scores.
                  </p>
                ) : <span className="text-sm text-muted-foreground">{students.length} students</span>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => printNode(printRef.current, {
                      pageSize: 'A4 landscape',
                      title: `Broadsheet ${className} ${term}`,
                    })}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto" ref={printRef}>
                <div className="px-4 pt-4 hidden print:block">
                  <h2 className="text-lg font-bold">Broadsheet  {className}</h2>
                  <p className="text-sm">{term}, {sessionName}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      {subjects.map(s => <TableHead key={s.id} className="text-center">{s.name}</TableHead>)}
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Avg</TableHead>
                      <TableHead className="text-center">Pos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.map(r => (
                      <TableRow key={r.student.student_id}>
                        <TableCell>
                          <div className="font-medium">{r.student.full_name}</div>
                          {r.student.admission_number && (
                            <div className="text-xs text-muted-foreground">{r.student.admission_number}</div>
                          )}
                        </TableCell>
                        {r.scores.map((v, i) => (
                          <TableCell key={i} className="text-center">{typeof v === 'number' ? v : ''}</TableCell>
                        ))}
                        <TableCell className="text-center font-semibold">{r.recorded ? r.total : ''}</TableCell>
                        <TableCell className="text-center">{r.recorded ? `${r.avg}%` : ''}</TableCell>
                        <TableCell className="text-center">{r.position ?? ''}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Class average</TableCell>
                      {subjectAverages.map((v, i) => (
                        <TableCell key={i} className="text-center">{v ?? ''}</TableCell>
                      ))}
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Broadsheet;
