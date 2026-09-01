import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Building2 } from 'lucide-react';

export type HostelRow = { id: string; name: string; gender: string; address: string | null; notes: string | null; is_active: boolean };
type RoomRow = { id: string; hostel_id: string; room_number: string; room_type: string; capacity: number };

export const HostelsRooms: React.FC = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [occupancy, setOccupancy] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string>('');
  const [hForm, setHForm] = useState({ name: '', gender: 'mixed', address: '', notes: '' });
  const [rForm, setRForm] = useState({ room_number: '', room_type: 'dormitory', capacity: '4' });

  const load = async () => {
    const [{ data: h }, { data: r }, { data: a }] = await Promise.all([
      supabase.from('hostels').select('*').order('name'),
      supabase.from('hostel_rooms').select('*').order('room_number'),
      supabase.from('hostel_allocations').select('room_id').eq('status', 'active'),
    ]);
    setHostels((h || []) as HostelRow[]);
    setRooms((r || []) as RoomRow[]);
    const counts: Record<string, number> = {};
    (a || []).forEach((row: any) => { counts[row.room_id] = (counts[row.room_id] || 0) + 1; });
    setOccupancy(counts);
    if (!selected && h && h.length) setSelected(h[0].id);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const addHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('hostels').insert({
      name: hForm.name, gender: hForm.gender, address: hForm.address || null, notes: hForm.notes || null,
    });
    if (error) return toast({ title: 'Could not add hostel', description: error.message, variant: 'destructive' });
    setHForm({ name: '', gender: 'mixed', address: '', notes: '' });
    toast({ title: 'Hostel added' });
    void load();
  };

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const { error } = await supabase.from('hostel_rooms').insert({
      hostel_id: selected, room_number: rForm.room_number, room_type: rForm.room_type,
      capacity: parseInt(rForm.capacity) || 1,
    });
    if (error) return toast({ title: 'Could not add room', description: error.message, variant: 'destructive' });
    setRForm({ room_number: '', room_type: 'dormitory', capacity: '4' });
    toast({ title: 'Room added' });
    void load();
  };

  const toggleHostel = async (h: HostelRow) => {
    await supabase.from('hostels').update({ is_active: !h.is_active }).eq('id', h.id);
    void load();
  };
  const removeHostel = async (id: string) => {
    if (!confirm('Delete this hostel and all its rooms?')) return;
    const { error } = await supabase.from('hostels').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    if (selected === id) setSelected('');
    void load();
  };
  const removeRoom = async (id: string) => {
    if (!confirm('Delete this room?')) return;
    const { error } = await supabase.from('hostel_rooms').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    void load();
  };

  const hostelRooms = rooms.filter(r => r.hostel_id === selected);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {hostels.map(h => {
          const hr = rooms.filter(r => r.hostel_id === h.id);
          const cap = hr.reduce((s, r) => s + r.capacity, 0);
          const occ = hr.reduce((s, r) => s + (occupancy[r.id] || 0), 0);
          return (
            <Card key={h.id} className={selected === h.id ? 'border-primary' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{h.name}</span>
                  <Badge variant="secondary" className="capitalize">{h.gender}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={cap ? (occ / cap) * 100 : 0} />
                <p className="text-xs text-muted-foreground">{occ} of {cap} beds occupied · {hr.length} rooms</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant={selected === h.id ? 'default' : 'outline'} onClick={() => setSelected(h.id)}>Manage rooms</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleHostel(h)}>{h.is_active ? 'Deactivate' : 'Activate'}</Button>
                  <Button size="icon" variant="ghost" onClick={() => removeHostel(h.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Add Hostel</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addHostel} className="grid gap-3 md:grid-cols-4">
            <div><Label>Name*</Label><Input required value={hForm.name} onChange={e => setHForm({ ...hForm, name: e.target.value })} /></div>
            <div>
              <Label>Gender</Label>
              <Select value={hForm.gender} onValueChange={v => setHForm({ ...hForm, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Boys</SelectItem>
                  <SelectItem value="female">Girls</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Address</Label><Input value={hForm.address} onChange={e => setHForm({ ...hForm, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={hForm.notes} onChange={e => setHForm({ ...hForm, notes: e.target.value })} /></div>
            <div className="md:col-span-4"><Button type="submit">Add Hostel</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rooms {selected ? ` ${hostels.find(h => h.id === selected)?.name ?? ''}` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected ? (
            <p className="text-muted-foreground text-center py-6">Select a hostel above to manage its rooms.</p>
          ) : (
            <>
              <form onSubmit={addRoom} className="grid gap-3 md:grid-cols-4">
                <div><Label>Room Number*</Label><Input required value={rForm.room_number} onChange={e => setRForm({ ...rForm, room_number: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={rForm.room_type} onValueChange={v => setRForm({ ...rForm, room_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dormitory">Dormitory</SelectItem>
                      <SelectItem value="2-bed">2-bed</SelectItem>
                      <SelectItem value="4-bed">4-bed</SelectItem>
                      <SelectItem value="6-bed">6-bed</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Bed Capacity</Label><Input type="number" min="1" value={rForm.capacity} onChange={e => setRForm({ ...rForm, capacity: e.target.value })} /></div>
                <div className="flex items-end"><Button type="submit">Add Room</Button></div>
              </form>

              {hostelRooms.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No rooms yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead><TableHead>Type</TableHead>
                        <TableHead>Occupancy</TableHead><TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hostelRooms.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.room_number}</TableCell>
                          <TableCell className="capitalize">{r.room_type}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress className="w-24" value={r.capacity ? ((occupancy[r.id] || 0) / r.capacity) * 100 : 0} />
                              <span className="text-xs text-muted-foreground">{occupancy[r.id] || 0}/{r.capacity}</span>
                            </div>
                          </TableCell>
                          <TableCell><Button size="icon" variant="ghost" onClick={() => removeRoom(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HostelsRooms;