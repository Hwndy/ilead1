import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

const TYPES = ['full_time', 'part_time', 'contract', 'internship', 'volunteer'];

export const CareersManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '', department: '', employment_type: 'full_time', location: '',
    description: '', requirements: '', apply_email: 'careers@ilead1.lovable.app', closes_on: '',
  });

  const load = async () => {
    const { data } = await supabase.from('job_openings').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('job_openings').insert({
      ...form, closes_on: form.closes_on || null, created_by: user?.id,
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Job posted' });
      setForm({ title: '', department: '', employment_type: 'full_time', location: '', description: '', requirements: '', apply_email: 'careers@ilead1.lovable.app', closes_on: '' });
      load();
    }
  };

  const toggle = async (r: any) => {
    await supabase.from('job_openings').update({ is_open: !r.is_open }).eq('id', r.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this posting?')) return;
    await supabase.from('job_openings').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Careers</h2>
        <p className="text-muted-foreground">Publish job openings on the public website.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Post a Job</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Title*</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Description*</Label><Textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Requirements</Label><Textarea rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>
            <div><Label>Apply Email*</Label><Input required type="email" value={form.apply_email} onChange={(e) => setForm({ ...form, apply_email: e.target.value })} /></div>
            <div><Label>Closes On</Label><Input type="date" value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} /></div>
            <div className="md:col-span-2"><Button type="submit">Publish</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Openings</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-muted-foreground text-center py-6">No jobs posted.</p> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Title</TableHead><TableHead>Dept</TableHead><TableHead>Type</TableHead><TableHead>Closes</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{r.department || ''}</TableCell>
                    <TableCell className="capitalize">{r.employment_type.replace('_',' ')}</TableCell>
                    <TableCell>{r.closes_on || ''}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_open ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggle(r)}>
                        {r.is_open ? 'Open' : 'Closed'}
                      </Badge>
                    </TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
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

export default CareersManager;