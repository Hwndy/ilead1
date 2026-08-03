import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';

const DEFAULT_NOTE = "This acceptance fee will be deducted from your child's school fees.";

interface RequiredAction { label: string; url?: string }

const DEFAULT_ACTIONS: RequiredAction[] = [
  { label: 'Sign in and change your temporary password', url: '' },
  { label: 'Complete your student profile', url: '' },
  { label: 'Review the fee structure and payment schedule', url: '' },
  { label: 'Download the school calendar', url: '' },
];

const DEFAULT_INTRO =
  'Your enrollment is now complete! Here are your login credentials for the student portal.';

/**
 * Admissions defaults — acceptance fee amount and the note shown to parents.
 * Stored in app_settings so offers and the public acceptance page stay in sync.
 */
export const AdmissionSettingsEditor: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('50000');
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [orientationDate, setOrientationDate] = useState('');
  const [firstDay, setFirstDay] = useState('');
  const [portalUrl, setPortalUrl] = useState('https://ilead1.lovable.app/auth');
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [supportLine, setSupportLine] = useState('');
  const [actions, setActions] = useState<RequiredAction[]>(DEFAULT_ACTIONS);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .or('setting_key.in.(acceptance_fee_amount,acceptance_fee_note),setting_key.like.enrollment_email_%');

      data?.forEach((row) => {
        const v = row.setting_value as any;
        switch (row.setting_key) {
          case 'acceptance_fee_amount': setAmount(String(v ?? 50000)); break;
          case 'acceptance_fee_note': setNote(String(v ?? DEFAULT_NOTE)); break;
          case 'enrollment_email_orientation_date': setOrientationDate(String(v ?? '')); break;
          case 'enrollment_email_first_day': setFirstDay(String(v ?? '')); break;
          case 'enrollment_email_portal_url': if (v) setPortalUrl(String(v)); break;
          case 'enrollment_email_intro': if (v) setIntro(String(v)); break;
          case 'enrollment_email_calendar_url': setCalendarUrl(String(v ?? '')); break;
          case 'enrollment_email_support_line': setSupportLine(String(v ?? '')); break;
          case 'enrollment_email_required_actions':
            if (Array.isArray(v) && v.length) setActions(v as RequiredAction[]);
            break;
        }
      });
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter an acceptance fee greater than zero.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert(
        [
          { setting_key: 'acceptance_fee_amount', setting_value: parsed as any },
          { setting_key: 'acceptance_fee_note', setting_value: (note.trim() || DEFAULT_NOTE) as any },
          { setting_key: 'enrollment_email_orientation_date', setting_value: orientationDate as any },
          { setting_key: 'enrollment_email_first_day', setting_value: firstDay as any },
          { setting_key: 'enrollment_email_portal_url', setting_value: portalUrl.trim() as any },
          { setting_key: 'enrollment_email_intro', setting_value: (intro.trim() || DEFAULT_INTRO) as any },
          { setting_key: 'enrollment_email_calendar_url', setting_value: calendarUrl.trim() as any },
          { setting_key: 'enrollment_email_support_line', setting_value: supportLine.trim() as any },
          {
            setting_key: 'enrollment_email_required_actions',
            setting_value: actions
              .filter((a) => a.label.trim())
              .map((a) => ({ label: a.label.trim(), url: (a.url || '').trim() })) as any,
          },
        ],
        { onConflict: 'setting_key' }
      );
      if (error) throw error;
      toast({ title: 'Saved', description: 'Admission settings updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Admissions</CardTitle>
        <CardDescription>Defaults used when sending admission offers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="acceptance-fee">Acceptance Fee (₦)</Label>
          <Input
            id="acceptance-fee"
            type="number"
            min={0}
            step={500}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pre-filled on every new offer. You can still override it per applicant.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="acceptance-note">Acceptance Fee Note</Label>
          <Textarea
            id="acceptance-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Shown on the offer letter and the online acceptance page.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Enrollment Welcome Email</CardTitle>
        <CardDescription>
          Content of the email sent with the admission number and temporary password after the acceptance fee is paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="orientation-date">Orientation Date</Label>
            <Input
              id="orientation-date"
              value={orientationDate}
              onChange={(e) => setOrientationDate(e.target.value)}
              placeholder="e.g. Monday, 8 September 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-day">First Day of School</Label>
            <Input
              id="first-day"
              value={firstDay}
              onChange={(e) => setFirstDay(e.target.value)}
              placeholder="e.g. Tuesday, 9 September 2026"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="portal-url">Student Portal Login URL</Label>
          <Input id="portal-url" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="intro">Welcome Message</Label>
          <Textarea id="intro" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Required Actions</Label>
          <div className="space-y-2">
            {actions.map((action, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={action.label}
                  placeholder="Action"
                  onChange={(e) =>
                    setActions(actions.map((a, idx) => (idx === i ? { ...a, label: e.target.value } : a)))
                  }
                />
                <Input
                  value={action.url || ''}
                  placeholder="Optional link"
                  onChange={(e) =>
                    setActions(actions.map((a, idx) => (idx === i ? { ...a, url: e.target.value } : a)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setActions(actions.filter((_, idx) => idx !== i))}
                  aria-label="Remove action"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setActions([...actions, { label: '', url: '' }])}>
            <Plus className="h-4 w-4 mr-1" /> Add action
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="calendar-url">School Calendar Link</Label>
          <Input
            id="calendar-url"
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            placeholder="https://ilead1.lovable.app/school-life"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-line">Support Line</Label>
          <Input
            id="support-line"
            value={supportLine}
            onChange={(e) => setSupportLine(e.target.value)}
            placeholder="Need help? Call 0800 000 0000 or reply to this email."
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
    </div>
  );
};

export default AdmissionSettingsEditor;