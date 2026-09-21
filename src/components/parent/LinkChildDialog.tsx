import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useChildren } from '@/contexts/ChildContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const LinkChildDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { refresh } = useChildren();
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!admissionNumber.trim() || !dob) {
      toast({ title: 'Missing info', description: 'Enter admission number and date of birth', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('link_parent_to_student', {
      p_admission_number: admissionNumber.trim(),
      p_date_of_birth: dob,
      p_relationship_type: relationship,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Could not link child', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Child linked', description: `${(data as any)?.full_name || 'Student'} added to your portal.` });
    await refresh();
    setAdmissionNumber('');
    setDob('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a child to your account</DialogTitle>
          <DialogDescription>
            Enter your child's admission number and date of birth to verify the link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admno">Admission number</Label>
            <Input id="admno" placeholder="IV/2025/0001" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="mother">Mother</SelectItem>
                <SelectItem value="father">Father</SelectItem>
                <SelectItem value="guardian">Guardian</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Link child
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};