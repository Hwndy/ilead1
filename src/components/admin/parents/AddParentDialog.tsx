import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void; }

export const AddParentDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; admission_number: string | null; full_name: string }>>([]);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', studentId: '', relationshipType: 'parent' as const,
    canViewGrades: true, canViewAttendance: true, canViewFees: true,
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: rows } = await supabase.from('students').select('id,user_id,admission_number').order('admission_number');
      const ids = (rows || []).map(r => r.user_id).filter(Boolean);
      const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id,full_name').in('user_id', ids) : { data: [] as any };
      setStudents((rows || []).map(r => ({
        id: r.id, admission_number: r.admission_number,
        full_name: profs?.find((p: any) => p.user_id === r.user_id)?.full_name || r.admission_number || 'Student',
      })));
    })();
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[+\d][\d\s()-]{6,19}$/.test(form.phone.trim())) {
      toast({ title: 'Invalid phone', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-parent-account', {
        body: {
          fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(),
          studentId: form.studentId || undefined, relationshipType: form.relationshipType,
          canViewGrades: form.canViewGrades, canViewAttendance: form.canViewAttendance, canViewFees: form.canViewFees,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed to create parent');
      toast({ title: 'Parent invited', description: `${form.fullName} will receive an email to set a password.` });
      onOpenChange(false); onCreated?.();
      setForm({ fullName: '', email: '', phone: '', studentId: '', relationshipType: 'parent', canViewGrades: true, canViewAttendance: true, canViewFees: true });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Parent / Guardian</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2"><Label>Full name</Label><Input required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Email</Label><Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Phone</Label><Input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+2348012345678" /></div>
          <div className="grid gap-2">
            <Label>Link a child (optional)</Label>
            <Select value={form.studentId || 'none'} onValueChange={v => setForm(f => ({ ...f, studentId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none"> None </SelectItem>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} {s.admission_number ? `(${s.admission_number})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.studentId && (
            <>
              <div className="grid gap-2">
                <Label>Relationship</Label>
                <Select value={form.relationshipType} onValueChange={v => setForm(f => ({ ...f, relationshipType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['parent', 'mother', 'father', 'guardian', 'other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                {([['canViewGrades', 'View grades'], ['canViewAttendance', 'View attendance'], ['canViewFees', 'View fees']] as const).map(([k, label]) => (
                  <div key={k} className="flex items-center gap-2">
                    <Checkbox checked={form[k]} onCheckedChange={(v) => setForm(f => ({ ...f, [k]: !!v }))} id={k} />
                    <Label htmlFor={k} className="font-normal">{label}</Label>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send invitation</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};