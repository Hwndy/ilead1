import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateUpload } from '@/lib/file-upload-guards';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Paperclip, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';

export const StudentAssignments: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [subs, setSubs] = useState<Record<string, any>>({});
  const [meta, setMeta] = useState<{ classes: Record<string, string>; subjects: Record<string, string> }>({ classes: {}, subjects: {} });
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
    setStudentId(st?.id || null);
    const { data: asgs } = await supabase.from('assignments').select('*').eq('is_published', true).order('due_date', { ascending: true });
    setRows((asgs as any) || []);
    if (st?.id) {
      const { data: mySubs } = await supabase.from('assignment_submissions').select('*').eq('student_id', st.id);
      const map: Record<string, any> = {};
      (mySubs || []).forEach((s: any) => { map[s.assignment_id] = s; });
      setSubs(map);
    }
    const clsIds = Array.from(new Set((asgs || []).map((a: any) => a.class_id)));
    const subIds = Array.from(new Set((asgs || []).map((a: any) => a.subject_id).filter(Boolean)));
    const [{ data: cls }, { data: sub }] = await Promise.all([
      clsIds.length ? supabase.from('classes').select('id,name').in('id', clsIds) : Promise.resolve({ data: [] as any }),
      subIds.length ? supabase.from('subjects').select('id,name').in('id', subIds) : Promise.resolve({ data: [] as any }),
    ]);
    const cm: Record<string, string> = {}, sm: Record<string, string> = {};
    (cls || []).forEach((c: any) => { cm[c.id] = c.name; });
    (sub || []).forEach((s: any) => { sm[s.id] = s.name; });
    setMeta({ classes: cm, subjects: sm });
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;
  if (!studentId) return <Card><CardContent className="p-8 text-center text-muted-foreground">No student record found.</CardContent></Card>;
  if (rows.length === 0) return <Card><CardContent className="p-8 text-center text-muted-foreground">No assignments yet.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Assignments</h2>
      <div className="grid gap-3">
        {rows.map(a => {
          const sub = subs[a.id];
          const overdue = a.due_date && isPast(new Date(a.due_date)) && !sub;
          return (
            <Card key={a.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    {sub?.graded_at ? <Badge>Graded {sub.score}{a.max_score ? `/${a.max_score}` : ''}</Badge> :
                      sub ? <Badge variant="secondary">Submitted</Badge> :
                      overdue ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="outline">Pending</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {meta.classes[a.class_id]} {a.subject_id && `• ${meta.subjects[a.subject_id]}`}
                    {a.due_date && ` • Due ${format(new Date(a.due_date), 'PP p')}`}
                  </p>
                  {a.instructions && <p className="text-sm mt-2 whitespace-pre-wrap">{a.instructions}</p>}
                  {sub?.feedback && <p className="text-sm mt-2 text-muted-foreground italic">Feedback: {sub.feedback}</p>}
                </div>
                <Button size="sm" onClick={() => setTarget(a)} disabled={!!sub?.graded_at}>
                  <Send className="h-4 w-4 mr-1" /> {sub ? 'Update' : 'Submit'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {target && <SubmitDialog assignment={target} studentId={studentId} existing={subs[target.id]} onClose={() => setTarget(null)} onSaved={load} />}
    </div>
  );
};

const SubmitDialog: React.FC<{ assignment: any; studentId: string; existing: any; onClose: () => void; onSaved: () => void }> = ({ assignment, studentId, existing, onClose, onSaved }) => {
  const [content, setContent] = useState(existing?.content || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      let attachment_url = existing?.attachment_url || null;
      if (file) {
        const path = `submissions/${studentId}/${assignment.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('assignments').upload(path, file);
        if (upErr) throw upErr;
        attachment_url = path;
      }
      const { error } = await supabase.from('assignment_submissions').upsert({
        assignment_id: assignment.id, student_id: studentId,
        content: content || null, attachment_url, submitted_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;
      toast.success('Submitted');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Submit  {assignment.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Your work</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div><Label>Attachment (optional, max 10MB)</Label>
            <Input type="file" onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f) { const err = validateUpload(f); if (err) { toast.error(err); return; } }
              setFile(f);
            }} />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Submit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};