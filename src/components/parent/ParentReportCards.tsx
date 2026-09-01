import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChildren } from '@/contexts/ChildContext';
import { useReportCardBuilder } from '@/hooks/useReportCardBuilder';
import { useToast } from '@/hooks/use-toast';

interface Pub {
  id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  term: string;
  published_at: string;
  student_name: string;
  class_name: string;
  session_name: string;
}

export const ParentReportCards: React.FC<{ onViewResults?: () => void }> = ({ onViewResults }) => {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const [rows, setRows] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { buildAndPrint } = useReportCardBuilder();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data: parent } = await supabase.from('parents').select('id').eq('user_id', user.id).single();
      if (!parent) { setLoading(false); return; }
      if (!selectedChild?.can_view_grades) { setRows([]); setLoading(false); return; }
      const ids = [selectedChild.student_id];
      if (!ids.length) { setLoading(false); return; }

      const { data: pubs } = await supabase
        .from('report_card_publications')
        .select('*')
        .in('student_id', ids)
        .order('published_at', { ascending: false });

      const studentIds = Array.from(new Set((pubs || []).map((p: any) => p.student_id)));
      const classIds = Array.from(new Set((pubs || []).map((p: any) => p.class_id)));
      const sessionIds = Array.from(new Set((pubs || []).map((p: any) => p.session_id)));

      const [studs, classes, sessions] = await Promise.all([
        studentIds.length ? supabase.from('students').select('id,user_id').in('id', studentIds) : Promise.resolve({ data: [] as any }),
        classIds.length ? supabase.from('classes').select('id,name').in('id', classIds) : Promise.resolve({ data: [] as any }),
        sessionIds.length ? supabase.from('admission_sessions').select('id,session_name').in('id', sessionIds) : Promise.resolve({ data: [] as any }),
      ]);

      const uids = (studs.data || []).map((s: any) => s.user_id);
      const { data: profs } = uids.length
        ? await supabase.from('profiles').select('user_id,full_name').in('user_id', uids)
        : { data: [] as any };

      const nameByStudent = new Map<string, string>();
      (studs.data || []).forEach((s: any) => {
        const n = (profs || []).find((p: any) => p.user_id === s.user_id)?.full_name || '';
        nameByStudent.set(s.id, n);
      });
      const classMap = new Map<string, string>((classes.data || []).map((c: any) => [c.id, c.name as string]));
      const sessMap = new Map<string, string>((sessions.data || []).map((s: any) => [s.id, s.session_name as string]));

      setRows((pubs || []).map((p: any) => ({
        id: p.id,
        student_id: p.student_id,
        class_id: p.class_id,
        session_id: p.session_id,
        term: p.term,
        published_at: p.published_at,
        student_name: nameByStudent.get(p.student_id) || '',
        class_name: classMap.get(p.class_id) ?? '',
        session_name: sessMap.get(p.session_id) ?? '',
      })));
      setLoading(false);
    })();
  }, [user?.id, selectedChild?.student_id, selectedChild?.can_view_grades]);

  const handleDownload = async (r: Pub) => {
    setDownloadingId(r.id);
    try {
      await buildAndPrint({
        studentId: r.student_id,
        classId: r.class_id,
        sessionId: r.session_id,
        term: r.term,
      });
    } catch (e: any) {
      toast({ title: 'Failed to build report card', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Published Report Cards</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No report cards have been published yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.student_name}</TableCell>
                  <TableCell>{r.class_name}</TableCell>
                  <TableCell>{r.session_name}</TableCell>
                  <TableCell>{r.term}</TableCell>
                  <TableCell>{new Date(r.published_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={onViewResults}>
                        <FileText className="h-4 w-4 mr-2" />Results
                      </Button>
                      <Button size="sm" onClick={() => handleDownload(r)} disabled={downloadingId === r.id}>
                        {downloadingId === r.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Download
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ParentReportCards;