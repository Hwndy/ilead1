import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, FileText, Calendar, User, Mail, Phone, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { InterviewScheduler } from '@/components/admin/InterviewScheduler';
import { AdmissionDocumentViewer } from '@/components/admin/AdmissionDocumentViewer';
import { OfferLetterGenerator } from '@/components/admin/OfferLetterGenerator';
import { RejectionNotifier } from '@/components/admin/RejectionNotifier';
import { InterviewPanelManager } from '@/components/admin/InterviewPanelManager';
import { InterviewFeedbackForm } from '@/components/admin/InterviewFeedbackForm';
import { ApplicationExamResult } from '@/components/admin/admissions/ApplicationExamResult';

type AdmissionStatus = 'submitted' | 'under_review' | 'interview_scheduled' | 'accepted' | 'rejected' | 'payment_pending' | 'enrolled' | 'withdrawn';

interface Application {
  id: string;
  application_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  status: AdmissionStatus;
  application_date: string;
  applying_for_class_id: string | null;
  parent_guardian_info: any;
  address: any;
}

export const AdmissionManagement = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [siblingMap, setSiblingMap] = useState<Record<string, string[]>>({});
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResults, setBackfillResults] = useState<any[] | null>(null);
  // Applicants who paid the acceptance fee but whose student record was never
  // created (a post-payment step failed). Maps application id -> payment ref.
  const [pendingEnrolments, setPendingEnrolments] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchPendingEnrolments = async () => {
    const { data: apps } = await supabase
      .from('admission_applications')
      .select('id')
      .eq('status', 'accepted')
      .is('student_id', null);
    const ids = (apps ?? []).map((a: any) => a.id);
    if (!ids.length) {
      setPendingEnrolments({});
      return;
    }
    const { data: pays } = await supabase
      .from('admission_payments')
      .select('application_id, transaction_id')
      .in('application_id', ids)
      .eq('payment_type', 'acceptance_fee')
      .eq('status', 'completed');
    const map: Record<string, string> = {};
    (pays ?? []).forEach((p: any) => {
      if (p.transaction_id) map[p.application_id] = p.transaction_id;
    });
    setPendingEnrolments(map);
  };

  const completeEnrolment = async (applicationId: string) => {
    const reference = pendingEnrolments[applicationId];
    if (!reference) return;
    setCompletingId(applicationId);
    const { data, error } = await supabase.functions.invoke('verify-acceptance-payment', {
      body: { reference },
    });
    setCompletingId(null);
    if (error || !(data as any)?.success || (data as any)?.enrollment_pending) {
      toast({
        title: 'Enrolment could not be completed',
        description:
          (data as any)?.error || error?.message || 'Please check the function logs and retry.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Enrolment completed',
      description: `Admission number ${(data as any)?.admission_number ?? ''} issued and credentials emailed.`,
    });
    fetchApplications();
    fetchPendingEnrolments();
  };

  const runLoginBackfill = async () => {
    setBackfilling(true);
    const { data, error } = await supabase.functions.invoke('backfill-student-logins');
    setBackfilling(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Backfill failed',
        description: (data as any)?.error || error?.message,
        variant: 'destructive',
      });
      return;
    }
    setBackfillResults((data as any)?.results ?? []);
    fetchApplications();
  };

  // Families frequently share ONE email across several children. Flag those so
  // they are never mistaken for duplicate submissions.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admission_applications')
        .select('email, first_name, last_name, application_number');
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((a: any) => {
        const key = String(a.email ?? '').trim().toLowerCase();
        if (!key) return;
        (map[key] ||= []).push(`${a.first_name} ${a.last_name} (${a.application_number})`);
      });
      setSiblingMap(map);
    })();
  }, []);

  useEffect(() => {
    fetchApplications();
    fetchPendingEnrolments();
  }, [statusFilter]);

  // Keep the list in sync when a payment enrolls an applicant in the background.
  useEffect(() => {
    const channel = supabase
      .channel('admission-applications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admission_applications' },
        () => fetchApplications()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchApplications = async () => {
    try {
      let query = supabase
        .from('admission_applications')
        .select('*')
        
        .order('application_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as AdmissionStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setApplications((data || []) as Application[]);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: AdmissionStatus) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('admission_applications')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Send notification email
      let emailSent = true;
      try {
        const { error: emailError } = await supabase.functions.invoke('send-admission-notification', {
          body: {
            application_id: applicationId,
            notification_type: newStatus,
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
        title: 'Status Updated',
        description: emailSent 
          ? `Application ${newStatus} successfully. Notification sent to applicant.`
          : `Application ${newStatus} successfully. Note: Email notification failed to send.`,
        variant: emailSent ? 'default' : 'default',
      });

      fetchApplications();
      setSelectedApplication(null);
      setReviewNotes('');
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update application status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: AdmissionStatus) => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      case 'under_review':
        return 'default';
      case 'interview_scheduled':
        return 'outline';
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'enrolled':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: AdmissionStatus) => {
    switch (status) {
      case 'accepted':
      case 'enrolled':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const statusCounts = {
    all: applications.length,
    submitted: applications.filter(a => a.status === 'submitted').length,
    under_review: applications.filter(a => a.status === 'under_review').length,
    interview_scheduled: applications.filter(a => a.status === 'interview_scheduled').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    enrolled: applications.filter(a => a.status === 'enrolled').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={runLoginBackfill} disabled={backfilling}>
          {backfilling ? 'Fixing logins…' : 'Fix student logins & parent links'}
        </Button>
      </div>

      <Dialog open={!!backfillResults} onOpenChange={(o) => !o && setBackfillResults(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student logins updated</DialogTitle>
            <DialogDescription>
              Each enrolled student now has a unique school-issued login ID, and the family email is
              linked as a parent account. Parents who had no account are created here and emailed
              their sign-in details automatically  share the temporary passwords below as a backup.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-3 text-sm">
            {(backfillResults ?? []).length === 0 && <p>No enrolled students needed changes.</p>}
            {(backfillResults ?? []).map((r, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1">
                <p className="font-medium">{r.student || r.application_number}</p>
                {r.error ? (
                  <p className="text-destructive">{r.error}</p>
                ) : (
                  <>
                    <p>Student login ID: <span className="font-mono">{r.login_email}</span></p>
                    {r.parent_email && <p>Parent email: <span className="font-mono">{r.parent_email}</span></p>}
                    {r.parent_temporary_password && (
                      <p>Parent temp password: <span className="font-mono">{r.parent_temporary_password}</span></p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(r.changes ?? []).length ? (r.changes ?? []).join(', ') : 'already up to date'}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="inline-flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="submitted">New ({statusCounts.submitted})</TabsTrigger>
          <TabsTrigger value="under_review">Review ({statusCounts.under_review})</TabsTrigger>
          <TabsTrigger value="interview_scheduled">Interview ({statusCounts.interview_scheduled})</TabsTrigger>
          <TabsTrigger value="accepted">Accepted ({statusCounts.accepted})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({statusCounts.rejected})</TabsTrigger>
          <TabsTrigger value="enrolled">Enrolled ({statusCounts.enrolled})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Applications List */}
      <div className="grid gap-4">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          applications.map((application) => (
            <Card key={application.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        {application.first_name} {application.middle_name} {application.last_name}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(application.status)} className="flex items-center gap-1">
                        {getStatusIcon(application.status)}
                        {application.status.replace('_', ' ')}
                      </Badge>
                      {(siblingMap[String(application.email ?? '').trim().toLowerCase()]?.length ?? 0) > 1 && (
                        <Badge
                          variant="outline"
                          title={siblingMap[String(application.email).trim().toLowerCase()]
                            .filter((n) => !n.includes(application.application_number))
                            .join(', ')}
                        >
                          Shared email ·{' '}
                          {siblingMap[String(application.email).trim().toLowerCase()].length - 1} sibling
                          {siblingMap[String(application.email).trim().toLowerCase()].length - 1 === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{application.application_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{application.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{application.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Applied: {format(new Date(application.application_date), 'PP')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Age: {new Date().getFullYear() - new Date(application.date_of_birth).getFullYear()} years</span>
                      </div>
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedApplication(application)}
                      >
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Application Details</DialogTitle>
                        <DialogDescription>
                          {application.application_number}
                        </DialogDescription>
                      </DialogHeader>

                      {selectedApplication && (
                        <div className="space-y-6">
                          {/* Personal Information */}
                          <div>
                            <h4 className="font-semibold mb-3">Personal Information</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Full Name:</span>
                                <p className="font-medium">
                                  {selectedApplication.first_name} {selectedApplication.middle_name} {selectedApplication.last_name}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Date of Birth:</span>
                                <p className="font-medium">{format(new Date(selectedApplication.date_of_birth), 'PP')}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Gender:</span>
                                <p className="font-medium">{selectedApplication.gender}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Status:</span>
                                <p className="font-medium capitalize">{selectedApplication.status.replace('_', ' ')}</p>
                              </div>
                            </div>
                          </div>

                          {/* Contact Information */}
                          <div>
                            <h4 className="font-semibold mb-3">Contact Information</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Email:</span>
                                <p className="font-medium">{selectedApplication.email}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Phone:</span>
                                <p className="font-medium">{selectedApplication.phone}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Address:</span>
                                <p className="font-medium">
                                  {selectedApplication.address?.street}, {selectedApplication.address?.city}, {selectedApplication.address?.state}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Parent/Guardian Information */}
                          <div>
                            <h4 className="font-semibold mb-3">Parent/Guardian Information</h4>
                            <div className="space-y-3 text-sm">
                              {selectedApplication.parent_guardian_info?.father?.name && (
                                <div>
                                  <span className="text-muted-foreground">Father:</span>
                                  <p className="font-medium">
                                    {selectedApplication.parent_guardian_info.father.name} - {selectedApplication.parent_guardian_info.father.phone}
                                  </p>
                                </div>
                              )}
                              {selectedApplication.parent_guardian_info?.mother?.name && (
                                <div>
                                  <span className="text-muted-foreground">Mother:</span>
                                  <p className="font-medium">
                                    {selectedApplication.parent_guardian_info.mother.name} - {selectedApplication.parent_guardian_info.mother.phone}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Documents */}
                          <div>
                            <h4 className="font-semibold mb-3">Uploaded Documents</h4>
                            <AdmissionDocumentViewer applicationId={selectedApplication.id} />
                          </div>

                          {/* Entrance exam result */}
                          <ApplicationExamResult applicationId={selectedApplication.id} />

                          {/* Review Notes */}
                          <div className="space-y-2">
                            <Label htmlFor="review_notes">Review Notes</Label>
                            <Textarea
                              id="review_notes"
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Add notes about this application..."
                              rows={4}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 justify-end">
                            {selectedApplication.status === 'enrolled' && (
                              <p className="text-sm text-muted-foreground mr-auto">
                                This applicant is enrolled. The student account and welcome email have been
                                issued, so the status can no longer be changed.
                              </p>
                            )}
                            {selectedApplication.status === 'submitted' && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => updateApplicationStatus(selectedApplication.id, 'under_review')}
                                  disabled={actionLoading}
                                >
                                  Mark Under Review
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => updateApplicationStatus(selectedApplication.id, 'rejected')}
                                  disabled={actionLoading}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {selectedApplication.status === 'under_review' && (
                              <>
                                <InterviewScheduler
                                  applicationId={selectedApplication.id}
                                  onScheduled={fetchApplications}
                                  trigger={
                                    <Button variant="outline" disabled={actionLoading}>
                                      Schedule Interview
                                    </Button>
                                  }
                                />
                                <RejectionNotifier
                                  applicationId={selectedApplication.id}
                                  onRejected={fetchApplications}
                                />
                                <Button
                                  onClick={() => updateApplicationStatus(selectedApplication.id, 'accepted')}
                                  disabled={actionLoading}
                                >
                                  Accept
                                </Button>
                              </>
                            )}
                            {selectedApplication.status === 'interview_scheduled' && (
                              <>
                                <InterviewPanelManager
                                  interviewId={selectedApplication.id}
                                  onUpdate={fetchApplications}
                                />
                                <InterviewFeedbackForm
                                  interviewId={selectedApplication.id}
                                  onSubmit={fetchApplications}
                                />
                              </>
                            )}
                            {selectedApplication.status === 'accepted' && (
                              <>
                                {pendingEnrolments[selectedApplication.id] && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => completeEnrolment(selectedApplication.id)}
                                    disabled={completingId === selectedApplication.id}
                                  >
                                    {completingId === selectedApplication.id
                                      ? 'Completing enrolment…'
                                      : 'Complete enrolment (fee paid)'}
                                  </Button>
                                )}
                                <OfferLetterGenerator
                                  applicationId={selectedApplication.id}
                                  onSent={fetchApplications}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};