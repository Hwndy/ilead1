import React, { useState } from 'react';
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
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface InterviewSchedulerProps {
  applicationId: string;
  onScheduled: () => void;
  trigger?: React.ReactNode;
}

export const InterviewScheduler: React.FC<InterviewSchedulerProps> = ({
  applicationId,
  onScheduled,
  trigger,
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('iVintage College Campus');
  const [interviewType, setInterviewType] = useState('in-person');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSchedule = async () => {
    if (!date || !time) {
      toast({
        title: 'Missing Information',
        description: 'Please select date and time for the interview',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const [hours, minutes] = time.split(':');
      const scheduledDate = new Date(date);
      scheduledDate.setHours(parseInt(hours), parseInt(minutes));

      // Create interview record
      // school_id is auto-populated by trigger from the parent application
      const { data: interviewData, error: interviewError } = await supabase
        .from('admission_interviews')
        .insert({
          application_id: applicationId,
          scheduled_date: scheduledDate.toISOString(),
          interview_type: interviewType,
          location: location,
          status: 'scheduled',
        } as any)
        .select()
        .single();

      if (interviewError) throw interviewError;

      // Update application status
      const { error: updateError } = await supabase
        .from('admission_applications')
        .update({ status: 'interview_scheduled' })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // Send notification
      let emailSent = true;
      try {
        const { error: emailError } = await supabase.functions.invoke('send-admission-notification', {
          body: {
            application_id: applicationId,
            notification_type: 'interview_scheduled',
            additional_data: {
              interview_date: format(scheduledDate, 'PPP'),
              interview_time: format(scheduledDate, 'p'),
              interview_location: location,
            },
          },
        });

        if (emailError) {
          console.error('Email notification failed:', emailError);
          emailSent = false;
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        emailSent = false;
      }

      toast({
        title: 'Interview Scheduled',
        description: emailSent
          ? 'Interview has been scheduled and applicant notified'
          : 'Interview scheduled. Note: Email notification failed to send.',
        variant: emailSent ? 'default' : 'default',
      });

      setOpen(false);
      onScheduled();
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule interview',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Schedule Interview
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <DialogDescription>
            Set up an interview date and time for this applicant
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Interview Type</Label>
            <Select value={interviewType} onValueChange={setInterviewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-person">In-Person</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Interview Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Interview Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Interview location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Interview'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};