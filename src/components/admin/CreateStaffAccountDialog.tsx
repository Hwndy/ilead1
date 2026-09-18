import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invokeFunction } from "@/lib/functions";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const randomPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pool = upper + lower + digits;
  let out = upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 7; i++) out += pool[Math.floor(Math.random() * pool.length)];
  return out;
};

export const CreateStaffAccountDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: randomPassword(),
    role: "teacher" as "teacher" | "admin",
    department: "",
    designation: "",
    employmentType: "full-time",
    joinDate: "",
    phone: "",
  });

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () =>
    setForm({
      fullName: "",
      email: "",
      password: randomPassword(),
      role: "teacher",
      department: "",
      designation: "",
      employmentType: "full-time",
      joinDate: "",
      phone: "",
    });

  const submit = async () => {
    if (form.fullName.trim().length < 2) return toast.error("Enter the staff member's full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error("Enter a valid email address");
    if (form.password.length < 8) return toast.error("The password must be at least 8 characters");

    setSaving(true);
    try {
      await invokeFunction("create-staff-user", {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        department: form.department.trim() || undefined,
        designation: form.designation.trim() || undefined,
        employmentType: form.employmentType,
        joinDate: form.joinDate || undefined,
        phone: form.phone.trim() || undefined,
      });


      toast.success(`${form.fullName} can now sign in`, {
        description: `Email: ${form.email.trim().toLowerCase()} · Temporary password: ${form.password}`,
        duration: 12000,
      });
      onCreated?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      const msg = String(e?.message || e);
      toast.error(
        /Failed to send a request|Failed to fetch|non-2xx/i.test(msg)
          ? "Staff accounts are created on the server, and the server tools are not switched on yet for this school."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a staff account</DialogTitle>
          <DialogDescription>
            This creates the sign-in account and the staff record together. Share the temporary password with them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Full name</Label>
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Aisha Bello" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label>Email address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08012345678" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Temporary password</Label>
            <div className="flex gap-2">
              <Input value={form.password} onChange={(e) => set("password", e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={() => set("password", randomPassword())}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label>Access level</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full time</SelectItem>
                  <SelectItem value="part-time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Academics" />
            </div>
            <div className="grid gap-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="Teacher" />
            </div>
            <div className="grid gap-2">
              <Label>Start date</Label>
              <Input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStaffAccountDialog;
