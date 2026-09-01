import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const CONDITIONS = ['new','good','fair','poor','damaged','retired'];
const STATUSES = ['available','in_use','maintenance','retired','lost'];

export const AssetsHub: React.FC = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ asset_tag: '', name: '', location: '', condition: 'good', cost: '' });

  const load = async () => {
    let query = supabase.from('assets').select('*').order('created_at', { ascending: false });
    if (q) query = query.or(`name.ilike.%${q}%,asset_tag.ilike.%${q}%,location.ilike.%${q}%`);
    const { data } = await query;
    setAssets(data || []);
  };
  useEffect(() => { load(); }, [q]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('assets').insert({
      asset_tag: form.asset_tag, name: form.name, location: form.location || null,
      condition: form.condition, cost: form.cost ? parseFloat(form.cost) : null,
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Asset added' }); setForm({ asset_tag: '', name: '', location: '', condition: 'good', cost: '' }); load(); }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('assets').update({ status }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Asset Register</h2>
        <p className="text-muted-foreground">Track school property, tools and equipment.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add Asset</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Asset Tag*</Label><Input required value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} /></div>
            <div><Label>Name*</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cost (₦)</Label><Input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Add Asset</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle>Assets</CardTitle>
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? <p className="text-muted-foreground text-center py-6">No assets.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead><TableHead>Name</TableHead><TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead><TableHead>Status</TableHead><TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.asset_tag}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.location || ''}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.condition}</Badge></TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_',' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{a.cost ? `₦${Number(a.cost).toLocaleString()}` : ''}</TableCell>
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

export default AssetsHub;