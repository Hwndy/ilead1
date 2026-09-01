import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type Row = { student_id: string; full_name: string; room: string; status: string; onExeat: boolean };

export const HostelRollCall: React.FC = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [hostelId, setHostelId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState('night');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('hostels').select('id, name').order('name');
      setHostels((data || []) as any);
      if (data && data.length) setHostelId(data[0].id);
    })();
  }, []);

  const loadRoll = async () => {
    if (!hostelId) return;
    setLoading(true);
    try {
      const { data: rooms } = await supabase.from('hostel_rooms').select('id, room_number').eq('hostel_id', hostelId);
      const roomIds = (rooms || []).map((r: any) => r.id);
      const roomNumber = new Map((rooms || []).map((r: any) => [r.id, r.room_number]));
      if (roomIds.length === 0) { setRows([]); return; }

      const [{ data: alloc }, { data: marks }, { data: passes }] = await Promise.all([
        supabase.from('hostel_allocations').select('student_id, room_id').eq('status', 'active').in('room_id', roomIds),
        supabase.from('hostel_attendance').select('student_id, status').eq('hostel_id', hostelId).eq('roll_date', date).eq('roll_session', session),
        supabase.from('hostel_exeat_passes').select('student_id, out_at, expected_back_at').eq('status', 'approved'),
      ]);

      const studentIds = (alloc || []).map((a: any) => a.student_id);
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase.from('students').select('id, user_id').in('id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      const names = new Map((pr || []).map((p: any) => [p.user_id, p.full_name]));
      const userByStudent = new Map((st || []).map((s: any) => [s.id, s.user_id]));
      const marked = new Map((marks || []).map((m: any) => [m.student_id, m.status]));
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);
      const onExeat = new Set(
        (passes || []).filter((p: any) => new Date(p.out_at) <= dayEnd && new Date(p.expected_back_at) >= dayStart)
          .map((p: any) => p.student_id),
      );

      setRows(((alloc || []) as any[]).map(a => ({
        student_id: a.student_id,
        full_name: names.get(userByStudent.get(a.student_id)) || 'Unnamed student',
        room: roomNumber.get(a.room_id) || '',
        status: marked.get(a.student_id) || (onExeat.has(a.student_id) ? 'exeat' : 'present'),
        onExeat: onExeat.has(a.student_id),
      })).sort((x, y) => x.full_name.localeCompare(y.full_name)));
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadRoll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hostelId, date, session]);

  const setStatus = (id: string, status: string) =>
    setRows(rows.map(r => (r.student_id === id ? { ...r, status } : r)));

  const save = async () => {
    if (!hostelId || rows.length === 0) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = rows.map(r => ({
        hostel_id: hostelId, student_id: r.student_id, roll_date: date,
        roll_session: session, status: r.status, marked_by: u.user?.id ?? null,
      }));
      const { error } = await supabase.from('hostel_attendance')
        .upsert(payload, { onConflict: 'hostel_id,student_id,roll_date,roll_session' });
      if (error) throw error;
      toast({ title: 'Roll call saved', description: `${rows.length} boarders recorded.` });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const absent = rows.filter(r => r.status === 'absent').length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <CardTitle>Hostel Roll Call</CardTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Hostel</Label>
            <Select value={hostelId} onValueChange={setHostelId}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Hostel" /></SelectTrigger>
              <SelectContent>{hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Date</Label><Input type="date" className="w-40" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Session</Label>
            <Select value={session} onValueChange={setSession}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save roll call'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No boarders allocated to this hostel.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">{rows.length} boarders · {absent} marked absent</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Student</TableHead><TableHead>Room</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.student_id}>
                      <TableCell className="font-medium">
                        {r.full_name}{r.onExeat && <Badge variant="secondary" className="ml-2">On exeat</Badge>}
                      </TableCell>
                      <TableCell>{r.room}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {['present', 'absent', 'exeat'].map(s => (
                            <Button key={s} size="sm" variant={r.status === s ? 'default' : 'outline'}
                              className="capitalize" onClick={() => setStatus(r.student_id, s)}>
                              {s}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HostelRollCall;