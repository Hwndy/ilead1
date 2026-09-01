import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Archive, ArrowRight, Info, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Mode = 'manual' | 'score';
type Action = 'promote' | 'graduate' | 'repeat';

interface Row {
  id: string;          // students.id
  user_id: string;     // auth user id (class_assignments.student_id)
  name: string;
  average: number | null;
}

const chunk = <T,>(arr: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const PromotionPanel: React.FC = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [nextClassId, setNextClassId] = useState('');
  const [mode, setMode] = useState<Mode>('manual');
  const [minAvg, setMinAvg] = useState(40);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasScores, setHasScores] = useState(true);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);

  useEffect(() => {
    (async () => {
      const [c, ss] = await Promise.all([
        supabase.from('classes').select('id,name').order('name'),
        supabase.from('admission_sessions').select('id,session_name,is_current').order('start_date', { ascending: false }),
      ]);
      setClasses(c.data || []);
      const list = ss.data || [];
      setSessions(list);
      const cur = list.find((x: any) => x.is_current) || list[0];
      if (cur) setSessionId(cur.id);
    })();
  }, []);

  useEffect(() => {
    if (!classId || !sessionId) { setRows([]); setSelected(new Set()); return; }
    (async () => {
      setLoading(true);
      setSelected(new Set());
      const { data: assigns } = await supabase.from('class_assignments').select('student_id').eq('class_id', classId);
      const uids = (assigns || []).map((a: any) => a.student_id);
      if (uids.length === 0) { setRows([]); setHasScores(false); setLoading(false); return; }
      const [{ data: studs }, { data: profs }] = await Promise.all([
        supabase.from('students').select('id,user_id,archived_at').in('user_id', uids),
        supabase.from('profiles').select('user_id,full_name').in('user_id', uids),
      ]);
      const active = (studs || []).filter((s: any) => !s.archived_at);
      const uToName = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

      const ids = active.map((s: any) => s.id);
      const { data: scores } = ids.length
        ? await supabase.from('v_student_term_scores')
            .select('student_id,test1,test2,exam_score,term')
            .in('student_id', ids).eq('class_id', classId).eq('session_id', sessionId)
        : { data: [] as any[] };

      const totals: Record<string, { sum: number; n: number }> = {};
      (scores || []).forEach((r: any) => {
        const t = (Number(r.test1) || 0) + (Number(r.test2) || 0) + (Number(r.exam_score) || 0);
        totals[r.student_id] = totals[r.student_id] || { sum: 0, n: 0 };
        totals[r.student_id].sum += t;
        totals[r.student_id].n += 1;
      });

      const any = (scores || []).length > 0;
      setHasScores(any);
      setMode(any ? 'score' : 'manual');

      setRows(active.map((s: any) => {
        const t = totals[s.id];
        return {
          id: s.id,
          user_id: s.user_id,
          name: uToName.get(s.user_id) || '',
          average: t && t.n ? Math.round((t.sum / t.n) * 10) / 10 : null,
        };
      }).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
  }, [classId, sessionId]);

  const visible = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase())),
    [rows, search]
  );

  // In score mode selection is derived from the pass mark; in manual mode it is explicit.
  const qualifying = useMemo(
    () => new Set(rows.filter(r => (r.average ?? 0) >= minAvg).map(r => r.id)),
    [rows, minAvg]
  );
  const effectiveSelected = mode === 'score' ? qualifying : selected;
  const selectedRows = rows.filter(r => effectiveSelected.has(r.id));

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allVisibleSelected = visible.length > 0 && visible.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allVisibleSelected) visible.forEach(r => n.delete(r.id));
    else visible.forEach(r => n.add(r.id));
    return n;
  });

  const academicYear = sessions.find(s => s.id === sessionId)?.session_name || null;
  const className = (id: string) => classes.find(c => c.id === id)?.name || '';

  const logHistory = async (
    list: Row[], to: string | null, type: 'promoted' | 'graduated' | 'repeated', notes: string
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    const payload = list.map(r => ({
      student_id: r.id,
      from_class_id: classId,
      to_class_id: to,
      academic_year: academicYear,
      promotion_type: type,
      promoted_by: auth?.user?.id ?? null,
      notes,
    }));
    for (const part of chunk(payload)) {
      await supabase.from('promotion_history').insert(part);
    }
  };

  const runPromote = async () => {
    if (!nextClassId) { toast({ title: 'Pick a destination class', variant: 'destructive' }); return; }
    if (!selectedRows.length) { toast({ title: 'No students selected', variant: 'destructive' }); return; }
    setWorking(true);
    try {
      const uids = selectedRows.map(r => r.user_id);
      // Move existing assignment rows for this class
      for (const part of chunk(uids)) {
        await supabase.from('class_assignments')
          .update({ class_id: nextClassId })
          .in('student_id', part)
          .eq('class_id', classId);
      }
      // Create rows for anyone who had no assignment in the destination class
      const { data: after } = await supabase.from('class_assignments')
        .select('student_id').eq('class_id', nextClassId).in('student_id', uids);
      const present = new Set((after || []).map((a: any) => a.student_id));
      const missing = uids.filter(u => !present.has(u)).map(u => ({ student_id: u, class_id: nextClassId }));
      if (missing.length) {
        for (const part of chunk(missing)) await supabase.from('class_assignments').insert(part);
      }
      await logHistory(selectedRows, nextClassId, 'promoted', `Promoted from ${className(classId)} to ${className(nextClassId)}`);
      toast({ title: 'Promotion complete', description: `${selectedRows.length} students promoted to ${className(nextClassId)}.` });
      setClassId(prev => prev); // keep filters
      setRows(rows.filter(r => !effectiveSelected.has(r.id)));
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Promotion failed', description: e.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const runGraduate = async () => {
    if (!selectedRows.length) { toast({ title: 'No students selected', variant: 'destructive' }); return; }
    setWorking(true);
    try {
      const ids = selectedRows.map(r => r.id);
      for (const part of chunk(ids)) {
        await supabase.from('students')
          .update({ archived_at: new Date().toISOString(), archived_reason: 'Graduated' })
          .in('id', part);
      }
      await logHistory(selectedRows, null, 'graduated', `Graduated from ${className(classId)}`);
      toast({ title: 'Graduated', description: `${ids.length} students moved to Past Students.` });
      setRows(rows.filter(r => !effectiveSelected.has(r.id)));
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Graduation failed', description: e.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const runRepeat = async () => {
    const list = rows.filter(r => !effectiveSelected.has(r.id));
    if (!list.length) { toast({ title: 'Everyone is selected  no one to keep back' }); return; }
    setWorking(true);
    try {
      await logHistory(list, classId, 'repeated', `Repeating ${className(classId)}`);
      toast({ title: 'Recorded', description: `${list.length} students marked to repeat ${className(classId)}.` });
    } catch (e: any) {
      toast({ title: 'Failed to record', description: e.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const confirmText: Record<Action, { title: string; body: string; run: () => Promise<void> }> = {
    promote: {
      title: 'Promote students?',
      body: `${selectedRows.length} student(s) will be moved from ${className(classId) || 'the current class'} to ${className(nextClassId) || ''}.`,
      run: runPromote,
    },
    graduate: {
      title: 'Graduate and archive?',
      body: `${selectedRows.length} student(s) from ${className(classId)} will be archived as graduated and moved to Past Students.`,
      run: runGraduate,
    },
    repeat: {
      title: 'Keep unselected students back?',
      body: `${rows.length - selectedRows.length} student(s) will be recorded as repeating ${className(classId)}. They stay in their current class.`,
      run: runRepeat,
    },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Promotion & Graduation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2"><Label>Current class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>{sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Promote to</Label>
              <Select value={nextClassId} onValueChange={setNextClassId}>
                <SelectTrigger><SelectValue placeholder="Next class" /></SelectTrigger>
                <SelectContent>{classes.filter(c => c.id !== classId).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual selection</SelectItem>
                  <SelectItem value="score" disabled={!hasScores}>Score-based (pass mark)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'score' && (
            <div className="space-y-2 max-w-[200px]">
              <Label>Pass mark (%)</Label>
              <Input type="number" min={0} max={100} value={minAvg}
                onChange={(e) => setMinAvg(Number(e.target.value) || 0)} />
            </div>
          )}

          {classId && !hasScores && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>No results recorded for this class in the selected session. Use manual selection to move students to their next class.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setConfirm('promote')} disabled={working || !selectedRows.length || !nextClassId}>
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Promote selected ({selectedRows.length})
            </Button>
            <Button variant="outline" onClick={() => setConfirm('graduate')} disabled={working || !selectedRows.length}>
              <Archive className="h-4 w-4 mr-2" />Graduate & archive selected
            </Button>
            <Button variant="ghost" onClick={() => setConfirm('repeat')} disabled={working || !rows.length}>
              <RotateCcw className="h-4 w-4 mr-2" />Keep unselected in current class
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          : rows.length === 0 ? <div className="py-12 text-center text-muted-foreground">Select a class and session.</div>
          : (
            <>
              <div className="p-3 border-b flex flex-wrap items-center gap-3">
                <Input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
                <span className="text-sm text-muted-foreground">{selectedRows.length} of {rows.length} selected</span>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} disabled={mode === 'score'} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Session Average</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visible.map(r => {
                    const isSel = effectiveSelected.has(r.id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} disabled={mode === 'score'} aria-label={`Select ${r.name}`} />
                        </TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-center">{r.average === null ? <span className="text-muted-foreground">No results</span> : `${r.average}%`}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isSel ? 'default' : 'secondary'}>{isSel ? 'Promote' : 'Stay'}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? confirmText[confirm].title : ''}</AlertDialogTitle>
            <AlertDialogDescription>{confirm ? confirmText[confirm].body : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { const a = confirm; setConfirm(null); if (a) await confirmText[a].run(); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PromotionPanel;
