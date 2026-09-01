import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download, Loader2, Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { fetchClassRoster, RosterStudent, toCsv, downloadCsv } from '@/lib/class-roster';

interface DetailState {
  student: RosterStudent;
  loading: boolean;
  attendance: { present: number; total: number } | null;
  scores: Array<{ subject: string; term: string; total: number }>;
}

const TERM_LABEL: Record<string, string> = {
  first: 'First Term', second: 'Second Term', third: 'Third Term',
};

export const TeacherStudentsList: React.FC = () => {
  const { classes, subjects, loading: scopeLoading, unscoped } = useTeacherScope();
  const [classId, setClassId] = useState('');
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DetailState | null>(null);

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    if (!classId) { setRoster([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchClassRoster(classId);
        if (!cancelled) setRoster(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q)
    );
  }, [roster, search]);

  const className = classes.find(c => c.id === classId)?.name || 'class';

  const exportCsv = () => {
    const header = ['Name', 'Admission number', 'Status'];
    const body = filtered.map(s => [s.full_name, s.admission_number || '', s.status || '']);
    downloadCsv(
      `${className}-students.csv`.replace(/\s+/g, '-').toLowerCase(),
      toCsv([header, ...body])
    );
  };

  const openStudent = async (student: RosterStudent) => {
    setDetail({ student, loading: true, attendance: null, scores: [] });
    try {
      const [scoreRes, attRes] = await Promise.all([
        supabase
          .from('v_student_term_scores')
          .select('subject_id, term, test1, test2, exam_score')
          .eq('student_id', student.student_id),
        supabase
          .from('student_attendance')
          .select('status')
          .eq('student_id', student.student_id),
      ]);

      const nameBySubject = new Map(subjects.map(s => [s.id, s.name]));
      const scores = (scoreRes.data || []).map((r: any) => ({
        subject: nameBySubject.get(r.subject_id) || 'Subject',
        term: TERM_LABEL[r.term] || r.term,
        total: (Number(r.test1) || 0) + (Number(r.test2) || 0) + (Number(r.exam_score) || 0),
      }));

      const attRows = attRes.data || [];
      const attendance = attRows.length
        ? { present: attRows.filter((a: any) => a.status === 'present').length, total: attRows.length }
        : null;

      setDetail(d => (d && d.student.student_id === student.student_id
        ? { ...d, loading: false, scores, attendance }
        : d));
    } catch {
      setDetail(d => (d ? { ...d, loading: false } : d));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Students</h2>
        <p className="text-muted-foreground">Class rosters for the classes you teach.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select a class</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId} disabled={scopeLoading}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name or admission number"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          {unscoped && (
            <p className="sm:col-span-3 text-xs text-muted-foreground">
              You have no class assignments recorded, so every class is listed.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {filtered.length} student{filtered.length === 1 ? '' : 's'} in {className}
            </span>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export class list
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No students found for this class.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission number</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow
                      key={s.student_id}
                      className="cursor-pointer"
                      onClick={() => openStudent(s)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {s.photo_url && <AvatarImage src={s.photo_url} alt={s.full_name} />}
                            <AvatarFallback>{s.full_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{s.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{s.admission_number || ''}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'active' || !s.status ? 'secondary' : 'outline'}>
                          {s.status || 'active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.student.full_name}</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-6 mt-4">
              <div className="text-sm text-muted-foreground">
                {detail.student.admission_number || 'No admission number'} · {className}
              </div>

              {detail.loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <>
                  <div>
                    <h4 className="font-semibold mb-2">Attendance</h4>
                    {detail.attendance ? (
                      <p className="text-sm">
                        {Math.round((detail.attendance.present / detail.attendance.total) * 100)}% present
                        <span className="text-muted-foreground"> ({detail.attendance.present} of {detail.attendance.total} records)</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Recorded scores</h4>
                    {detail.scores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No scores recorded yet.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {detail.scores.map((s, i) => (
                          <li key={i} className="flex justify-between border-b py-1">
                            <span>{s.subject} · {s.term}</span>
                            <span className="font-medium">{s.total}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TeacherStudentsList;
