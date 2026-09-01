import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const NGN = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

interface Structure { id: string; fee_type: string; academic_year: string; term: string | null; amount: number; due_date: string | null; class_id: string | null; is_mandatory: boolean | null; }
interface Klass { id: string; name: string; }

const emptyForm = { fee_type: '', academic_year: new Date().getFullYear().toString(), term: '', amount: '', due_date: '', scope: 'ALL' as 'ALL' | 'SELECTED', class_ids: [] as string[], is_mandatory: true };

export const FeeStructures: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Structure[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Structure | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: fs }, { data: cls }] = await Promise.all([
      supabase.from('fee_structures').select('*').order('academic_year', { ascending: false }),
      supabase.from('classes').select('id, name').order('name'),
    ]);
    setItems((fs || []) as Structure[]);
    setClasses((cls || []) as Klass[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, class_ids: [] }); setOpen(true); };
  const openEdit = (s: Structure) => {
    setEditing(s);
    setForm({ fee_type: s.fee_type, academic_year: s.academic_year, term: s.term || '', amount: String(s.amount), due_date: s.due_date || '', scope: s.class_id ? 'SELECTED' : 'ALL', class_ids: s.class_id ? [s.class_id] : [], is_mandatory: !!s.is_mandatory });
    setOpen(true);
  };

  const toggleClass = (id: string) => setForm((f: any) => ({
    ...f,
    class_ids: f.class_ids.includes(id) ? f.class_ids.filter((x: string) => x !== id) : [...f.class_ids, id],
  }));

  const save = async () => {
    if (!form.fee_type || !form.amount || !form.academic_year) { toast({ title: 'Missing fields', variant: 'destructive' }); return; }
    if (form.scope === 'SELECTED' && form.class_ids.length === 0) { toast({ title: 'Select at least one class', variant: 'destructive' }); return; }
    setSaving(true);
    const base: any = {
      fee_type: form.fee_type, academic_year: form.academic_year, term: form.term || null,
      amount: Number(form.amount), due_date: form.due_date || null,
      is_mandatory: form.is_mandatory,
    };
    const targets: (string | null)[] = form.scope === 'ALL' ? [null] : form.class_ids;
    let error: any = null;
    if (editing) {
      // Update the edited row to the first target, then create rows for any extra classes
      const [first, ...rest] = targets;
      ({ error } = await supabase.from('fee_structures').update({ ...base, class_id: first }).eq('id', editing.id));
      if (!error && rest.length) {
        ({ error } = await supabase.from('fee_structures').insert(rest.map(cid => ({ ...base, class_id: cid }))) as any);
      }
    } else {
      ({ error } = await supabase.from('fee_structures').insert(targets.map(cid => ({ ...base, class_id: cid }))) as any);
    }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Updated' : `Created for ${targets.length} ${targets[0] === null ? 'scope' : 'class(es)'}` });
    setOpen(false); load();
  };

  const remove = async (s: Structure) => {
    if (!confirm(`Delete "${s.fee_type}" (${s.academic_year})?`)) return;
    const { error } = await supabase.from('fee_structures').delete().eq('id', s.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deleted' }); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fee Structures</CardTitle>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1"/>New</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6"/></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fee Type</TableHead><TableHead>Class</TableHead><TableHead>Year</TableHead><TableHead>Term</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Due</TableHead><TableHead>Mandatory</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.fee_type}</TableCell>
                  <TableCell>{s.class_id ? (classes.find(c => c.id === s.class_id)?.name || '') : <Badge variant="outline">All classes</Badge>}</TableCell>
                  <TableCell>{s.academic_year}</TableCell>
                  <TableCell>{s.term || ''}</TableCell>
                  <TableCell className="text-right">{NGN(Number(s.amount))}</TableCell>
                  <TableCell>{s.due_date ? format(new Date(s.due_date), 'PP') : ''}</TableCell>
                  <TableCell>{s.is_mandatory ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No fee structures yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Fee Structure</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Fee Type *</Label><Input value={form.fee_type} onChange={e => setForm({ ...form, fee_type: e.target.value })} placeholder="Tuition, Bus, Uniform..."/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Academic Year *</Label><Input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} placeholder="2025/2026"/></div>
              <div><Label>Term</Label>
                <Select value={form.term || 'none'} onValueChange={v => setForm({ ...form, term: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Any"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any / Annual</SelectItem>
                    <SelectItem value="First">First Term</SelectItem>
                    <SelectItem value="Second">Second Term</SelectItem>
                    <SelectItem value="Third">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₦) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}/></div>
            </div>
            <div className="space-y-2">
              <Label>Applies to</Label>
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All classes</SelectItem>
                  <SelectItem value="SELECTED">Selected classes</SelectItem>
                </SelectContent>
              </Select>
              {form.scope === 'SELECTED' && (
                <div className="rounded-md border p-3 max-h-48 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs text-muted-foreground">{form.class_ids.length} selected</span>
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => setForm((f: any) => ({ ...f, class_ids: f.class_ids.length === classes.length ? [] : classes.map(c => c.id) }))}>
                      {form.class_ids.length === classes.length ? 'Clear all' : 'Select all'}
                    </Button>
                  </div>
                  {classes.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.class_ids.includes(c.id)} onCheckedChange={() => toggleClass(c.id)}/> {c.name}
                    </label>
                  ))}
                  {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes found</p>}
                </div>
              )}
              <p className="text-xs text-muted-foreground">A separate fee record is created per selected class, so it shows in each child's parent portal.</p>
            </div>
            <label className="flex items-center gap-2"><Checkbox checked={form.is_mandatory} onCheckedChange={v => setForm({ ...form, is_mandatory: !!v })}/> Mandatory</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};