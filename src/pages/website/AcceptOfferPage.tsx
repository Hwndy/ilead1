import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WebsiteLayout } from '@/components/website/WebsiteLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OfferData {
  id: string;
  application_id: string;
  acceptance_deadline: string;
  status: string;
  accepted_at?: string;
  declined_at?: string;
  acceptance_fee?: number;
  acceptance_fee_note?: string;
}

interface ApplicationData {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  admitted_to_class_id: string;
  classes?: { name: string };
}

export const AcceptOfferPage = () => {
  const { token } = useParams<{ token: string }>();
  const acceptanceToken = token ? decodeURIComponent(token).trim() : '';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [application, setApplication] = useState<ApplicationData | null>(null);

  useEffect(() => {
    if (acceptanceToken) {
      loadOfferDetails();
    } else {
      setLoading(false);
    }
  }, [acceptanceToken]);

  const loadOfferDetails = async () => {
    try {
      // Public link: offers are not readable by anonymous visitors under RLS,
      // so resolve the token through a security-definer function instead.
      const { data, error } = await supabase.rpc('get_offer_by_token', { p_token: acceptanceToken });
      if (error) throw error;

      const result = data as any;
      if (result) {
        setOffer({
          id: result.id,
          application_id: result.application_id,
          acceptance_deadline: result.acceptance_deadline,
          status: result.status,
          accepted_at: result.accepted_at,
          declined_at: result.declined_at,
          acceptance_fee: result.acceptance_fee != null ? Number(result.acceptance_fee) : undefined,
          acceptance_fee_note: result.acceptance_fee_note,
        });

        const app = result.application;
        if (app) {
          setApplication({
            id: app.id,
            application_number: app.application_number,
            first_name: app.first_name,
            last_name: app.last_name,
            email: app.email,
            admitted_to_class_id: app.admitted_to_class_id,
            classes: { name: app.class_name || 'N/A' },
          });
        }
      }
    } catch (error) {
      console.error('Error loading offer:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Invalid offer link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!acceptanceToken || !application) return;

    setProcessing(true);
    try {
      // Use secure edge function to accept offer
      const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-offer', {
        body: {
          acceptance_token: acceptanceToken,
          decision: 'accepted',
        },
      });

      if (acceptError) throw acceptError;

      if (acceptData.error) {
        throw new Error(acceptData.error);
      }

      // Initialize payment after successful acceptance
      const { data, error } = await supabase.functions.invoke('initialize-acceptance-payment', {
        body: {
          application_id: acceptData.application_id,
          email: application.email,
          callback_url: `${window.location.origin}/payment-callback`,
        },
      });

      if (error) throw error;

      window.location.href = data.authorization_url;
    } catch (error: any) {
      console.error('Error accepting offer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process acceptance',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!acceptanceToken) return;

    setProcessing(true);
    try {
      // Use secure edge function to decline offer
      const { data, error } = await supabase.functions.invoke('accept-offer', {
        body: {
          acceptance_token: acceptanceToken,
          decision: 'declined',
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Offer Declined',
        description: 'We appreciate your consideration',
      });

      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      console.error('Error declining offer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline offer',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <WebsiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </WebsiteLayout>
    );
  }

  if (!offer || !application) {
    return (
      <WebsiteLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Invalid Offer
              </CardTitle>
              <CardDescription>
                This offer link is invalid or has expired
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')} className="w-full">
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </WebsiteLayout>
    );
  }

  const isProcessed = offer.status === 'accepted' || offer.status === 'declined';

  if (isProcessed) {
    return (
      <WebsiteLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Offer Already Processed</CardTitle>
              <CardDescription>
                This offer has already been {offer.status}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/track-application')} className="w-full">
                Track Application
              </Button>
            </CardContent>
          </Card>
        </div>
      </WebsiteLayout>
    );
  }

  const deadline = new Date(`${offer.acceptance_deadline}T23:59:59.999`);
  const isExpired = deadline < new Date();
  const feeAmount = offer.acceptance_fee ?? 0;
  const feeLabel = `₦${feeAmount.toLocaleString()}`;
  const feeNote = offer.acceptance_fee_note || "This acceptance fee will be deducted from your child's school fees.";

  return (
    <WebsiteLayout>
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Congratulations!
              </CardTitle>
              <CardDescription>
                You have been offered admission to iVintage College
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-6 rounded-lg space-y-3">
                <h3 className="font-semibold text-lg">Admission Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Application Number</p>
                    <p className="font-medium">{application.application_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Student Name</p>
                    <p className="font-medium">{application.first_name} {application.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Class</p>
                    <p className="font-medium">{application.classes?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Acceptance Fee</p>
                    <p className="font-medium">{feeLabel}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-1">{feeNote}</p>
              </div>

              {isExpired && (
                <Alert variant="destructive">
                  <AlertDescription>
                    This offer expired on {new Date(offer.acceptance_deadline).toLocaleDateString()}. 
                    Please contact admissions for assistance.
                  </AlertDescription>
                </Alert>
              )}

              {!isExpired && (
                <>
                  <div className="space-y-2">
                    <h4 className="font-medium">Next Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Accept this admission offer</li>
                      <li>Pay the acceptance fee ({feeLabel})</li>
                      <li>Complete enrollment process</li>
                      <li>Receive your student credentials</li>
                    </ol>
                    <p className="text-sm text-muted-foreground">{feeNote}</p>
                  </div>

                  <Alert>
                    <CreditCard className="h-4 w-4" />
                    <AlertDescription>
                      Acceptance deadline: {new Date(offer.acceptance_deadline).toLocaleDateString()}
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleAccept}
                      disabled={processing}
                      className="flex-1"
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept & Pay Fee
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDecline}
                      disabled={processing}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline Offer
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </WebsiteLayout>
  );
};
