import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, UserCog } from 'lucide-react';
import { PhotoUpload } from '@/components/shared/PhotoUpload';

export interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** auth user_id of the student */
  userId: string;
  onSaved?: () => void;
}

interface ClassOption { id: string; name: string }

export const EditStudentDialog: React.FC<EditStudentDialogProps> = ({
  open, onOpenChange, userId, onSaved,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState('active');
  const [classId, setClassId] = useState<string>('none');
  const [existingAssignmentId, setExistingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (open && userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prof }, { data: stu }, { data: cls }, { data: assign }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
        supabase.from('students').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('class_assignments').select('id, class_id').eq('student_id', userId).maybeSingle(),
      ]);

      setFullName((prof as any)?.full_name || '');
      const s: any = stu || {};
      setPhotoUrl(s.photo_url || '');
      setAdmissionNumber(s.admission_number || '');
      setDob(s.date_of_birth || '');
      setGender(s.gender || '');
      setBloodGroup(s.blood_group || '');
      const addr = s.address || {};
      setStreet(addr.street || '');
      setCity(addr.city || '');
      setState(addr.state || '');
      setStatus(s.status || 'active');
      setClasses((cls as any[]) || []);
      setClassId((assign as any)?.class_id || 'none');
      setExistingAssignmentId((assign as any)?.id || null);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1) profile
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', userId);
      if (pErr) throw pErr;

      // 2) students
      const { error: sErr } = await supabase
        .from('students')
        .update({
          photo_url: photoUrl || null,
          admission_number: admissionNumber || null,
          date_of_birth: dob || null,
          gender: gender || null,
          blood_group: bloodGroup || null,
          address: { street, city, state },
          status,
        })
        .eq('user_id', userId);
      if (sErr) throw sErr;

      // 3) class assignment (single per student)
      if (classId === 'none') {
        if (existingAssignmentId) {
          await supabase.from('class_assignments').delete().eq('id', existingAssignmentId);
        }
      } else {
        if (existingAssignmentId) {
          await supabase.from('class_assignments')
            .update({ class_id: classId })
            .eq('id', existingAssignmentId);
        } else {
          await supabase.from('class_assignments').insert({
            student_id: userId,
            class_id: classId,
                      } as any);
        }
      }

      toast({ title: 'Saved', description: 'Student profile updated' });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" /> Edit Student Profile
          </DialogTitle>
          <DialogDescription>
            Update personal, academic and class information. Photo appears on the ID card.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>Admission Number</Label>
                <Input value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <PhotoUpload
                  label="Passport Photo"
                  value={photoUrl}
                  onChange={setPhotoUrl}
                  folder={`students/${userId}`}
                />
                <Input
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="…or paste an image URL"
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={dob || ''} onChange={e => setDob(e.target.value)} />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={gender || 'unset'} onValueChange={v => setGender(v === 'unset' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset"></SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group</Label>
                <Input value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} placeholder="e.g. O+" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="graduated">Graduated</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not assigned</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input placeholder="Street" value={street} onChange={e => setStreet(e.target.value)} />
                <Input placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
                <Input placeholder="State" value={state} onChange={e => setState(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentDialog;