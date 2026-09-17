import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked?: () => void;
  fixedParentUserId?: string; // if provided, parent picker is hidden
}

export const LinkParentStudentDialog: React.FC<Props> = ({ open, onOpenChange, onLinked, fixedParentUserId }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; admission_number: string | null; full_name: string }>>([]);
  const [parentUserId, setParentUserId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [relationshipType, setRelationshipType] = useState('parent');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setParentUserId(fixedParentUserId || '');
    (async () => {
      if (!fixedParentUserId) {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'parent');
        const ids = (roles || []).map(r => r.user_id);
        const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id,full_name').in('user_id', ids) : { data: [] as any };
        setParents((profs || []) as any);
      }
      const { data: rows } = await supabase.from('students').select('id,user_id,admission_number').is('archived_at', null).order('admission_number');
      const uids = (rows || []).map(r => r.user_id).filter(Boolean);
      const { data: sprofs } = uids.length ? await supabase.from('profiles').select('user_id,full_name').in('user_id', uids) : { data: [] as any };
      setStudents((rows || []).map(r => ({
        id: r.id, admission_number: r.admission_number,
        full_name: sprofs?.find((p: any) => p.user_id === r.user_id)?.full_name || r.admission_number || 'Student',
      })));
    })();
  }, [open, fixedParentUserId]);

  const filteredStudents = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students.slice(0, 100);
    return students.filter(s =>
      s.full_name.toLowerCase().includes(t) || (s.admission_number || '').toLowerCase().includes(t)
    ).slice(0, 100);
  }, [q, students]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentUserId || !studentId) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_link_parent_to_student', {
        p_parent_user_id: parentUserId,
        p_student_id: studentId,
        p_relationship_type: relationshipType,
      });
      if (error) throw error;
      toast({ title: 'Linked', description: 'Parent linked to student.' });
      onOpenChange(false); onLinked?.();
      setStudentId(''); setQ('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Link Parent to Student</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {!fixedParentUserId && (
            <div className="grid gap-2">
              <Label>Parent</Label>
              <Select value={parentUserId} onValueChange={setParentUserId}>
                <SelectTrigger><SelectValue placeholder="Select parent" /></SelectTrigger>
                <SelectContent>
                  {parents.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Search student</Label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or admission number" />
          </div>
          <div className="grid gap-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {filteredStudents.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name} {s.admission_number ? `(${s.admission_number})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Relationship</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['parent', 'mother', 'father', 'guardian', 'other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !parentUserId || !studentId}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Link</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};