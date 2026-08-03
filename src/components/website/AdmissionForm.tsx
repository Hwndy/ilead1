import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, Calendar as CalendarIcon, User, GraduationCap, FileText, CreditCard, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AdmissionFormData {
  // Personal Information
  first_name: string;
  last_name: string;
  middle_name: string;
  date_of_birth: Date | undefined;
  gender: string;
  nationality: string;
  state_of_origin: string;
  lga: string;
  
  // Contact Information
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  
  // Academic Information
  applying_for_class: string;
  previous_school: string;
  previous_class: string;
  boarding_interest: string;
  reason_for_leaving: string;
  
  // Parent/Guardian Information
  father_name: string;
  father_occupation: string;
  father_phone: string;
  father_email: string;
  mother_name: string;
  mother_occupation: string;
  mother_phone: string;
  mother_email: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_email: string;
  
  // Medical Information
  blood_group: string;
  allergies: string;
  medical_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  
  // Documents
  documents: {
    birth_certificate: File | null;
    previous_result: File | null;
    passport_photos: File | null;
    medical_report: File | null;
  };
  
  // Declaration
  declaration_accepted: boolean;
}

export const AdmissionForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<AdmissionFormData>({
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: undefined,
    gender: '',
    nationality: 'Nigerian',
    state_of_origin: '',
    lga: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    phone: '',
    email: '',
    applying_for_class: '',
    previous_school: '',
    previous_class: '',
    boarding_interest: 'day',
    reason_for_leaving: '',
    father_name: '',
    father_occupation: '',
    father_phone: '',
    father_email: '',
    mother_name: '',
    mother_occupation: '',
    mother_phone: '',
    mother_email: '',
    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_email: '',
    blood_group: '',
    allergies: '',
    medical_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    documents: {
      birth_certificate: null,
      previous_result: null,
      passport_photos: null,
      medical_report: null,
    },
    declaration_accepted: false
  });

  const { toast } = useToast();

  // Real classes loaded from DB (anon read allowed by RLS).
  const [classOptions, setClassOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error('Failed to load classes', error);
      }
      setClassOptions(data ?? []);
      setClassesLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const steps = [
    { title: 'Personal Info', icon: User, description: 'Basic personal information' },
    { title: 'Academic Info', icon: GraduationCap, description: 'Educational background' },
    { title: 'Parent/Guardian', icon: User, description: 'Parent and guardian details' },
    { title: 'Medical Info', icon: FileText, description: 'Health information' },
    { title: 'Documents', icon: Upload, description: 'Required documents' },
    { title: 'Review', icon: CheckCircle, description: 'Review and submit' }
  ];

  const nigerianStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ];

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateDocuments = (docType: keyof AdmissionFormData['documents'], file: File | null) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docType]: file
      }
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Personal Info
        return !!(formData.first_name && formData.last_name && formData.date_of_birth && 
                 formData.gender && formData.phone && formData.email);
      case 1: // Academic Info
        return !!(formData.applying_for_class);
      case 2: // Parent/Guardian
        return !!(formData.father_name || formData.mother_name || formData.guardian_name);
      case 3: // Medical Info
        return !!(formData.emergency_contact_name && formData.emergency_contact_phone);
      case 4: // Documents
        return true; // Documents are optional for initial submission
      case 5: // Review
        return formData.declaration_accepted;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      toast({
        title: 'Incomplete Information',
        description: 'Please fill in all required fields before proceeding.',
        variant: 'destructive',
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const generateApplicationNumber = (): string => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ALB-ADM-${year}-${random}`;
  };

  const handleSubmit = async () => {
    try {
      if (!validateStep(5)) {
        toast({
          title: 'Form Incomplete',
          description: 'Please complete all required fields and accept the declaration.',
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);
      
      // Check authentication status
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 User authentication status:', {
        isAuthenticated: !!session,
        userEmail: session?.user?.email || 'Not logged in',
        role: session ? 'authenticated' : 'public'
      });

      // formData.applying_for_class now holds the class UUID directly (selected from DB).
      const classId = formData.applying_for_class || null;
      if (!classId) {
        toast({
          title: 'Class required',
          description: 'Please select the class you are applying for.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare parent/guardian information
      const parentGuardianInfo = {
        father: {
          name: formData.father_name,
          occupation: formData.father_occupation,
          phone: formData.father_phone,
          email: formData.father_email
        },
        mother: {
          name: formData.mother_name,
          occupation: formData.mother_occupation,
          phone: formData.mother_phone,
          email: formData.mother_email
        },
        guardian: {
          name: formData.guardian_name,
          relationship: formData.guardian_relationship,
          phone: formData.guardian_phone,
          email: formData.guardian_email
        },
        emergency_contact: {
          name: formData.emergency_contact_name,
          phone: formData.emergency_contact_phone,
          relationship: formData.emergency_contact_relationship
        }
      };

      // Prepare address
      const addressData = {
        street: formData.address,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code
      };

      // Validate and normalize gender value
      if (!formData.gender || !['male', 'female'].includes(formData.gender.toLowerCase())) {
        toast({
          title: 'Invalid Gender',
          description: 'Please select a valid gender option.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      
      const normalizedGender = formData.gender.toLowerCase() as 'male' | 'female';

      // Insert admission application with status payment_pending
      // Application number and ID will be auto-generated by database
      console.log('📝 Submitting application data:', {
        classId,
        email: formData.email,
        gender: normalizedGender,
        dateOfBirth: formData.date_of_birth ? format(formData.date_of_birth, 'yyyy-MM-dd') : null,
      });

      // Use SECURITY DEFINER RPC so school_id is resolved server-side from the
      // chosen class or the active admission session. This is the only safe way
      // for public/anon submissions to satisfy the NOT NULL school_id requirement.
      const { data: rpcData, error: applicationError } = await supabase.rpc(
        'submit_admission_application',
        {
          payload: {
            first_name: formData.first_name.trim(),
            middle_name: formData.middle_name?.trim() || null,
            last_name: formData.last_name.trim(),
            date_of_birth: formData.date_of_birth ? format(formData.date_of_birth, 'yyyy-MM-dd') : null,
            gender: normalizedGender,
            blood_group: formData.blood_group || null,
            state_of_origin: formData.state_of_origin || null,
            lga: formData.lga || null,
            nationality: formData.nationality || 'Nigerian',
            religion: null,
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            address: addressData,
            previous_school: formData.previous_school?.trim() || null,
            previous_class: formData.previous_class || null,
            boarding_interest: formData.boarding_interest === 'boarding',
            applying_for_class_id: classId,
            parent_guardian_info: parentGuardianInfo,
            medical_conditions: formData.medical_conditions?.trim() || null,
            allergies: formData.allergies?.trim() || null,
            special_needs: null,
          },
        }
      );
      const applicationData = rpcData as { id?: string; application_number?: string } | null;

      if (applicationError) {
        console.error('❌ FULL ERROR DETAILS:', {
          message: applicationError.message,
          code: applicationError.code,
          details: applicationError.details,
          hint: applicationError.hint,
          fullError: applicationError
        });
        
        console.error('❌ Data that failed to insert:', {
          status: 'payment_pending',
          gender: normalizedGender,
          email: formData.email,
          classId
        });
        
        toast({
          title: 'Submission Failed',
          description: `Error: ${applicationError.message}. Please check your information and try again.`,
          variant: 'destructive',
        });
        throw applicationError;
      }
      
      console.log('✅ Application inserted successfully:', applicationData);
      
      const applicationNumber = applicationData?.application_number;
      const applicationId = applicationData?.id;

      // Upload documents if any
      if (formData.documents.birth_certificate || formData.documents.previous_result || 
          formData.documents.passport_photos || formData.documents.medical_report) {
        
        const documentsToUpload = [];
        
        if (formData.documents.birth_certificate) {
          documentsToUpload.push({
            type: 'birth_certificate',
            file: formData.documents.birth_certificate
          });
        }
        if (formData.documents.previous_result) {
          documentsToUpload.push({
            type: 'previous_result',
            file: formData.documents.previous_result
          });
        }
        if (formData.documents.passport_photos) {
          documentsToUpload.push({
            type: 'passport_photos',
            file: formData.documents.passport_photos
          });
        }
        if (formData.documents.medical_report) {
          documentsToUpload.push({
            type: 'medical_report',
            file: formData.documents.medical_report
          });
        }

        // Upload each document
        for (const doc of documentsToUpload) {
          const fileExt = doc.file.name.split('.').pop();
          const fileName = `${applicationId}/${doc.type}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('admission-documents')
            .upload(fileName, doc.file, { upsert: true });

          if (uploadError) {
            console.error('Document upload failed:', doc.type, uploadError);
            continue;
          }

          const { error: docInsertError } = await supabase
            .from('admission_documents')
            .insert({
              application_id: applicationId,
              document_type:
                doc.type === 'previous_result' ? 'previous_school_report' :
                doc.type === 'passport_photos' ? 'passport_photo' :
                doc.type === 'medical_report' ? 'medical_certificate' :
                doc.type,
              document_name: doc.file.name,
              // Store the storage path (not a public URL); the admin viewer
              // downloads via supabase.storage.from(...).download(file_url).
              file_url: fileName,
              file_size: doc.file.size,
              mime_type: doc.file.type,
            } as any);

          if (docInsertError) {
            console.error('Document metadata insert failed:', doc.type, docInsertError);
          }
        }
      }

      // Send notification email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-admission-notification', {
          body: {
            application_id: applicationId,
            notification_type: 'submitted',
          },
        });

        if (emailError) {
          console.error('Email notification failed:', emailError);
          toast({
            title: 'Application Submitted',
            description: 'Your application was submitted successfully, but we could not send the confirmation email. Please save your application number.',
            variant: 'default',
          });
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't fail the submission if notification fails
      }

      setSubmissionId(applicationNumber);
      setApplicationId(applicationId);
      
      toast({
        title: 'Application Submitted Successfully!',
        description: `Your application number is ${applicationNumber}. Please save this for future reference.`,
      });

    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (submissionId && applicationId) {
    const handlePayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('initialize-admission-payment', {
          body: {
            application_id: applicationId,
            amount: 10000,
            email: formData.email,
            callback_url: `${window.location.origin}/payment-callback`,
          }
        });
        
        if (error) throw error;
        
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        }
      } catch (error: any) {
        console.error('Payment error:', error);
        toast({
          title: 'Payment Error',
          description: 'Failed to initialize payment. Please try again or contact admissions.',
          variant: 'destructive',
        });
      }
    };

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-600 mb-2">Application Submitted Successfully!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for applying to iVintage College. Your application has been received and is being processed.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold">Application Number:</p>
              <p className="text-2xl font-bold text-primary">{submissionId}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please save this number for future reference and tracking.
              </p>
            </div>
            
            <div className="bg-primary/10 p-4 rounded-lg mb-6">
              <p className="font-semibold text-primary mb-2">Next Step: Pay Application Fee</p>
              <p className="text-sm text-muted-foreground mb-4">
                Complete your application by paying the ₦10,000 application fee.
              </p>
              <Button onClick={handlePayment} size="lg" className="w-full sm:w-auto">
                <CreditCard className="h-5 w-5 mr-2" />
                Proceed to Payment
              </Button>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• You will receive a confirmation email within 24 hours</p>
              <p>• Entrance examination dates will be communicated via email/phone</p>
              <p>• Contact our admissions office for any inquiries: +234 802 815 2097</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-0 sm:p-2">
      <Card className="border-0 sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-3 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-center text-base sm:text-xl">iVintage College Admission Application</CardTitle>
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex justify-between items-start gap-1 sm:gap-2 mt-4 sm:mt-6 overflow-x-auto -mx-1 px-1">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={index} className="flex flex-col items-center flex-1 min-w-[44px]">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 mb-1 sm:mb-2 shrink-0",
                    index <= currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground text-muted-foreground"
                  )}>
                    <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className={cn(
                    "text-[10px] sm:text-xs text-center leading-tight",
                    index <= currentStep ? "text-primary" : "text-muted-foreground"
                  )}>
                    <span className="hidden sm:inline">{step.title}</span>
                    <span className="sm:hidden">{index + 1}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {/* Step 0: Personal Information */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateFormData('first_name', e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateFormData('last_name', e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input
                      id="middle_name"
                      value={formData.middle_name}
                      onChange={(e) => updateFormData('middle_name', e.target.value)}
                      placeholder="Enter middle name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.date_of_birth && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_of_birth ? format(formData.date_of_birth, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date_of_birth}
                          onSelect={(date) => updateFormData('date_of_birth', date)}
                          initialFocus
                          disabled={(date) => 
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          defaultMonth={new Date(2010, 0)}
                          captionLayout="dropdown-buttons"
                          fromYear={1950}
                          toYear={new Date().getFullYear()}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => updateFormData('nationality', e.target.value)}
                      placeholder="Nationality"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_of_origin">State of Origin</Label>
                    <Select value={formData.state_of_origin} onValueChange={(value) => updateFormData('state_of_origin', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {nigerianStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lga">Local Government Area</Label>
                    <Input
                      id="lga"
                      value={formData.lga}
                      onChange={(e) => updateFormData('lga', e.target.value)}
                      placeholder="Enter LGA"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateFormData('address', e.target.value)}
                      placeholder="Enter full address"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData('city', e.target.value)}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select value={formData.state} onValueChange={(value) => updateFormData('state', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {nigerianStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormData('phone', e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      placeholder="Enter email address"
                    />
                    <p className="text-xs text-muted-foreground">
                      You may use the same email for all your children. Each child gets their own school-issued
                      login ID, while all school emails come to this address.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Academic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="applying_for_class">Applying for Class *</Label>
                  <Select value={formData.applying_for_class} onValueChange={(value) => updateFormData('applying_for_class', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={classesLoading ? 'Loading classes...' : 'Select class'} />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.length === 0 && !classesLoading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No classes available yet. Please contact the school.
                        </div>
                      ) : (
                        classOptions.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previous_school">Previous School</Label>
                  <Input
                    id="previous_school"
                    value={formData.previous_school}
                    onChange={(e) => updateFormData('previous_school', e.target.value)}
                    placeholder="Name of previous school"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previous_class">Previous Class</Label>
                  <Input
                    id="previous_class"
                    value={formData.previous_class}
                    onChange={(e) => updateFormData('previous_class', e.target.value)}
                    placeholder="Last class completed"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="reason_for_leaving">Reason for Leaving Previous School</Label>
                  <Textarea
                    id="reason_for_leaving"
                    value={formData.reason_for_leaving}
                    onChange={(e) => updateFormData('reason_for_leaving', e.target.value)}
                    placeholder="Please explain reason for leaving previous school"
                    rows={3}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="boarding_interest">Boarding Interest *</Label>
                  <Select
                    value={formData.boarding_interest}
                    onValueChange={(value) => updateFormData('boarding_interest', value)}
                  >
                    <SelectTrigger id="boarding_interest">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day student</SelectItem>
                      <SelectItem value="boarding">Boarding student (hostel)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Hostel places are subject to availability and a separate hostel fee.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Parent/Guardian Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Parent/Guardian Information</h3>
              <Tabs defaultValue="father" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  <TabsTrigger value="father" className="text-xs sm:text-sm px-2 py-2">
                    <span className="sm:hidden">Father</span>
                    <span className="hidden sm:inline">Father's Details</span>
                  </TabsTrigger>
                  <TabsTrigger value="mother" className="text-xs sm:text-sm px-2 py-2">
                    <span className="sm:hidden">Mother</span>
                    <span className="hidden sm:inline">Mother's Details</span>
                  </TabsTrigger>
                  <TabsTrigger value="guardian" className="text-xs sm:text-sm px-2 py-2">
                    <span className="sm:hidden">Guardian</span>
                    <span className="hidden sm:inline">Guardian's Details</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="father" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="father_name">Father's Full Name</Label>
                      <Input
                        id="father_name"
                        value={formData.father_name}
                        onChange={(e) => updateFormData('father_name', e.target.value)}
                        placeholder="Enter father's full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="father_occupation">Occupation</Label>
                      <Input
                        id="father_occupation"
                        value={formData.father_occupation}
                        onChange={(e) => updateFormData('father_occupation', e.target.value)}
                        placeholder="Enter father's occupation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="father_phone">Phone Number</Label>
                      <Input
                        id="father_phone"
                        value={formData.father_phone}
                        onChange={(e) => updateFormData('father_phone', e.target.value)}
                        placeholder="Enter father's phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="father_email">Email Address</Label>
                      <Input
                        id="father_email"
                        type="email"
                        value={formData.father_email}
                        onChange={(e) => updateFormData('father_email', e.target.value)}
                        placeholder="Enter father's email"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="mother" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mother_name">Mother's Full Name</Label>
                      <Input
                        id="mother_name"
                        value={formData.mother_name}
                        onChange={(e) => updateFormData('mother_name', e.target.value)}
                        placeholder="Enter mother's full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mother_occupation">Occupation</Label>
                      <Input
                        id="mother_occupation"
                        value={formData.mother_occupation}
                        onChange={(e) => updateFormData('mother_occupation', e.target.value)}
                        placeholder="Enter mother's occupation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mother_phone">Phone Number</Label>
                      <Input
                        id="mother_phone"
                        value={formData.mother_phone}
                        onChange={(e) => updateFormData('mother_phone', e.target.value)}
                        placeholder="Enter mother's phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mother_email">Email Address</Label>
                      <Input
                        id="mother_email"
                        type="email"
                        value={formData.mother_email}
                        onChange={(e) => updateFormData('mother_email', e.target.value)}
                        placeholder="Enter mother's email"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="guardian" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="guardian_name">Guardian's Full Name</Label>
                      <Input
                        id="guardian_name"
                        value={formData.guardian_name}
                        onChange={(e) => updateFormData('guardian_name', e.target.value)}
                        placeholder="Enter guardian's full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardian_relationship">Relationship to Student</Label>
                      <Input
                        id="guardian_relationship"
                        value={formData.guardian_relationship}
                        onChange={(e) => updateFormData('guardian_relationship', e.target.value)}
                        placeholder="e.g., Uncle, Aunt, Elder Brother"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardian_phone">Phone Number</Label>
                      <Input
                        id="guardian_phone"
                        value={formData.guardian_phone}
                        onChange={(e) => updateFormData('guardian_phone', e.target.value)}
                        placeholder="Enter guardian's phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardian_email">Email Address</Label>
                      <Input
                        id="guardian_email"
                        type="email"
                        value={formData.guardian_email}
                        onChange={(e) => updateFormData('guardian_email', e.target.value)}
                        placeholder="Enter guardian's email"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 3: Medical Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Medical Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="blood_group">Blood Group</Label>
                  <Select value={formData.blood_group} onValueChange={(value) => updateFormData('blood_group', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="allergies">Known Allergies</Label>
                  <Textarea
                    id="allergies"
                    value={formData.allergies}
                    onChange={(e) => updateFormData('allergies', e.target.value)}
                    placeholder="List any known allergies (food, medicine, environmental, etc.)"
                    rows={3}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="medical_conditions">Medical Conditions</Label>
                  <Textarea
                    id="medical_conditions"
                    value={formData.medical_conditions}
                    onChange={(e) => updateFormData('medical_conditions', e.target.value)}
                    placeholder="List any existing medical conditions or disabilities"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Emergency Contact Name *</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={(e) => updateFormData('emergency_contact_name', e.target.value)}
                      placeholder="Full name of emergency contact"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_phone">Emergency Contact Phone *</Label>
                    <Input
                      id="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => updateFormData('emergency_contact_phone', e.target.value)}
                      placeholder="Emergency contact phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                    <Input
                      id="emergency_contact_relationship"
                      value={formData.emergency_contact_relationship}
                      onChange={(e) => updateFormData('emergency_contact_relationship', e.target.value)}
                      placeholder="Relationship to student"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Required Documents</h3>
              <p className="text-muted-foreground">
                Please upload the following documents. You can also bring physical copies during the entrance examination.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="birth_certificate">Birth Certificate</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => updateDocuments('birth_certificate', e.target.files?.[0] || null)}
                      className="hidden"
                      id="birth_certificate"
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('birth_certificate')?.click()}>
                      Choose File
                    </Button>
                    {formData.documents.birth_certificate && (
                      <p className="text-xs text-green-600 mt-2">
                        {formData.documents.birth_certificate.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="previous_result">Previous School Result</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => updateDocuments('previous_result', e.target.files?.[0] || null)}
                      className="hidden"
                      id="previous_result"
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('previous_result')?.click()}>
                      Choose File
                    </Button>
                    {formData.documents.previous_result && (
                      <p className="text-xs text-green-600 mt-2">
                        {formData.documents.previous_result.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passport_photos">Passport Photographs (4 copies)</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => updateDocuments('passport_photos', e.target.files?.[0] || null)}
                      className="hidden"
                      id="passport_photos"
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('passport_photos')?.click()}>
                      Choose File
                    </Button>
                    {formData.documents.passport_photos && (
                      <p className="text-xs text-green-600 mt-2">
                        {formData.documents.passport_photos.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical_report">Medical Report/Certificate</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => updateDocuments('medical_report', e.target.files?.[0] || null)}
                      className="hidden"
                      id="medical_report"
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('medical_report')?.click()}>
                      Choose File
                    </Button>
                    {formData.documents.medical_report && (
                      <p className="text-xs text-green-600 mt-2">
                        {formData.documents.medical_report.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review and Submit */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Review Your Application</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {formData.first_name} {formData.middle_name} {formData.last_name}</p>
                    <p><strong>Date of Birth:</strong> {formData.date_of_birth ? format(formData.date_of_birth, 'PPP') : 'Not provided'}</p>
                    <p><strong>Gender:</strong> {formData.gender}</p>
                    <p><strong>Phone:</strong> {formData.phone}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Academic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Applying for:</strong> {classOptions.find(c => c.id === formData.applying_for_class)?.name || 'Not selected'}</p>
                    <p><strong>Previous School:</strong> {formData.previous_school || 'Not provided'}</p>
                    <p><strong>Previous Class:</strong> {formData.previous_class || 'Not provided'}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Parent/Guardian</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Father:</strong> {formData.father_name || 'Not provided'}</p>
                    <p><strong>Mother:</strong> {formData.mother_name || 'Not provided'}</p>
                    <p><strong>Guardian:</strong> {formData.guardian_name || 'Not provided'}</p>
                    <p><strong>Emergency Contact:</strong> {formData.emergency_contact_name}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={cn("h-4 w-4", formData.documents.birth_certificate ? "text-green-600" : "text-muted-foreground")} />
                      <span>Birth Certificate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={cn("h-4 w-4", formData.documents.previous_result ? "text-green-600" : "text-muted-foreground")} />
                      <span>Previous Result</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={cn("h-4 w-4", formData.documents.passport_photos ? "text-green-600" : "text-muted-foreground")} />
                      <span>Passport Photos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={cn("h-4 w-4", formData.documents.medical_report ? "text-green-600" : "text-muted-foreground")} />
                      <span>Medical Report</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="declaration"
                    checked={formData.declaration_accepted}
                    onChange={(e) => updateFormData('declaration_accepted', e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="declaration" className="text-sm">
                    <strong>Declaration:</strong> I hereby declare that all information provided in this application is true and accurate to the best of my knowledge. I understand that any false information may result in the rejection of this application or cancellation of admission. I agree to abide by the rules and regulations of iVintage College.
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-6">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="w-full sm:w-auto"
            >
              Previous
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.declaration_accepted}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={nextStep} className="w-full sm:w-auto">
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};