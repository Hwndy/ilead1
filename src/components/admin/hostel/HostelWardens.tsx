import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

type Warden = { id: string; hostel_id: string; user_id: string; role: string };

export const HostelWardens: React.FC = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [staff, setStaff] = useState<{ user_id: string; full_name: string; employee_id: string | null }[]>([]);
  const [wardens, setWardens] = useState<Warden[]>([]);
  const [form, setForm] = useState({ hostel_id: '', user_id: '', role: 'warden' });

  const load = async () => {
    const [{ data: h }, { data: w }, { data: sd }, { data: pr }] = await Promise.all([
      supabase.from('hostels').select('id, name').order('name'),
      supabase.from('hostel_wardens').select('*'),
      supabase.from('staff_details').select('user_id, employee_id'),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    setHostels((h || []) as any);
    setWardens((w || []) as Warden[]);
    const names = new Map((pr || []).map((p: any) => [p.user_id, p.full_name]));
    setStaff(((sd || []) as any[]).map(s => ({
      user_id: s.user_id, employee_id: s.employee_id, full_name: names.get(s.user_id) || 'Unnamed staff',
    })).sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };
  useEffect(() => { void load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hostel_id || !form.user_id) return;
    const { error } = await supabase.from('hostel_wardens').insert(form);
    if (error) return toast({ title: 'Could not assign', description: error.message, variant: 'destructive' });
    setForm({ hostel_id: '', user_id: '', role: 'warden' });
    toast({ title: 'Warden assigned' });
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from('hostel_wardens').delete().eq('id', id);
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Assign Warden</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Hostel</Label>
              <Select value={form.hostel_id} onValueChange={v => setForm({ ...form, hostel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>{hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Staff</Label>
              <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}{s.employee_id ? ` (${s.employee_id})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warden">Warden</SelectItem>
                  <SelectItem value="assistant">Assistant Warden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button type="submit">Assign</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Wardens</CardTitle></CardHeader>
        <CardContent>
          {wardens.length === 0 ? <p className="text-muted-foreground text-center py-6">No wardens assigned.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Hostel</TableHead><TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {wardens.map(w => (
                  <TableRow key={w.id}>
                    <TableCell>{hostels.find(h => h.id === w.hostel_id)?.name || ''}</TableCell>
                    <TableCell>{staff.find(s => s.user_id === w.user_id)?.full_name || ''}</TableCell>
                    <TableCell className="capitalize">{w.role}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HostelWardens;