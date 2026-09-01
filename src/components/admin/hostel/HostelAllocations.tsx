import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, BedDouble, LogOut, ArrowLeftRight } from 'lucide-react';

type Hostel = { id: string; name: string; gender: string };
type Room = { id: string; hostel_id: string; room_number: string; capacity: number };
type StudentLite = { id: string; admission_number: string | null; full_name: string; gender: string | null; is_boarder: boolean; class_name: string | null };
type Allocation = {
  id: string; student_id: string; room_id: string; bed_label: string | null;
  status: string; allocated_on: string; checked_out_on: string | null;
};

export const HostelAllocations: React.FC = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [hostelFilter, setHostelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; studentId?: string; existing?: Allocation }>({ open: false });
  const [form, setForm] = useState({ hostel_id: '', room_id: '', bed_label: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: h }, { data: r }, { data: a }, { data: st }, { data: ca }, { data: cl }, { data: pr }] = await Promise.all([
      supabase.from('hostels').select('id, name, gender').order('name'),
      supabase.from('hostel_rooms').select('id, hostel_id, room_number, capacity').order('room_number'),
      supabase.from('hostel_allocations').select('*').order('allocated_on', { ascending: false }),
      supabase.from('students').select('id, user_id, admission_number, gender, is_boarder').eq('status', 'active'),
      supabase.from('class_assignments').select('student_id, class_id'),
      supabase.from('classes').select('id, name'),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    setHostels((h || []) as Hostel[]);
    setRooms((r || []) as Room[]);
    setAllocations((a || []) as Allocation[]);

    const nameByUser = new Map((pr || []).map((p: any) => [p.user_id, p.full_name]));
    const classById = new Map((cl || []).map((c: any) => [c.id, c.name]));
    const classByStudent = new Map((ca || []).map((x: any) => [x.student_id, classById.get(x.class_id) || null]));

    setStudents(((st || []) as any[]).map(s => ({
      id: s.id,
      admission_number: s.admission_number,
      full_name: nameByUser.get(s.user_id) || 'Unnamed student',
      gender: s.gender,
      is_boarder: !!s.is_boarder,
      class_name: classByStudent.get(s.id) ?? classByStudent.get(s.user_id) ?? null,
    })));
  };
  useEffect(() => { void load(); }, []);

  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const roomById = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const hostelById = useMemo(() => new Map(hostels.map(h => [h.id, h])), [hostels]);
  const active = useMemo(() => allocations.filter(a => a.status === 'active'), [allocations]);
  const activeByStudent = useMemo(() => new Map(active.map(a => [a.student_id, a])), [active]);

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active
      .map(a => {
        const room = roomById.get(a.room_id);
        const hostel = room ? hostelById.get(room.hostel_id) : undefined;
        return { a, room, hostel, student: studentById.get(a.student_id) };
      })
      .filter(x => x.student)
      .filter(x => hostelFilter === 'all' || x.hostel?.id === hostelFilter)
      .filter(x => !q
        || x.student!.full_name.toLowerCase().includes(q)
        || (x.student!.admission_number || '').toLowerCase().includes(q))
      .sort((x, y) => x.student!.full_name.localeCompare(y.student!.full_name));
  }, [active, roomById, hostelById, studentById, hostelFilter, search]);

  const awaiting = useMemo(
    () => students.filter(s => s.is_boarder && !activeByStudent.has(s.id)),
    [students, activeByStudent],
  );

  const openAllocate = (studentId: string, existing?: Allocation) => {
    const room = existing ? roomById.get(existing.room_id) : undefined;
    setForm({ hostel_id: room?.hostel_id || '', room_id: existing?.room_id || '', bed_label: existing?.bed_label || '', reason: '' });
    setDialog({ open: true, studentId, existing });
  };

  const freeBeds = (roomId: string) => {
    const room = roomById.get(roomId);
    if (!room) return 0;
    return room.capacity - active.filter(a => a.room_id === roomId && a.id !== dialog.existing?.id).length;
  };

  const save = async () => {
    if (!dialog.studentId || !form.room_id) return;
    setSaving(true);
    try {
      if (dialog.existing) {
        const { error } = await supabase.from('hostel_allocations')
          .update({ room_id: form.room_id, bed_label: form.bed_label || null, reason: form.reason || null })
          .eq('id', dialog.existing.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from('hostel_allocations').insert({
          student_id: dialog.studentId,
          room_id: form.room_id,
          bed_label: form.bed_label || null,
          allocated_by: userRes.user?.id ?? null,
        });
        if (error) throw error;
        await supabase.from('students').update({ is_boarder: true }).eq('id', dialog.studentId);
      }
      toast({ title: dialog.existing ? 'Student transferred' : 'Bed allocated' });
      setDialog({ open: false });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const checkOut = async (a: Allocation) => {
    const reason = prompt('Reason for check-out (optional)') ?? '';
    const { error } = await supabase.from('hostel_allocations')
      .update({ status: 'checked_out', checked_out_on: new Date().toISOString().slice(0, 10), reason: reason || null })
      .eq('id', a.id);
    if (error) return toast({ title: 'Check-out failed', description: error.message, variant: 'destructive' });
    await supabase.from('students').update({ is_boarder: false }).eq('id', a.student_id);
    toast({ title: 'Student checked out' });
    void load();
  };

  const exportCsv = () => {
    const rows = [['Name', 'Admission No', 'Class', 'Hostel', 'Room', 'Bed', 'Allocated On']];
    roster.forEach(x => rows.push([
      x.student!.full_name, x.student!.admission_number || '', x.student!.class_name || '',
      x.hostel?.name || '', x.room?.room_number || '', x.a.bed_label || '', x.a.allocated_on,
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'hostel-roster.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  const availableRooms = rooms.filter(r => r.hostel_id === form.hostel_id);

  return (
    <div className="space-y-4">
      {awaiting.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-base">Awaiting a bed ({awaiting.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {awaiting.map(s => (
              <Button key={s.id} size="sm" variant="outline" onClick={() => openAllocate(s.id)}>
                <BedDouble className="h-4 w-4 mr-1" />{s.full_name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Bed Allocations</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search student…" className="w-48" value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={hostelFilter} onValueChange={setHostelFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hostels</SelectItem>
                {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export</Button>
            <Button onClick={() => setDialog({ open: true })}><BedDouble className="h-4 w-4 mr-1" />Allocate</Button>
          </div>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No students allocated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead><TableHead>Class</TableHead>
                    <TableHead>Hostel</TableHead><TableHead>Room / Bed</TableHead>
                    <TableHead>Since</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map(x => (
                    <TableRow key={x.a.id}>
                      <TableCell className="font-medium">
                        {x.student!.full_name}
                        <div className="text-xs text-muted-foreground">{x.student!.admission_number}</div>
                      </TableCell>
                      <TableCell>{x.student!.class_name || ''}</TableCell>
                      <TableCell>{x.hostel?.name || ''}</TableCell>
                      <TableCell>{x.room?.room_number || ''}{x.a.bed_label ? ` · ${x.a.bed_label}` : ''}</TableCell>
                      <TableCell>{x.a.allocated_on}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openAllocate(x.a.student_id, x.a)}>
                          <ArrowLeftRight className="h-4 w-4 mr-1" />Transfer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => checkOut(x.a)}>
                          <LogOut className="h-4 w-4 mr-1" />Check out
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(o ? dialog : { open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.existing ? 'Transfer student' : 'Allocate a bed'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!dialog.existing && (
              <div>
                <Label>Student</Label>
                <Select value={dialog.studentId || ''} onValueChange={v => setDialog({ ...dialog, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.filter(s => !activeByStudent.has(s.id)).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name} {s.admission_number ? `(${s.admission_number})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Hostel</Label>
              <Select value={form.hostel_id} onValueChange={v => setForm({ ...form, hostel_id: v, room_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>
                  {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name} ({h.gender})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room</Label>
              <Select value={form.room_id} onValueChange={v => setForm({ ...form, room_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map(r => (
                    <SelectItem key={r.id} value={r.id} disabled={freeBeds(r.id) <= 0}>
                      {r.room_number}  {freeBeds(r.id)} bed(s) free
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bed label (optional)</Label>
              <Input value={form.bed_label} onChange={e => setForm({ ...form, bed_label: e.target.value })} placeholder="e.g. Bunk 3 lower" />
            </div>
            {dialog.existing && (
              <div>
                <Label>Reason (optional)</Label>
                <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
            )}
            {dialog.studentId && studentById.get(dialog.studentId)?.gender && (
              <Badge variant="secondary" className="capitalize">Student gender: {studentById.get(dialog.studentId)?.gender}</Badge>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Cancel</Button>
            <Button onClick={save} disabled={saving || !dialog.studentId || !form.room_id}>
              {saving ? 'Saving…' : dialog.existing ? 'Transfer' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HostelAllocations;