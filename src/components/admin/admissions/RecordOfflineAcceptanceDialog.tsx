import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Banknote } from "lucide-react";

interface Props {
  applicationId: string;
  applicantName: string;
  defaultAmount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}

export const RecordOfflineAcceptanceDialog = ({
  applicationId, applicantName, defaultAmount = 0, open, onOpenChange, onRecorded,
}: Props) => {
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter the amount that was paid");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("record_offline_acceptance_payment", {
        p_application_id: applicationId,
        p_amount: value,
        p_method: method,
        p_reference: reference || null,
        p_notes: notes || null,
      });
      if (error) throw error;

      const enrolled = (data as any)?.enrolment?.created;
      toast.success(
        enrolled
          ? `Payment recorded and ${applicantName} enrolled as ${(data as any)?.enrolment?.admission_number}`
          : "Payment recorded",
      );
      onOpenChange(false);
      setReference("");
      setNotes("");
      onRecorded?.();
    } catch (e: any) {
      const message: string = e?.message || "Could not record the payment";
      toast.error(
        /record_offline_acceptance_payment|function|schema cache/i.test(message)
          ? "The database still needs the admissions update (db/phase5-admissions.sql)."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Record acceptance payment
          </DialogTitle>
          <DialogDescription>
            Money paid at the school for {applicantName}. Recording it accepts the offer and enrols the pupil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offline-amount">Amount (₦)</Label>
            <Input
              id="offline-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>How it was paid</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-ref">Teller / reference (optional)</Label>
            <Input id="offline-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-notes">Notes (optional)</Label>
            <Textarea id="offline-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordOfflineAcceptanceDialog;
