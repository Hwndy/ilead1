import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

type Pass = {
  id: string; student_id: string; hostel_id: string | null; pass_type: string;
  out_at: string; expected_back_at: string; returned_at: string | null;
  destination: string | null; guardian_contact: string | null; reason: string | null; status: string;
};

const statusVariant = (s: string) =>
  s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : s === 'returned' ? 'secondary' : 'outline';

export const HostelPasses: React.FC = () => {
  const { toast } = useToast();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [boarders, setBoarders] = useState<{ id: string; full_name: string; hostel_id: string | null }[]>([]);
  const [form, setForm] = useState({
    student_id: '', pass_type: 'exeat',
    out_at: '', expected_back_at: '', destination: '', guardian_contact: '', reason: '',
  });

  const load = async () => {
    const [{ data: p }, { data: alloc }, { data: rooms }, { data: st }, { data: pr }] = await Promise.all([
      supabase.from('hostel_exeat_passes').select('*').order('out_at', { ascending: false }).limit(200),
      supabase.from('hostel_allocations').select('student_id, room_id').eq('status', 'active'),
      supabase.from('hostel_rooms').select('id, hostel_id'),
      supabase.from('students').select('id, user_id'),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    setPasses((p || []) as Pass[]);
    const hostelByRoom = new Map((rooms || []).map((r: any) => [r.id, r.hostel_id]));
    const names = new Map((pr || []).map((x: any) => [x.user_id, x.full_name]));
    const userByStudent = new Map((st || []).map((s: any) => [s.id, s.user_id]));
    setBoarders(((alloc || []) as any[]).map(a => ({
      id: a.student_id,
      full_name: names.get(userByStudent.get(a.student_id)) || 'Unnamed student',
      hostel_id: hostelByRoom.get(a.room_id) ?? null,
    })).sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };
  useEffect(() => { void load(); }, []);

  const nameById = useMemo(() => new Map(boarders.map(b => [b.id, b.full_name])), [boarders]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.out_at || !form.expected_back_at) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('hostel_exeat_passes').insert({
      student_id: form.student_id,
      hostel_id: boarders.find(b => b.id === form.student_id)?.hostel_id ?? null,
      pass_type: form.pass_type,
      out_at: new Date(form.out_at).toISOString(),
      expected_back_at: new Date(form.expected_back_at).toISOString(),
      destination: form.destination || null,
      guardian_contact: form.guardian_contact || null,
      reason: form.reason || null,
      created_by: u.user?.id ?? null,
    });
    if (error) return toast({ title: 'Could not create pass', description: error.message, variant: 'destructive' });
    toast({ title: 'Pass requested' });
    setForm({ student_id: '', pass_type: 'exeat', out_at: '', expected_back_at: '', destination: '', guardian_contact: '', reason: '' });
    void load();
  };

  const setStatus = async (p: Pass, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const patch: any = { status };
    if (status === 'approved' || status === 'rejected') { patch.approved_by = u.user?.id ?? null; patch.approved_at = new Date().toISOString(); }
    if (status === 'returned') patch.returned_at = new Date().toISOString();
    const { error } = await supabase.from('hostel_exeat_passes').update(patch).eq('id', p.id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    void load();
  };

  const isOverdue = (p: Pass) =>
    p.status === 'approved' && !p.returned_at && new Date(p.expected_back_at) < new Date();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>New Exeat / Leave Pass</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Boarder*</Label>
              <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{boarders.map(b => <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.pass_type} onValueChange={v => setForm({ ...form, pass_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exeat">Exeat</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Guardian Contact</Label><Input value={form.guardian_contact} onChange={e => setForm({ ...form, guardian_contact: e.target.value })} /></div>
            <div><Label>Out*</Label><Input type="datetime-local" value={form.out_at} onChange={e => setForm({ ...form, out_at: e.target.value })} required /></div>
            <div><Label>Expected back*</Label><Input type="datetime-local" value={form.expected_back_at} onChange={e => setForm({ ...form, expected_back_at: e.target.value })} required /></div>
            <div><Label>Destination</Label><Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></div>
            <div className="md:col-span-3"><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Create Pass</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Passes</CardTitle></CardHeader>
        <CardContent>
          {passes.length === 0 ? <p className="text-muted-foreground text-center py-6">No passes yet.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Out</TableHead>
                  <TableHead>Back by</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {passes.map(p => (
                    <TableRow key={p.id} className={isOverdue(p) ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">{nameById.get(p.student_id) || ''}</TableCell>
                      <TableCell className="capitalize">{p.pass_type}</TableCell>
                      <TableCell>{new Date(p.out_at).toLocaleString()}</TableCell>
                      <TableCell>{new Date(p.expected_back_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status) as any} className="capitalize">{p.status}</Badge>
                        {isOverdue(p) && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.status === 'pending' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setStatus(p, 'approved')}>Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatus(p, 'rejected')}>Reject</Button>
                          </>
                        )}
                        {p.status === 'approved' && (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(p, 'returned')}>Mark returned</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HostelPasses;