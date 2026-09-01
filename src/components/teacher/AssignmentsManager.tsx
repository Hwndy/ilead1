import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Paperclip, Trash2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { validateUpload } from '@/lib/file-upload-guards';

interface Assignment {
  id: string;
  class_id: string;
  subject_id: string | null;
  title: string;
  instructions: string | null;
  attachment_url: string | null;
  due_date: string | null;
  max_score: number | null;
  is_published: boolean;
  created_at: string;
}

export const AssignmentsManager: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grading, setGrading] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    class_id: '', subject_id: '', title: '', instructions: '',
    due_date: '', max_score: '', is_published: true, attachment: null as File | null,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const [{ data: cls }, { data: sub }] = await Promise.all([
        supabase.from('classes').select('id,name').order('name'),
        supabase.from('subjects').select('id,name').order('name'),
      ]);
      setClasses((cls as any) || []);
      setSubjects((sub as any) || []);
    })();
  }, []);

  const submit = async () => {
    if (!user || !form.class_id || !form.title) {
      toast.error('Class and title are required');
      return;
    }
    setSaving(true);
    try {
      let attachment_url: string | null = null;
      if (form.attachment) {
        const path = `assignments/${user.id}/${Date.now()}-${form.attachment.name}`;
        const { error: upErr } = await supabase.storage.from('assignments').upload(path, form.attachment);
        if (upErr) throw upErr;
        attachment_url = path;
      }
      const { error } = await supabase.from('assignments').insert({
        class_id: form.class_id,
        subject_id: form.subject_id || null,
        teacher_id: user.id,
        title: form.title,
        instructions: form.instructions || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        max_score: form.max_score ? Number(form.max_score) : null,
        is_published: form.is_published,
        attachment_url,
      });
      if (error) throw error;
      toast.success('Assignment created');
      setOpen(false);
      setForm({ class_id: '', subject_id: '', title: '', instructions: '', due_date: '', max_score: '', is_published: true, attachment: null });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  const togglePublish = async (a: Assignment) => {
    await supabase.from('assignments').update({ is_published: !a.is_published }).eq('id', a.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Assignments</h2>
          <p className="text-sm text-muted-foreground">Post homework and grade student submissions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Assignment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Class</Label>
                <Select value={form.class_id} onValueChange={(v) => setForm(f => ({ ...f, class_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject (optional)</Label>
                <Select value={form.subject_id} onValueChange={(v) => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Instructions</Label><Textarea rows={5} value={form.instructions} onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Due date</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                <div><Label>Max score</Label><Input type="number" value={form.max_score} onChange={(e) => setForm(f => ({ ...f, max_score: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Attachment (optional, max 10MB)</Label>
                <Input type="file" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const err = validateUpload(file);
                    if (err) { toast.error(err); return; }
                  }
                  setForm(f => ({ ...f, attachment: file }));
                }} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div> :
        rows.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No assignments yet.</CardContent></Card> :
        <div className="grid gap-3">
          {rows.map(a => {
            const cls = classes.find(c => c.id === a.class_id)?.name;
            const sub = subjects.find(s => s.id === a.subject_id)?.name;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{a.title}</h3>
                      <Badge variant={a.is_published ? 'default' : 'secondary'}>{a.is_published ? 'Published' : 'Draft'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cls} {sub && `• ${sub}`}
                      {a.due_date && ` • Due ${format(new Date(a.due_date), 'PP p')}`}
                      {a.max_score && ` • ${a.max_score} pts`}
                    </p>
                    {a.instructions && <p className="text-sm mt-2 line-clamp-2">{a.instructions}</p>}
                    {a.attachment_url && <p className="text-xs mt-1 flex items-center gap-1 text-primary"><Paperclip className="h-3 w-3" /> attachment</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setGrading(a)}><GraduationCap className="h-4 w-4 mr-1" /> Submissions</Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(a)}>{a.is_published ? 'Unpublish' : 'Publish'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }

      {grading && <SubmissionsDialog assignment={grading} onClose={() => setGrading(null)} />}
    </div>
  );
};

const SubmissionsDialog: React.FC<{ assignment: Assignment; onClose: () => void }> = ({ assignment, onClose }) => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assignment_submissions')
      .select('*, students(admission_number, user_id, profiles:user_id(full_name))')
      .eq('assignment_id', assignment.id)
      .order('submitted_at', { ascending: false });
    setSubs((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [assignment.id]);

  const grade = async (id: string, score: number, feedback: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('assignment_submissions').update({
      score, feedback, graded_by: user?.id, graded_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Graded'); load(); }
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from('assignments').createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Submissions  {assignment.title}</DialogTitle></DialogHeader>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div> :
          subs.length === 0 ? <p className="text-center text-muted-foreground py-6">No submissions yet.</p> :
          <div className="space-y-3">
            {subs.map(s => (
              <div key={s.id} className="border rounded p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium">{s.students?.profiles?.full_name || s.students?.admission_number}</p>
                    <p className="text-xs text-muted-foreground">Submitted {format(new Date(s.submitted_at), 'PP p')}</p>
                  </div>
                  {s.attachment_url && <Button size="sm" variant="outline" onClick={() => downloadAttachment(s.attachment_url)}><Paperclip className="h-4 w-4 mr-1" /> File</Button>}
                </div>
                {s.content && <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">{s.content}</p>}
                <GradeForm sub={s} maxScore={assignment.max_score} onGrade={grade} />
              </div>
            ))}
          </div>
        }
      </DialogContent>
    </Dialog>
  );
};

const GradeForm: React.FC<{ sub: any; maxScore: number | null; onGrade: (id: string, score: number, feedback: string) => void }> = ({ sub, maxScore, onGrade }) => {
  const [score, setScore] = useState(sub.score?.toString() || '');
  const [feedback, setFeedback] = useState(sub.feedback || '');
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-end pt-2 border-t">
      <div className="flex-1"><Label className="text-xs">Score {maxScore ? `/ ${maxScore}` : ''}</Label><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></div>
      <div className="flex-[2]"><Label className="text-xs">Feedback</Label><Input value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
      <Button size="sm" onClick={() => onGrade(sub.id, Number(score), feedback)}>Save</Button>
    </div>
  );
};