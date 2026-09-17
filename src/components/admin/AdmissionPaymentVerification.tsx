import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, CheckCircle, Clock, XCircle, Banknote } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordOfflineAcceptanceDialog } from "@/components/admin/admissions/RecordOfflineAcceptanceDialog";
interface Payment {
  id: string;
  application_id: string;
  amount: number;
  status: string;
  payment_type: string;
  payment_method: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  application: {
    application_number: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export const AdmissionPaymentVerification = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [candidates, setCandidates] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [offlineOpen, setOfflineOpen] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [filter]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admission_applications")
        .select("id, application_number, first_name, last_name, status")
        .in("status", ["accepted", "payment_pending"] as any)
        .order("application_number");
      setCandidates(
        (data || []).map((a: any) => ({
          id: a.id,
          label: `${a.application_number} — ${a.first_name} ${a.last_name}`,
        })),
      );
    })();
  }, []);

  const fetchPayments = async () => {
    try {
      let query = 
        supabase
          .from("admission_payments")
          .select(`
            *,
            application:admission_applications!inner(
              application_number,
              first_name,
              last_name,
              email
            )
          `)
          .order("created_at", { ascending: false })
      ;

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast.error("Failed to load payments: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { icon: any; variant: "default" | "secondary" | "destructive" }> = {
      completed: { icon: CheckCircle, variant: "default" },
      pending: { icon: Clock, variant: "secondary" },
      failed: { icon: XCircle, variant: "destructive" },
    };

    const { icon: Icon, variant } = variants[status] || variants.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const completedAmount = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{payments.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{completedAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter(p => p.status === "completed").length} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments.filter(p => p.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Records</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Applicant who paid at school" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedApp}
                onClick={() => setOfflineOpen(true)}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Record offline payment
              </Button>
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => setFilter("completed")}
              >
                Completed
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payments...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.application?.application_number}
                    </TableCell>
                    <TableCell>
                      {payment.application?.first_name} {payment.application?.last_name}
                      <div className="text-sm text-muted-foreground">
                        {payment.application?.email}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_type.replace('_', ' ')}</TableCell>
                    <TableCell>₦{Number(payment.amount).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedApp && (
        <RecordOfflineAcceptanceDialog
          applicationId={selectedApp}
          applicantName={candidates.find((c) => c.id === selectedApp)?.label || "this applicant"}
          open={offlineOpen}
          onOpenChange={setOfflineOpen}
          onRecorded={fetchPayments}
        />
      )}
    </div>
  );
};
