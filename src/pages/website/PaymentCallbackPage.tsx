import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WebsiteLayout } from '@/components/website/WebsiteLayout';
import { useSchoolInfo } from '@/hooks/useCms';
import { printNode } from '@/lib/print-node';

interface Receipt {
  reference?: string | null;
  amount?: number | null;
  currency?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  payment_type?: string | null;
  admission_number?: string | null;
  login_email?: string | null;
  contact_email?: string | null;
  application_number?: string | null;
  student_name?: string | null;
  enrollment_pending?: boolean | null;
}

const formatMoney = (amount?: number | null, currency?: string | null) => {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'NGN'} ${amount.toLocaleString()}`;
  }
};

export const PaymentCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { info: school } = useSchoolInfo();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const startedRef = React.useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke: verifying twice can
    // re-issue a second temporary password and invalidate the emailed one.
    if (startedRef.current) return;
    startedRef.current = true;
    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPayment = async () => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) {
      setStatus('failed');
      setMessage('No payment reference found');
      return;
    }

    try {
      // Route by reference prefix: applicants are anonymous and cannot read
      // admission_payments, so we must not depend on a DB lookup here.
      const functionName = reference.toUpperCase().startsWith('ACC-')
        ? 'verify-acceptance-payment'
        : 'verify-admission-payment';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { reference },
      });

      if (error) throw error;

      if (data?.success) {
        setStatus('success');
        setReceipt({ reference, ...data });
        toast({
          title: 'Payment Successful',
          description: 'Your payment has been confirmed.',
        });
      } else {
        setStatus('failed');
        setMessage('Payment verification failed. Please contact support.');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      setMessage('An error occurred while verifying your payment.');
      toast({
        title: 'Verification Error',
        description: 'Could not verify payment. Please contact admissions.',
        variant: 'destructive',
      });
    }
  };

  const isEnrollment = Boolean(receipt?.admission_number);
  const enrollmentPending = Boolean(receipt?.enrollment_pending);

  const Row = ({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) =>
    value ? (
      <div className="flex justify-between gap-4 py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={strong ? 'font-bold text-primary break-all' : 'font-medium break-all'}>{value}</span>
      </div>
    ) : null;

  return (
    <WebsiteLayout>
      <div className="min-h-screen py-12 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 sm:p-8">
            {status === 'verifying' && (
              <div className="text-center">
                <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
                <h1 className="text-2xl font-bold mb-2">Processing Payment</h1>
                <p className="text-muted-foreground">{message}</p>
              </div>
            )}

            {status === 'success' && (
              <>
                <div id="payment-receipt">
                  <div className="text-center mb-6">
                    {school?.logo_url && (
                      <img
                        src={school.logo_url}
                        alt={`${school?.name || 'School'} logo`}
                        className="h-14 mx-auto mb-3 object-contain"
                      />
                    )}
                    <p className="font-semibold uppercase">{school?.name || 'iVintage College'}</p>
                    {school?.address && (
                      <p className="text-xs text-muted-foreground">{school.address}</p>
                    )}
                    {(school?.contact_phone || school?.contact_email) && (
                      <p className="text-xs text-muted-foreground">
                        {[school?.contact_phone && `Tel: ${school.contact_phone}`, school?.contact_email && `Email: ${school.contact_email}`]
                          .filter(Boolean)
                          .join('  |  ')}
                      </p>
                    )}
                    {school?.motto && (
                      <p className="text-xs italic text-muted-foreground">“{school.motto}”</p>
                    )}
                    <CheckCircle className="h-14 w-14 text-green-600 mx-auto my-3" />
                    <h1 className="text-2xl font-bold text-green-600">Payment Successful</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                      {isEnrollment
                        ? 'Your acceptance fee has been received and your place is confirmed.'
                        : 'Your payment has been received and confirmed.'}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 text-sm space-y-1">
                    <h2 className="font-semibold mb-2">Payment Receipt</h2>
                    <Row label="Amount Paid" value={formatMoney(receipt?.amount, receipt?.currency)} strong />
                    <Row label="Reference" value={receipt?.reference} />
                    <Row
                      label="Payment Method"
                      value={receipt?.payment_method ? String(receipt.payment_method).toUpperCase() : null}
                    />
                    <Row
                      label="Date"
                      value={receipt?.paid_at ? new Date(receipt.paid_at).toLocaleString() : new Date().toLocaleString()}
                    />
                    <Row
                      label="Payment Type"
                      value={receipt?.payment_type === 'acceptance_fee' ? 'Acceptance Fee' : 'Application Fee'}
                    />
                  </div>

                  <div className="rounded-lg border p-4 text-sm space-y-1 mt-4">
                    <h2 className="font-semibold mb-2">Applicant Details</h2>
                    <Row label="Student" value={receipt?.student_name} />
                    <Row label="Application No." value={receipt?.application_number} />
                    <Row label="Admission No." value={receipt?.admission_number} strong />
                    <Row label="Student Login ID" value={receipt?.login_email} strong />
                    <Row label="Contact Email" value={(receipt as any)?.contact_email} />
                    {enrollmentPending && (
                      <p className="text-xs text-muted-foreground pt-2 border-t mt-2">
                        Your payment has been received and recorded. The school is finalising your
                        student record; your admission number and login details will be emailed to
                        the contact address shortly. Please keep this receipt for your records.
                      </p>
                    )}
                    {isEnrollment && (
                      <p className="text-xs text-muted-foreground pt-2 border-t mt-2">
                        Sign in with the Student Login ID above (it is issued by the school and is unique to
                        this student — siblings can share one contact email). The temporary password has been
                        emailed to the contact address, along with the parent portal login. Please change the
                        password after the first sign in. This acceptance fee has been credited towards school fees.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mt-6 no-print">
                  <Button
                    onClick={() =>
                      printNode(document.getElementById('payment-receipt'), {
                        title: 'Payment Receipt',
                        pageSize: 'A4',
                      })
                    }
                    variant="secondary"
                    className="w-full"
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print / Download Receipt
                  </Button>
                  {isEnrollment && (
                    <Button onClick={() => navigate('/login')} className="w-full">
                      Go to Student Login
                    </Button>
                  )}
                  <Button
                    onClick={() => navigate('/track-application')}
                    variant={isEnrollment ? 'outline' : 'default'}
                    className="w-full"
                  >
                    Track Application
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                    Return Home
                  </Button>
                </div>
              </>
            )}

            {status === 'failed' && (
              <div className="text-center">
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-destructive mb-2">Payment Failed</h1>
                <p className="text-muted-foreground mb-6">{message}</p>
                <div className="space-y-3">
                  <Button onClick={() => navigate('/website/admissions/apply')} className="w-full">
                    Try Again
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                    Return Home
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WebsiteLayout>
  );
};
