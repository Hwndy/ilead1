import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invokeFunction } from '@/lib/functions';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send } from 'lucide-react';

export const EmailTestingPanel = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [emailType, setEmailType] = useState('submitted');
  const [loading, setLoading] = useState(false);

  const handleSendTestEmail = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create a dummy application for testing
      const dummyApplicationId = crypto.randomUUID();
      
      await invokeFunction('send-admission-notification', {
        application_id: dummyApplicationId,
        notification_type: emailType,
        additional_data: {
          test_email: email.trim(),
          test_mode: true,
        },
      });

      toast({
        title: 'Test Email Sent',
        description: `A test ${emailType} email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Email Testing</CardTitle>
        </div>
        <CardDescription>
          Send test emails to verify email delivery and templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-email">Test Email Address</Label>
          <Input
            id="test-email"
            type="email"
            placeholder="test@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-type">Email Type</Label>
          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger id="email-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Application Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSendTestEmail} disabled={loading} className="w-full">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Test Email
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <strong>Note:</strong> This will send a real email to the specified address.
          Make sure you have permission to send to this email.
        </div>
      </CardContent>
    </Card>
  );
};
