import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Send, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReportCardBuilder } from '@/hooks/useReportCardBuilder';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClassRow { id: string; name: string; }
interface SessionRow { id: string; session_name: string; academic_year: string; is_current?: boolean; }
interface StudentRow { id: string; admission_number: string; full_name: string; }

const TERMS = ['First Term', 'Second Term', 'Third Term'];

export const BulkReportCards: React.FC = () => {
  const { toast } = useToast();
  const { buildHtml } = useReportCardBuilder();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [classId, setClassId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [term, setTerm] = useState<string>('First Term');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('admission_sessions').select('id, session_name, academic_year, is_current').order('academic_year', { ascending: false }),
      ]);
      setClasses((cs || []) as any);
      setSessions((ss || []) as any);
      const current = (ss || []).find((s: any) => s.is_current);
      if (current) setSessionId(current.id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    (async () => {
      const { data: ca } = await supabase.from('class_assignments').select('student_id').eq('class_id', classId);
      const ids = (ca || []).map((c: any) => c.student_id);
      if (!ids.length) { setStudents([]); return; }
      const { data: sts } = await supabase.from('students').select('id, user_id, admission_number').in('id', ids);
      const uids = (sts || []).map((s: any) => s.user_id).filter(Boolean);
      const { data: profs } = uids.length ? await supabase.from('profiles').select('user_id, full_name').in('user_id', uids) : { data: [] as any };
      const nameMap = new Map<string, string>((profs || []).map((p: any) => [p.user_id, p.full_name]));
      const rows: StudentRow[] = (sts || []).map((s: any) => ({
        id: s.id, admission_number: s.admission_number || '', full_name: nameMap.get(s.user_id) || '',
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));
      setStudents(rows);
      setSelected(Object.fromEntries(rows.map(r => [r.id, true])));
    })();
  }, [classId]);

  const chosen = useMemo(() => students.filter(s => selected[s.id]), [students, selected]);
  const allChecked = students.length > 0 && chosen.length === students.length;

  const zipAsPdfs = async () => {
    if (!classId || !sessionId || !chosen.length) return;
    setBusy(true);
    setProgress({ done: 0, total: chosen.length });
    try {
      const zip = new JSZip();
      for (let i = 0; i < chosen.length; i++) {
        const st = chosen[i];
        const { html, filename } = await buildHtml({ studentId: st.id, classId, sessionId, term });
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed'; iframe.style.left = '-10000px'; iframe.style.top = '0';
        iframe.style.width = '900px'; iframe.style.height = '1400px';
        document.body.appendChild(iframe);
        try {
          const doc = iframe.contentDocument!;
          doc.open(); doc.write(html); doc.close();
          await new Promise(r => setTimeout(r, 500));
          const target = doc.body;
          if (target) {
            const canvas = await html2canvas(target as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const img = canvas.toDataURL('image/jpeg', 0.92);
            const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
            const w = canvas.width * ratio; const h = canvas.height * ratio;
            pdf.addImage(img, 'JPEG', (pageW - w) / 2, 20, w, h);
            const blob = pdf.output('blob');
            zip.file(filename, blob);
          }
        } finally {
          document.body.removeChild(iframe);
        }
        setProgress({ done: i + 1, total: chosen.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cls = classes.find(c => c.id === classId)?.name || 'class';
      a.href = url; a.download = `report-cards_${cls}_${term.replace(/\s+/g,'_')}.zip`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: 'ZIP ready', description: `${chosen.length} PDF(s) packaged.` });
    } catch (e: any) {
      toast({ title: 'ZIP failed', description: e.message || 'Try downloading individually', variant: 'destructive' });
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const emailParents = async () => {
    if (!classId || !sessionId || !chosen.length) return;
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-report-cards', {
        body: { student_ids: chosen.map(c => c.id), class_id: classId, session_id: sessionId, term },
      });
      if (error) throw error;
      toast({ title: 'Sent', description: `${(data as any)?.sent || 0} email(s) queued.` });
    } catch (e: any) {
      toast({ title: 'Email failed', description: e.message, variant: 'destructive' });
    } finally { setEmailing(false); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Bulk Report Cards</CardTitle>
        <CardDescription>Package a whole class as PDFs, or email each parent directly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1"><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Choose session" /></SelectTrigger>
              <SelectContent>{sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.session_name} ({s.academic_year})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {students.length > 0 && (
          <div className="border rounded-md">
            <div className="flex items-center justify-between p-2 border-b bg-muted/40">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(c) => setSelected(Object.fromEntries(students.map(s => [s.id, !!c])))}
                />
                Select all ({chosen.length}/{students.length})
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={zipAsPdfs} disabled={busy || !chosen.length}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {busy && progress ? `${progress.done}/${progress.total}` : 'Download ZIP'}
                </Button>
                <Button size="sm" variant="secondary" onClick={emailParents} disabled={emailing || !chosen.length}>
                  {emailing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Email parents
                </Button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Name</TableHead><TableHead>Adm #</TableHead></TableRow></TableHeader>
                <TableBody>
                  {students.map(s => (
                    <TableRow key={s.id}>
                      <TableCell><Checkbox checked={!!selected[s.id]} onCheckedChange={(c) => setSelected(p => ({ ...p, [s.id]: !!c }))} /></TableCell>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{s.admission_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {classId && students.length === 0 && (
          <p className="text-sm text-muted-foreground">No students in this class yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkReportCards;