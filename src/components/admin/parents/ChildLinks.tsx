import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link2, Loader2, Unlink } from 'lucide-react';
import { LinkParentStudentDialog } from './LinkParentStudentDialog';

interface Row {
  id: string;
  parent_name: string;
  student_name: string;
  admission_number: string | null;
  class_name: string | null;
  relationship_type: string;
  verified: boolean;
}

export const ChildLinks: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [linkOpen, setLinkOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rels } = await supabase
        .from('student_parent_relationships')
        .select('id,parent_id,student_id,relationship_type,verified')
        .order('created_at', { ascending: false });
      const parentIds = [...new Set((rels || []).map((r: any) => r.parent_id))];
      const studentIds = [...new Set((rels || []).map((r: any) => r.student_id))];
      const [{ data: parents }, { data: students }] = await Promise.all([
        parentIds.length ? supabase.from('parents').select('id,user_id').in('id', parentIds) : Promise.resolve({ data: [] as any }),
        studentIds.length ? supabase.from('students').select('id,user_id,admission_number').in('id', studentIds) : Promise.resolve({ data: [] as any }),
      ]);
      const puids = (parents || []).map((p: any) => p.user_id).filter(Boolean);
      const suids = (students || []).map((s: any) => s.user_id).filter(Boolean);
      // class_assignments.student_id stores the student's auth user_id, not students.id
      const { data: cas } = suids.length
        ? await supabase.from('class_assignments').select('student_id,class_id').in('student_id', suids)
        : { data: [] as any };
      const cids = (cas || []).map((c: any) => c.class_id).filter(Boolean);
      const [{ data: pprof }, { data: sprof }, { data: classes }] = await Promise.all([
        puids.length ? supabase.from('profiles').select('user_id,full_name').in('user_id', puids) : Promise.resolve({ data: [] as any }),
        suids.length ? supabase.from('profiles').select('user_id,full_name').in('user_id', suids) : Promise.resolve({ data: [] as any }),
        cids.length ? supabase.from('classes').select('id,name').in('id', cids) : Promise.resolve({ data: [] as any }),
      ]);
      const built: Row[] = (rels || []).map((r: any) => {
        const p = parents?.find((x: any) => x.id === r.parent_id);
        const s = students?.find((x: any) => x.id === r.student_id);
        const ca = cas?.find((x: any) => x.student_id === s?.user_id);
        const cls = classes?.find((c: any) => c.id === ca?.class_id);
        return {
          id: r.id,
          parent_name: pprof?.find((x: any) => x.user_id === p?.user_id)?.full_name || '',
          student_name: sprof?.find((x: any) => x.user_id === s?.user_id)?.full_name || s?.admission_number || '',
          admission_number: s?.admission_number || null,
          class_name: cls?.name || null,
          relationship_type: r.relationship_type,
          verified: r.verified,
        };
      });
      setRows(built);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(r => {
      const qm = !t || r.parent_name.toLowerCase().includes(t) || r.student_name.toLowerCase().includes(t) || (r.admission_number || '').toLowerCase().includes(t);
      const fm = filter === 'all' || (filter === 'verified' ? r.verified : !r.verified);
      return qm && fm;
    });
  }, [rows, q, filter]);

  const unlink = async (id: string) => {
    if (!confirm('Unlink this parent-child relationship?')) return;
    const { error } = await supabase.rpc('admin_unlink_parent', { p_relationship_id: id });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Unlinked' }); load(); }
  };

  const toggleVerified = async (id: string, verified: boolean) => {
    const { error } = await supabase.from('student_parent_relationships').update({ verified: !verified }).eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <Input placeholder="Search parent, student, admission #…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setLinkOpen(true)}><Link2 className="h-4 w-4 mr-2" /> New link</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Parent</TableHead><TableHead>Student</TableHead><TableHead>Adm. #</TableHead>
                <TableHead>Class</TableHead><TableHead>Relationship</TableHead><TableHead>Verified</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No links</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.parent_name}</TableCell>
                    <TableCell>{r.student_name}</TableCell>
                    <TableCell>{r.admission_number || ''}</TableCell>
                    <TableCell>{r.class_name || <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                    <TableCell><Badge variant="outline">{r.relationship_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.verified ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleVerified(r.id, r.verified)}>
                        {r.verified ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => unlink(r.id)}><Unlink className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LinkParentStudentDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={load} />
    </div>
  );
};