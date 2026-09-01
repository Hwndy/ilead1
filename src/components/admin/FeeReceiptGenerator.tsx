import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Printer, Search } from "lucide-react";
import { format } from "date-fns";
import { buildBrandedReceipt } from "@/lib/receipt-pdf";
import { fetchSchoolBranding, DEFAULT_SCHOOL_BRANDING, SchoolBranding } from "@/lib/school-branding";

interface Payment {
  id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  status: string;
  student?: {
    admission_number: string;
    profile?: {
      full_name: string;
    };
  };
  fee_structure?: {
    fee_type: string;
    academic_year: string;
  };
}

export const FeeReceiptGenerator = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolBranding>(DEFAULT_SCHOOL_BRANDING);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSchoolBranding().then(setSchoolInfo).catch(() => {});
  }, []);

  const searchPayments = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a receipt number or admission number");
      return;
    }

    setIsLoading(true);

    // Search by receipt number
    let { data, error } = await supabase
      .from("fee_payments")
      .select(`
        *,
        student:students(
          user_id,
          admission_number
        ),
        fee_structure:fee_structures(fee_type, academic_year)
      `)
      
      .or(`receipt_number.ilike.%${searchQuery}%`);

    if (!error && data && data.length === 0) {
      // Search by admission number
      const { data: students } = await supabase
        .from("students")
        .select("id")
        
        .ilike("admission_number", `%${searchQuery}%`);

      if (students && students.length > 0) {
        const studentIds = students.map(s => s.id);
        
        const { data: paymentData } = await supabase
          .from("fee_payments")
          .select(`
            *,
            student:students(
              user_id,
              admission_number
            ),
          fee_structure:fee_structures(fee_type, academic_year)
          `)
          
          .in("student_id", studentIds);

        data = paymentData;
      }
    }

    const rows = ((data as any) || []) as any[];
    const userIds = [...new Set(rows.map(r => r.student?.user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    }
    setPayments(rows.map(r => ({
      ...r,
      student: r.student ? { ...r.student, profile: { full_name: nameMap.get(r.student.user_id) || "Unknown" } } : null,
    })) as any);
    setIsLoading(false);
  };

  const generatePDF = async (payment: Payment) => {
    return buildBrandedReceipt(
      {
        title: "FEE PAYMENT RECEIPT",
        receiptNumber: payment.receipt_number,
        date: payment.payment_date ? format(new Date(payment.payment_date), "MMM dd, yyyy") : null,
        fields: [
          { label: "Student Name", value: payment.student?.profile?.full_name },
          { label: "Admission No.", value: payment.student?.admission_number },
          { label: "Fee Type", value: payment.fee_structure?.fee_type },
          { label: "Academic Year", value: payment.fee_structure?.academic_year },
          { label: "Payment Method", value: payment.payment_method },
          { label: "Status", value: payment.status },
        ],
        amount: Number(payment.amount_paid),
      },
      schoolInfo
    );
  };

  const handleDownload = async (payment: Payment) => {
    const doc = await generatePDF(payment);
    doc.save(`receipt-${payment.receipt_number || payment.id}.pdf`);
    toast.success("Receipt downloaded successfully");
  };

  const handlePrint = async (payment: Payment) => {
    const doc = await generatePDF(payment);
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  const handlePreview = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowPreviewDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fee Receipt Generator</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Search Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by receipt number or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPayments()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchPayments} disabled={isLoading}>
              Search
            </Button>
          </div>

          {payments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.receipt_number || ""}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.student?.profile?.full_name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.student?.admission_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{payment.fee_structure?.fee_type || ""}</TableCell>
                    <TableCell>₦{payment.amount_paid.toLocaleString()}</TableCell>
                    <TableCell>
                      {payment.payment_date
                        ? format(new Date(payment.payment_date), "MMM dd, yyyy")
                        : ""}
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_method || ""}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(payment)}
                          title="Preview"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(payment)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrint(payment)}
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {payments.length === 0 && searchQuery && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No payments found matching your search
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div ref={receiptRef} className="p-6 border rounded-lg bg-white">
              <div className="text-center mb-6">
                {schoolInfo.logo_url && (
                  <img
                    src={schoolInfo.logo_url}
                    alt={`${schoolInfo.name} logo`}
                    className="h-16 mx-auto mb-2 object-contain"
                  />
                )}
                <h2 className="text-xl font-bold uppercase">{schoolInfo.name}</h2>
                {schoolInfo.address && <p className="text-sm text-muted-foreground">{schoolInfo.address}</p>}
                {(schoolInfo.phone || schoolInfo.email) && (
                  <p className="text-sm text-muted-foreground">
                    {[schoolInfo.phone && `Tel: ${schoolInfo.phone}`, schoolInfo.email && `Email: ${schoolInfo.email}`]
                      .filter(Boolean)
                      .join("  |  ")}
                  </p>
                )}
                {schoolInfo.motto && <p className="text-xs italic text-muted-foreground">“{schoolInfo.motto}”</p>}
              </div>

              <h3 className="text-lg font-bold text-center mb-4 border-y py-2">FEE RECEIPT</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Receipt No</p>
                  <p className="font-medium">{selectedPayment.receipt_number || "N/A"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {selectedPayment.payment_date
                      ? format(new Date(selectedPayment.payment_date), "MMM dd, yyyy")
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student Name:</span>
                  <span className="font-medium">{selectedPayment.student?.profile?.full_name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Admission No:</span>
                  <span className="font-medium">{selectedPayment.student?.admission_number || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee Type:</span>
                  <span className="font-medium">{selectedPayment.fee_structure?.fee_type || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Academic Year:</span>
                  <span className="font-medium">{selectedPayment.fee_structure?.academic_year || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="font-medium capitalize">{selectedPayment.payment_method || "N/A"}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg mb-6">
                <span className="text-lg font-medium">Amount Paid:</span>
                <span className="text-2xl font-bold">₦{selectedPayment.amount_paid.toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8">
                <div className="text-center">
                  <div className="border-t border-dashed pt-2">
                    <p className="text-sm text-muted-foreground">Authorized Signature</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-dashed pt-2">
                    <p className="text-sm text-muted-foreground">School Stamp</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground mt-6">
                This is a computer generated receipt.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            {selectedPayment && (
              <>
                <Button variant="outline" onClick={() => handlePrint(selectedPayment)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={() => handleDownload(selectedPayment)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
