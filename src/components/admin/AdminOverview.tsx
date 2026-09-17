import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { fetchPlacementMap } from "@/lib/student-placement";
import {
  Banknote,
  GraduationCap,
  Users,
  FileText,
  RefreshCw,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n || 0);

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

interface Snapshot {
  students: number;
  staff: number;
  parents: number;
  collectedThisMonth: number;
  paymentsThisMonth: number;
  collectedToday: number;
  applications: number;
  awaitingDocuments: number;
  offersOut: number;
  enrolledFromAdmissions: number;
}

const EMPTY: Snapshot = {
  students: 0,
  staff: 0,
  parents: 0,
  collectedThisMonth: 0,
  paymentsThisMonth: 0,
  collectedToday: 0,
  applications: 0,
  awaitingDocuments: 0,
  offersOut: 0,
  enrolledFromAdmissions: 0,
};

export const AdminOverview = () => {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [campusCounts, setCampusCounts] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    const next: Snapshot = { ...EMPTY };
    const notes: string[] = [];

    const monthStart = startOfMonth();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    try {
      const [studentsRes, staffRes, rolesRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).is("archived_at", null),
        supabase.from("staff_details").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("user_roles").select("role").eq("role", "parent"),
      ]);
      next.students = studentsRes.count || 0;
      next.staff = staffRes.count || 0;
      next.parents = rolesRes.data?.length || 0;
    } catch {
      notes.push("people");
    }

    try {
      const { data } = await supabase
        .from("fee_payments")
        .select("amount_paid, created_at, paid_at, status")
        .gte("created_at", monthStart)
        .limit(5000);
      const rows = (data || []).filter((p: any) => (p.status ?? "completed") !== "failed");
      next.paymentsThisMonth = rows.length;
      next.collectedThisMonth = rows.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);
      next.collectedToday = rows
        .filter((p: any) => (p.paid_at || p.created_at || "") >= todayStart)
        .reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);
    } catch {
      notes.push("payments");
    }

    try {
      const { data } = await supabase
        .from("admission_applications")
        .select("id, status, documents_status, student_id, created_at, first_name, last_name")
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = (data as any[]) || [];
      next.applications = rows.length;
      next.awaitingDocuments = rows.filter(
        (a) => !a.documents_status || a.documents_status === "pending" || a.documents_status === "incomplete",
      ).length;
      next.offersOut = rows.filter((a) => ["offered", "accepted", "payment_pending"].includes(a.status)).length;
      next.enrolledFromAdmissions = rows.filter((a) => a.student_id).length;
      setRecentApplications(rows.slice(0, 5));
    } catch {
      notes.push("admissions");
    }

    try {
      const { data } = await supabase
        .from("fee_payments")
        .select("id, amount_paid, payment_method, receipt_number, created_at, paid_at, student_id")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentPayments((data as any[]) || []);
    } catch {
      /* handled by the note above */
    }

    try {
      const placements = await fetchPlacementMap();
      const counts = new Map<string, number>();
      placements.forEach((p) => {
        const name = p.campus_name || "Not placed";
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      setCampusCounts(
        Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
      );
    } catch {
      setCampusCounts([]);
    }

    setSnap(next);
    if (notes.length) setProblem(`Some figures could not be loaded (${notes.join(", ")}).`);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const go = (tab: string, subtab?: string) =>
    navigate(`/admin?tab=${tab}${subtab ? `&subtab=${subtab}` : ""}`);

  const tiles = [
    {
      label: "Collected this month",
      value: naira(snap.collectedThisMonth),
      hint: `${snap.paymentsThisMonth} payment(s) · ${naira(snap.collectedToday)} today`,
      icon: Banknote,
      action: () => go("fees", "payments"),
    },
    {
      label: "Pupils on roll",
      value: snap.students,
      hint: `${snap.staff} staff · ${snap.parents} parent accounts`,
      icon: GraduationCap,
      action: () => go("academic", "students"),
    },
    {
      label: "Applications",
      value: snap.applications,
      hint: `${snap.awaitingDocuments} waiting on documents`,
      icon: FileText,
      action: () => go("admissions", "applications"),
    },
    {
      label: "Offers in progress",
      value: snap.offersOut,
      hint: `${snap.enrolledFromAdmissions} already enrolled`,
      icon: Users,
      action: () => go("admissions", "decisions"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Today at a glance</h2>
          <p className="text-sm text-muted-foreground">Money, pupils and admissions in one place.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {problem && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md p-3">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {problem}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, hint, icon: Icon, action }) => (
          <Card key={label} className="cursor-pointer hover:border-primary/60 transition-colors" onClick={action}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-bold mt-2">{loading ? "—" : value}</p>
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Latest payments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => go("fees", "payments")}>
              See all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPayments.length === 0 && (
              <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No payments recorded yet."}</p>
            )}
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{naira(Number(p.amount_paid || 0))}</p>
                  <p className="text-xs text-muted-foreground">
                    {(p.payment_method || "payment")} · {new Date(p.paid_at || p.created_at).toLocaleDateString()}
                  </p>
                </div>
                {p.receipt_number && <Badge variant="secondary">{p.receipt_number}</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Newest applications</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => go("admissions", "applications")}>
              See all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentApplications.length === 0 && (
              <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No applications yet."}</p>
            )}
            {recentApplications.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{[a.first_name, a.last_name].filter(Boolean).join(" ") || "Applicant"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={a.status === "admitted" || a.student_id ? "default" : "secondary"}>
                  {a.student_id ? "enrolled" : a.status || "submitted"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
