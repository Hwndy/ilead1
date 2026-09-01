import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck } from 'lucide-react';
import { PhotoUpload } from '@/components/shared/PhotoUpload';

/**
 * Shown to newly enrolled students until the essential profile fields are filled.
 * Matches the "Complete your student profile" required action in the welcome email.
 */
export const ProfileCompletionPrompt: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(true);
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('students')
      .select('date_of_birth, address, photo_url, emergency_contact')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) {
      setComplete(true);
      setLoading(false);
      return;
    }

    const address = (data.address as any) || {};
    const contact = (data.emergency_contact as any) || {};
    setDob(data.date_of_birth || '');
    setPhotoUrl(data.photo_url || '');
    setStreet(address.street || '');
    setCity(address.city || '');
    setPhone(contact.phone || '');

    const missing = !data.date_of_birth || !data.photo_url || !address.street || !contact.phone;
    setComplete(!missing);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          date_of_birth: dob || null,
          photo_url: photoUrl || null,
          address: { street, city },
          emergency_contact: { phone },
        })
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Thanks  your student profile is up to date.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || complete) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-primary" /> Complete your student profile
        </CardTitle>
        <CardDescription>
          A few details are still missing. Completing them keeps your records and ID card accurate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sp-dob">Date of Birth</Label>
            <Input id="sp-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-phone">Contact Phone</Label>
            <Input id="sp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-street">Street Address</Label>
            <Input id="sp-street" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-city">City</Label>
            <Input id="sp-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          {user && (
            <div className="space-y-1.5 sm:col-span-2">
              <PhotoUpload
                id="sp-photo"
                value={photoUrl}
                onChange={setPhotoUrl}
                folder={`students/${user.id}`}
              />
            </div>
          )}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save profile'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileCompletionPrompt;
