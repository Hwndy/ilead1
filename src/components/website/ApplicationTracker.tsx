import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, Clock, XCircle, Calendar, FileText, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface Application {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  application_date: string;
  classes?: {
    name: string;
  };
}

export const ApplicationTracker = () => {
  const { toast } = useToast();
  const [applicationNumber, setApplicationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleTrack = async () => {
    if (!applicationNumber || !email) {
      toast({
        title: 'Required Fields',
        description: 'Please enter both application number and email',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Use secure edge function with rate limiting
      const { data, error } = await supabase.functions.invoke('track-application', {
        body: {
          application_number: applicationNumber.toUpperCase(),
          email: email.toLowerCase(),
        },
      });

      if (error) throw error;

      if (data.error) {
        setApplication(null);
        toast({
          title: data.error.includes('Rate limit') ? 'Too Many Attempts' : 'Application Not Found',
          description: data.error,
          variant: 'destructive',
        });
      } else if (data.success && data.application) {
        setApplication(data.application as Application);
      } else {
        setApplication(null);
        toast({
          title: 'Application Not Found',
          description: 'No application found with these details. Please check and try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error tracking application:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to track application. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { icon: any; color: string; label: string; description: string }> = {
      submitted: {
        icon: Clock,
        color: 'text-blue-600',
        label: 'Submitted',
        description: 'Your application has been received and is awaiting review.',
      },
      under_review: {
        icon: FileText,
        color: 'text-yellow-600',
        label: 'Under Review',
        description: 'Our admissions team is currently reviewing your application.',
      },
      interview_scheduled: {
        icon: Calendar,
        color: 'text-purple-600',
        label: 'Interview Scheduled',
        description: 'Your interview has been scheduled. Check your email for details.',
      },
      accepted: {
        icon: CheckCircle,
        color: 'text-green-600',
        label: 'Accepted',
        description: 'Congratulations! You have been offered admission.',
      },
      rejected: {
        icon: XCircle,
        color: 'text-red-600',
        label: 'Not Accepted',
        description: 'Unfortunately, we cannot offer you admission at this time.',
      },
      payment_pending: {
        icon: Clock,
        color: 'text-orange-600',
        label: 'Payment Pending',
        description: 'Please complete your application fee payment.',
      },
      enrolled: {
        icon: CheckCircle,
        color: 'text-green-600',
        label: 'Enrolled',
        description: 'You are now enrolled. Welcome to iVintage College!',
      },
      withdrawn: {
        icon: XCircle,
        color: 'text-gray-600',
        label: 'Withdrawn',
        description: 'This application has been withdrawn.',
      },
    };

    return statusMap[status] || statusMap.submitted;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'enrolled':
        return 'default';
      case 'rejected':
      case 'withdrawn':
        return 'destructive';
      case 'under_review':
      case 'interview_scheduled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Track Your Application</CardTitle>
          <CardDescription>
            Enter your application details to check your admission status
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Search Form */}
          {!application && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="application_number">Application Number</Label>
                <Input
                  id="application_number"
                  placeholder="e.g., APP2025-000001"
                  value={applicationNumber}
                  onChange={(e) => setApplicationNumber(e.target.value)}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleTrack} 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track Application
                  </>
                )}
              </Button>

              {searched && !application && !loading && (
                <Alert>
                  <AlertDescription>
                    No application found. Please verify your application number and email address.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Application Status */}
          {application && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {application.first_name} {application.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {application.application_number}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(application.status)}>
                  {getStatusInfo(application.status).label}
                </Badge>
              </div>

              <div className="p-6 bg-muted rounded-lg space-y-4">
                <div className="flex items-start gap-4">
                  {React.createElement(getStatusInfo(application.status).icon, {
                    className: `h-12 w-12 ${getStatusInfo(application.status).color}`,
                  })}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Current Status</h4>
                    <p className="text-sm text-muted-foreground">
                      {getStatusInfo(application.status).description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span className="font-medium">
                      {format(new Date(application.application_date), 'PP')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{application.email}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{application.phone}</span>
                  </div>
                </div>
              </div>

              {application.status === 'accepted' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Congratulations! Please check your email for next steps and enrollment instructions.
                  </AlertDescription>
                </Alert>
              )}

              {application.status === 'interview_scheduled' && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    Interview details have been sent to your email. Please check and confirm your attendance.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setApplication(null);
                  setApplicationNumber('');
                  setEmail('');
                  setSearched(false);
                }}
                className="w-full"
              >
                Track Another Application
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};