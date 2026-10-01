import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const StudentLoginPage = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = admissionNumber.trim();
    if (!value || value.length > 40) {
      setError('Please enter your admission number.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('student-login', {
        body: { admissionNumber: value },
      });
      if (fnError) {
        let message = 'Sign-in failed. Please try again.';
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      if (!data?.token_hash) throw new Error('Sign-in failed. Please try again.');
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
      if (otpError) throw new Error('Sign-in failed. Please try again.');
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      setError(/failed to fetch|network/i.test(msg) ? "Can't reach the school server. Check your internet and try again." : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="brand-arch flex min-h-screen items-center justify-center overflow-hidden bg-primary p-4">
      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full border-primary-foreground/10 shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <img src="/ivintage_logo.png" alt="iVintage College" className="mx-auto h-20 w-20 object-contain" />
            <CardTitle className="text-2xl font-bold text-primary">Student Portal</CardTitle>
            <p className="text-muted-foreground">Sign in with your admission number</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admission-number">Admission number</Label>
                <Input
                  id="admission-number"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder="e.g. IVC/2026/014"
                  autoComplete="username"
                  autoCapitalize="characters"
                  maxLength={40}
                  required
                  className="h-11 uppercase"
                />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? (<><LoadingSpinner size="sm" className="mr-2" />Signing in...</>) : 'Sign in'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Parent or staff?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in here</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
