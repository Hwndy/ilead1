import React, { useEffect, useState } from 'react';
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

export const HostelInspections: React.FC = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; hostel_id: string; room_number: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    hostel_id: '', room_id: 'all', inspection_date: new Date().toISOString().slice(0, 10),
    cleanliness_score: '5', discipline_score: '5', notes: '', follow_up_required: false,
  });

  const load = async () => {
    const [{ data: h }, { data: r }, { data: i }] = await Promise.all([
      supabase.from('hostels').select('id, name').order('name'),
      supabase.from('hostel_rooms').select('id, hostel_id, room_number').order('room_number'),
      supabase.from('hostel_inspections').select('*').order('inspection_date', { ascending: false }).limit(100),
    ]);
    setHostels((h || []) as any); setRooms((r || []) as any); setRows(i || []);
  };
  useEffect(() => { void load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hostel_id) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('hostel_inspections').insert({
      hostel_id: form.hostel_id,
      room_id: form.room_id === 'all' ? null : form.room_id,
      inspection_date: form.inspection_date,
      inspector_id: u.user?.id ?? null,
      cleanliness_score: parseInt(form.cleanliness_score) || null,
      discipline_score: parseInt(form.discipline_score) || null,
      notes: form.notes || null,
      follow_up_required: form.follow_up_required,
    });
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Inspection recorded' });
    setForm({ ...form, notes: '', follow_up_required: false });
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Record Inspection</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Hostel*</Label>
              <Select value={form.hostel_id} onValueChange={v => setForm({ ...form, hostel_id: v, room_id: 'all' })}>
                <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>{hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room</Label>
              <Select value={form.room_id} onValueChange={v => setForm({ ...form, room_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole hostel</SelectItem>
                  {rooms.filter(r => r.hostel_id === form.hostel_id).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.inspection_date} onChange={e => setForm({ ...form, inspection_date: e.target.value })} /></div>
            <div><Label>Cleanliness (1-10)</Label><Input type="number" min="1" max="10" value={form.cleanliness_score} onChange={e => setForm({ ...form, cleanliness_score: e.target.value })} /></div>
            <div><Label>Discipline (1-10)</Label><Input type="number" min="1" max="10" value={form.discipline_score} onChange={e => setForm({ ...form, discipline_score: e.target.value })} /></div>
            <div className="flex items-end gap-2">
              <input id="followup" type="checkbox" className="h-4 w-4" checked={form.follow_up_required} onChange={e => setForm({ ...form, follow_up_required: e.target.checked })} />
              <Label htmlFor="followup">Follow-up required</Label>
            </div>
            <div className="md:col-span-3"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Save Inspection</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Inspections</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-muted-foreground text-center py-6">No inspections recorded.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Hostel</TableHead><TableHead>Room</TableHead>
                  <TableHead>Clean</TableHead><TableHead>Discipline</TableHead><TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.inspection_date}</TableCell>
                      <TableCell>{hostels.find(h => h.id === r.hostel_id)?.name || ''}</TableCell>
                      <TableCell>{rooms.find(x => x.id === r.room_id)?.room_number || 'Whole hostel'}</TableCell>
                      <TableCell>{r.cleanliness_score ?? ''}</TableCell>
                      <TableCell>{r.discipline_score ?? ''}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {r.follow_up_required && <Badge variant="destructive" className="mr-2">Follow-up</Badge>}
                        {r.notes || ''}
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

export default HostelInspections;