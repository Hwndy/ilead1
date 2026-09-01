import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Send, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OfferLetterGeneratorProps {
  applicationId: string;
  onSent: () => void;
  trigger?: React.ReactNode;
}

interface ExistingOffer {
  id: string;
  offer_letter_url: string | null;
  acceptance_deadline: string;
  status: string;
  accepted_at: string | null;
  declined_at: string | null;
  acceptance_fee: number | null;
}

export const OfferLetterGenerator: React.FC<OfferLetterGeneratorProps> = ({
  applicationId,
  onSent,
  trigger,
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [existingOffer, setExistingOffer] = useState<ExistingOffer | null>(null);
  const [checkingOffer, setCheckingOffer] = useState(true);
  const [fee, setFee] = useState<string>('50000');
  const [feeNote, setFeeNote] = useState<string>('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [appliedClassId, setAppliedClassId] = useState<string | null>(null);
  const [admittedClassId, setAdmittedClassId] = useState<string>('');
  const [classChangeNote, setClassChangeNote] = useState('');

  useEffect(() => {
    checkExistingOffer();
    loadDefaults();
    loadClassContext();
  }, [applicationId]);

  const loadClassContext = async () => {
    const [{ data: classRows }, { data: app }] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase
        .from('admission_applications')
        .select('applying_for_class_id, admitted_to_class_id')
        .eq('id', applicationId)
        .maybeSingle(),
    ]);
    setClasses(classRows ?? []);
    setAppliedClassId(app?.applying_for_class_id ?? null);
    setAdmittedClassId(app?.admitted_to_class_id || app?.applying_for_class_id || '');
  };

  const loadDefaults = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['acceptance_fee_amount', 'acceptance_fee_note']);

    data?.forEach((row) => {
      if (row.setting_key === 'acceptance_fee_amount' && row.setting_value != null) {
        setFee(String(row.setting_value));
      } else if (row.setting_key === 'acceptance_fee_note' && row.setting_value != null) {
        setFeeNote(String(row.setting_value));
      }
    });
  };

  const checkExistingOffer = async () => {
    try {
      const { data, error } = await supabase
        .from('admission_offers')
        .select('id, offer_letter_url, acceptance_deadline, status, accepted_at, declined_at, acceptance_fee')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setExistingOffer(data);
        if (data.acceptance_fee != null) setFee(String(data.acceptance_fee));
      }
    } catch (error) {
      console.error('Error checking existing offer:', error);
    } finally {
      setCheckingOffer(false);
    }
  };

  const handleSendOffer = async () => {
    if (!deadline) {
      toast({
        title: 'Missing Information',
        description: 'Please select an acceptance deadline',
        variant: 'destructive',
      });
      return;
    }

    const feeAmount = Number(fee);
    if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
      toast({
        title: 'Invalid Fee',
        description: 'Enter an acceptance fee greater than zero',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Send acceptance notification first
      try {
        await supabase.functions.invoke('send-admission-notification', {
          body: {
            application_id: applicationId,
            notification_type: 'accepted',
          },
        });
      } catch (notifError) {
        console.error('Acceptance notification failed:', notifError);
      }

      // Then send the offer letter
      const { data: offerData, error } = await supabase.functions.invoke('send-offer-letter', {
        body: {
          application_id: applicationId,
          acceptance_deadline: deadline.toISOString(),
          acceptance_fee: feeAmount,
          admitted_class_id: admittedClassId || null,
          class_change_note: classChangeNote.trim() || null,
        },
      });

      if (error) throw error;
      if (offerData && (offerData as any).error) {
        throw new Error((offerData as any).error);
      }

      // Update application status
      await supabase
        .from('admission_applications')
        .update({ status: 'accepted' })
        .eq('id', applicationId);

      toast({
        title: 'Offer Letter Sent',
        description: 'The admission offer has been sent to the applicant',
      });

      setOpen(false);
      onSent();
      checkExistingOffer(); // Refresh offer status
    } catch (error: any) {
      console.error('Error sending offer:', error);
      // Edge function errors arrive as FunctionsHttpError  extract real body.
      let description = error?.message || 'Failed to send offer letter';
      try {
        if (error?.context?.json) {
          const j = await error.context.json();
          if (j?.error) description = j.error;
        }
      } catch {/* noop */}
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Show existing offer status */}
      {!checkingOffer && existingOffer && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">
                Offer Status: <span className="text-primary capitalize">{existingOffer.status}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Deadline: {format(new Date(existingOffer.acceptance_deadline), 'PPP')}
              </p>
              <p className="text-xs text-muted-foreground italic">
                Note: Sending again will update the deadline and regenerate the PDF
              </p>
              {existingOffer.accepted_at && (
                <p className="text-sm text-green-600">
                  ✓ Accepted on {format(new Date(existingOffer.accepted_at), 'PPP')}
                </p>
              )}
              {existingOffer.declined_at && (
                <p className="text-sm text-destructive">
                  ✗ Declined on {format(new Date(existingOffer.declined_at), 'PPP')}
                </p>
              )}
              {existingOffer.offer_letter_url && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(existingOffer.offer_letter_url!, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(existingOffer.offer_letter_url!);
                      toast({ title: 'Link copied to clipboard' });
                    }}
                  >
                    Copy Link
                  </Button>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default">
            <Send className="h-4 w-4 mr-2" />
            Send Offer Letter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Admission Offer</DialogTitle>
          <DialogDescription>
            Send an official admission offer letter to the applicant
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Class applied for</Label>
            <Input
              readOnly
              value={classes.find((c) => c.id === appliedClassId)?.name || 'Not specified'}
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Admit into class</Label>
            <Select value={admittedClassId} onValueChange={setAdmittedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {admittedClassId && appliedClassId && admittedClassId !== appliedClassId && (
              <p className="text-xs text-muted-foreground">
                The letter will state that admission is offered into this class rather than the class applied for.
              </p>
            )}
          </div>

          {admittedClassId && appliedClassId && admittedClassId !== appliedClassId && (
            <div className="space-y-2">
              <Label>Reason / note (optional)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. This placement follows the entrance assessment outcome."
                value={classChangeNote}
                onChange={(e) => setClassChangeNote(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Acceptance Fee (₦)</Label>
            <Input
              type="number"
              min={0}
              step={500}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
            {feeNote && <p className="text-xs text-muted-foreground">{feeNote}</p>}
          </div>

          <div className="space-y-2">
            <Label>Acceptance Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !deadline && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'PPP') : 'Select deadline'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium">Offer will include:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Congratulations message</li>
              <li>Admission details (class, session)</li>
              <li>Acceptance fee amount (₦{Number(fee || 0).toLocaleString()})</li>
              <li>Accept/Decline buttons</li>
              <li>Payment instructions</li>
              <li><strong>PDF offer letter attachment</strong></li>
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendOffer} disabled={loading}>
              {loading ? 'Sending...' : 'Send Offer Letter'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
};
