import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { checkPassword } from '@/lib/password-policy';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const ResetPasswordPage: React.FC = () => {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { setMustChangePassword, mustChangePassword } = useAuth();
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically via onAuthStateChange
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    if (window.location.hash.includes('type=recovery')) setIsRecovery(true);
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkPassword(pwd);
    if (!check.ok) { toast.error(check.errors[0]); return; }
    if (pwd !== pwd2) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Clear the forced-change flag; surface a failure instead of looping silently.
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: updated, error: flagError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', u.user.id)
        .select('user_id, must_change_password');
      // An update that matches zero rows is not an error, but it would send the
      // student straight back into this screen  treat it as a failure.
      if (flagError || !updated?.length || updated[0].must_change_password !== false) {
        setSaving(false);
        toast.error(
          flagError?.message ||
            'Password changed, but the first-login flag could not be cleared. Please contact the school administrator.'
        );
        return;
      }
    }
    setMustChangePassword(false);
    setSaving(false);

    if (isRecovery && !mustChangePassword) {
      // Email recovery link: end the temporary recovery session.
      toast.success('Password updated. Please sign in again.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
      return;
    }

    // First-login change: keep the session and go straight to the portal.
    toast.success('Password updated.');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground">Waiting for recovery session… If nothing happens in 10 seconds, request a new reset link.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><Label>New password</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required autoComplete="new-password" />
                <p className="text-xs text-muted-foreground mt-1">Min 10 characters, with an uppercase letter, a lowercase letter and a number.</p>
              </div>
              <div><Label>Confirm new password</Label>
                <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;