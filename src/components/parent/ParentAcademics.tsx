import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useChildren } from '@/contexts/ChildContext';
import { Loader2, TrendingUp, Award, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGradingScale, gradeFor, gradeColor, GradeBand } from '@/lib/grading';

interface ScoreRow {
  student_id: string; session_id: string; term: string; class_id: string;
  subject_id: string; test1: number | null; test2: number | null;
  exam_score: number | null; total: number | null; subject_position: number | null;
}

export const ParentAcademics: React.FC = () => {
  const { selectedChild } = useChildren();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; session_name: string }>>([]);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string>('all');
  const [term, setTerm] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [bands, setBands] = useState<GradeBand[]>([]);

  useEffect(() => {
    (async () => {
      if (!selectedChild) return;
      setLoading(true);
      const b = await getGradingScale();
      setBands(b);
      const { data } = await supabase
        .from('v_student_term_scores')
        .select('*')
        .eq('student_id', selectedChild.student_id);
      const list = (data || []) as ScoreRow[];
      setRows(list);
      const subjIds = Array.from(new Set(list.map(r => r.subject_id)));
      const sesIds = Array.from(new Set(list.map(r => r.session_id)));
      const [{ data: subs }, { data: ses }] = await Promise.all([
        subjIds.length ? supabase.from('subjects').select('id,name').in('id', subjIds) : Promise.resolve({ data: [] as any }),
        sesIds.length ? supabase.from('admission_sessions').select('id,session_name').in('id', sesIds) : Promise.resolve({ data: [] as any }),
      ]);
      const smap: Record<string, string> = {};
      (subs || []).forEach((s: any) => { smap[s.id] = s.name; });
      setSubjects(smap);
      setSessions((ses || []) as any);
      setLoading(false);
    })();
  }, [selectedChild?.student_id]);

  const filtered = useMemo(() => rows.filter(r =>
    (sessionId === 'all' || r.session_id === sessionId) &&
    (term === 'all' || r.term === term)
  ), [rows, sessionId, term]);

  const overall = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + (r.total || 0), 0) / filtered.length)
    : 0;
  const best = filtered.length ? Math.max(...filtered.map(r => r.total || 0)) : 0;

  const grade = (score: number) => {
    const b = gradeFor(score, bands);
    return { label: b.grade, color: gradeColor(b.grade) };
  };

  if (!selectedChild) return <Card><CardContent className="p-6 text-center text-muted-foreground">Select a child.</CardContent></Card>;
  if (!selectedChild.can_view_grades) return <Card><CardContent className="p-6 text-center text-muted-foreground">No grades access.</CardContent></Card>;
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Session" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Term" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms</SelectItem>
            <SelectItem value="First Term">First Term</SelectItem>
            <SelectItem value="Second Term">Second Term</SelectItem>
            <SelectItem value="Third Term">Third Term</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Overall Average</CardDescription><CardTitle className={grade(overall).color}>{overall}%</CardTitle></CardHeader>
          <CardContent><Progress value={overall} className="h-2" /></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> Subjects</CardDescription><CardTitle>{filtered.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Award className="h-4 w-4" /> Best</CardDescription><CardTitle className="text-green-600">{best}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Subject Performance</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No results for the selected filters.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r, i) => {
                const g = grade(r.total || 0);
                return (
                  <div key={i} className="border rounded-md p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{subjects[r.subject_id] || 'Subject'}</p>
                        <p className="text-xs text-muted-foreground">{r.term}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${g.color}`}>{r.total || 0}%</span>
                        <div><Badge variant="outline">{g.label}</Badge></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>Test 1: <span className="font-semibold text-foreground">{r.test1 ?? ''}</span></div>
                      <div>Test 2: <span className="font-semibold text-foreground">{r.test2 ?? ''}</span></div>
                      <div>Exam: <span className="font-semibold text-foreground">{r.exam_score ?? ''}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};