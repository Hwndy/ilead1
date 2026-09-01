import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildBrandedReceipt } from '@/lib/receipt-pdf';
import { fetchSchoolBranding, DEFAULT_SCHOOL_BRANDING, SchoolBranding } from '@/lib/school-branding';

export const FeePaymentCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your school fee payment…');
  const [result, setResult] = useState<any>(null);
  const [school, setSchool] = useState<SchoolBranding>(DEFAULT_SCHOOL_BRANDING);

  useEffect(() => {
    fetchSchoolBranding().then(setSchool).catch(() => {});
  }, []);

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) { setState('error'); setMessage('No payment reference was returned.'); return; }
    supabase.functions.invoke('verify-fee-payment', { body: { reference } }).then(({ data, error }) => {
      if (error || !data?.success) { setState('error'); setMessage(data?.error || error?.message || 'Payment could not be confirmed.'); }
      else {
        setState('success');
        setResult({ reference, ...data });
        setMessage(`Payment confirmed${data.receipt_number ? `  receipt ${data.receipt_number}` : ''}.`);
      }
    });
  }, [params]);

  const download = async () => {
    const doc = await buildBrandedReceipt({
      title: 'FEE PAYMENT RECEIPT',
      receiptNumber: result?.receipt_number,
      date: new Date().toLocaleDateString(),
      fields: [
        { label: 'Student', value: result?.student_name },
        { label: 'Fee', value: result?.label || result?.fee_type },
        { label: 'Payment Reference', value: result?.reference },
        { label: 'Payment Method', value: (result?.payment_method || 'Paystack').toString().toUpperCase() },
        { label: 'Status', value: 'Completed' },
      ],
      amount: Number(result?.amount || 0),
    }, school);
    doc.save(`receipt-${result?.receipt_number || result?.reference}.pdf`);
  };

  return <main className="min-h-screen flex items-center justify-center p-4 bg-background">
    <Card className="w-full max-w-md"><CardContent className="p-8 text-center space-y-4">
      {school.logo_url && (
        <img src={school.logo_url} alt={`${school.name} logo`} className="h-14 mx-auto object-contain" />
      )}
      <div>
        <p className="font-semibold uppercase leading-tight">{school.name}</p>
        {school.address && <p className="text-xs text-muted-foreground">{school.address}</p>}
      </div>
      {state === 'loading' && <Loader2 className="h-14 w-14 animate-spin mx-auto text-primary" />}
      {state === 'success' && <CheckCircle2 className="h-14 w-14 mx-auto text-success" />}
      {state === 'error' && <XCircle className="h-14 w-14 mx-auto text-destructive" />}
      <h1 className="text-2xl font-bold">{state === 'loading' ? 'Verifying payment' : state === 'success' ? 'Payment successful' : 'Verification failed'}</h1>
      <p className="text-muted-foreground">{message}</p>
      {state === 'success' && (
        <Button variant="secondary" onClick={download} className="w-full">
          <Download className="h-4 w-4 mr-2" /> Download branded receipt
        </Button>
      )}
      {state !== 'loading' && <Button onClick={() => navigate('/dashboard')} className="w-full">Return to parent portal</Button>}
    </CardContent></Card>
  </main>;
};
