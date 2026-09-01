import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

type Route = { id: string; name: string; driver_name: string | null; driver_phone: string | null; vehicle_reg: string | null; capacity: number; monthly_fee: number; is_active: boolean; };

const RoutesTab: React.FC = () => {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [form, setForm] = useState({ name: '', driver_name: '', driver_phone: '', vehicle_reg: '', capacity: '20', monthly_fee: '0' });

  const load = async () => {
    const { data } = await supabase.from('transport_routes').select('*').order('name');
    setRoutes((data || []) as Route[]);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('transport_routes').insert({
      name: form.name, driver_name: form.driver_name || null, driver_phone: form.driver_phone || null,
      vehicle_reg: form.vehicle_reg || null, capacity: parseInt(form.capacity) || 0, monthly_fee: parseFloat(form.monthly_fee) || 0,
    });
    if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Route added' }); setForm({ name: '', driver_name: '', driver_phone: '', vehicle_reg: '', capacity: '20', monthly_fee: '0' }); load(); }
  };

  const toggle = async (r: Route) => {
    await supabase.from('transport_routes').update({ is_active: !r.is_active }).eq('id', r.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this route?')) return;
    await supabase.from('transport_routes').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add Route</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Route Name*</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Driver</Label><Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} /></div>
            <div><Label>Driver Phone</Label><Input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} /></div>
            <div><Label>Vehicle Reg</Label><Input value={form.vehicle_reg} onChange={(e) => setForm({ ...form, vehicle_reg: e.target.value })} /></div>
            <div><Label>Capacity</Label><Input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            <div><Label>Monthly Fee (₦)</Label><Input type="number" min="0" step="0.01" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Add Route</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Routes</CardTitle></CardHeader>
        <CardContent>
          {routes.length === 0 ? <p className="text-muted-foreground text-center py-6">No routes.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Driver</TableHead><TableHead>Vehicle</TableHead>
                    <TableHead>Capacity</TableHead><TableHead>Fee</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.driver_name || ''}<br/><span className="text-xs text-muted-foreground">{r.driver_phone || ''}</span></TableCell>
                      <TableCell>{r.vehicle_reg || ''}</TableCell>
                      <TableCell>{r.capacity}</TableCell>
                      <TableCell>₦{Number(r.monthly_fee).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggle(r)}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
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

const AssignmentsTab: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from('student_transport')
      .select('id, active, started_on, students(id, admission_number), transport_routes(name)')
      .order('started_on', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const setActive = async (id: string, active: boolean) => {
    await supabase.from('student_transport').update({ active, ended_on: active ? null : new Date().toISOString().slice(0,10) }).eq('id', id);
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Student Assignments</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No student is assigned to a transport route yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Admission #</TableHead><TableHead>Route</TableHead><TableHead>Started</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.students?.admission_number}</TableCell>
                  <TableCell>{r.transport_routes?.name}</TableCell>
                  <TableCell>{r.started_on}</TableCell>
                  <TableCell><Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? 'Active' : 'Ended'}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setActive(r.id, !r.active)}>{r.active ? 'End' : 'Reactivate'}</Button>
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

export const TransportHub: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold">Transport</h2>
      <p className="text-muted-foreground">Manage school bus routes and student assignments.</p>
    </div>
    <Tabs defaultValue="routes">
      <TabsList><TabsTrigger value="routes">Routes</TabsTrigger><TabsTrigger value="assignments">Assignments</TabsTrigger></TabsList>
      <TabsContent value="routes"><RoutesTab /></TabsContent>
      <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
    </Tabs>
  </div>
);

export default TransportHub;