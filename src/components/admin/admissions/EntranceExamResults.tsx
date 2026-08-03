import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Mail, RefreshCw, RotateCcw, Save } from "lucide-react";

export interface PaperSubject { subject: string; max: number }
export interface SubjectScore { subject: string; score: number | null; max: number }

interface ResultRow {
  assignment_id: string;
  application_id: string;
  application_number: string;
  full_name: string;
  email: string;
  status: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  result_status: string;
  comment: string | null;
  source: string;
  result_sent_at: string | null;
  resit_sent_at: string | null;
  subject_scores: SubjectScore[] | null;
  resit_date: string | null;
  resit_venue: string | null;
  online_score: number | null;
  online_max_score: number | null;
  online_percentage: number | null;
}

interface Props {
  examId: string;
  examTitle: string;
  defaultMaxScore?: number | null;
  examMode?: string | null;
  paperSubjects?: PaperSubject[] | null;
}

const pct = (score: number | null, max: number | null) =>
  score != null && max != null && max > 0 ? Math.round((score / max) * 10000) / 100 : null;

const sumScores = (rows: SubjectScore[]) => ({
  score: rows.reduce((s, r) => s + (r.score ?? 0), 0),
  max: rows.reduce((s, r) => s + (Number(r.max) || 0), 0),
});

export const EntranceExamResults = ({
  examId, examTitle, defaultMaxScore, examMode, paperSubjects,
}: Props) => {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [resitTarget, setResitTarget] = useState<ResultRow | null>(null);
  const [resitDate, setResitDate] = useState("");
  const [resitVenue, setResitVenue] = useState("");

  const isPaper = examMode === "paper";
  const subjects: PaperSubject[] = (paperSubjects || []).filter((s) => s?.subject);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_entrance_exam_results", { p_exam_id: examId });
    if (error) {
      toast.error("Failed to load results: " + error.message);
      setRows([]);
    } else {
      setRows(((data as any[]) || []).map((r) => {
        const saved: SubjectScore[] = Array.isArray(r.subject_scores) ? r.subject_scores : [];
        const merged = subjects.length
          ? subjects.map((s) => {
              const hit = saved.find((x) => x.subject === s.subject);
              return { subject: s.subject, max: Number(s.max) || 0, score: hit?.score ?? null };
            })
          : saved;
        return {
          ...r,
          subject_scores: merged,
          max_score: r.max_score
            ?? (merged.length ? sumScores(merged).max : null)
            ?? r.online_max_score ?? defaultMaxScore ?? null,
        };
      }) as ResultRow[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, defaultMaxScore, JSON.stringify(subjects)]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const patch = (id: string, changes: Partial<ResultRow>) =>
    setRows((prev) => prev.map((r) => (r.assignment_id === id ? { ...r, ...changes } : r)));

  const patchSubject = (id: string, subject: string, value: string) =>
    setRows((prev) => prev.map((r) => {
      if (r.assignment_id !== id) return r;
      const next = (r.subject_scores || []).map((s) =>
        s.subject === subject ? { ...s, score: value === "" ? null : Number(value) } : s);
      const { score, max } = sumScores(next);
      return { ...r, subject_scores: next, score, max_score: max, percentage: pct(score, max), source: "manual" };
    }));

  const pullOnline = () => {
    let pulled = 0;
    setRows((prev) => prev.map((r) => {
      if (r.online_score == null) return r;
      pulled += 1;
      return {
        ...r,
        score: r.online_score,
        max_score: r.online_max_score ?? r.max_score,
        percentage: r.online_percentage ?? pct(r.online_score, r.online_max_score),
        source: "online",
      };
    }));
    toast.success(pulled ? `Pulled ${pulled} online score(s). Remember to save.` : "No online sessions found for this exam");
  };

  const save = async (row: ResultRow) => {
    setBusy(row.assignment_id);
    const { error } = await supabase.rpc("save_entrance_exam_result", {
      p_assignment_id: row.assignment_id,
      p_score: row.score,
      p_max_score: row.max_score,
      p_result_status: row.result_status || "pending",
      p_comment: row.comment,
      p_source: row.source || "manual",
      p_subject_scores: (row.subject_scores || []) as any,
    } as any);
    setBusy(null);
    if (error) return toast.error("Save failed: " + error.message);
    patch(row.assignment_id, { percentage: pct(row.score, row.max_score) });
    toast.success(`Saved result for ${row.full_name}`);
  };

  const saveAll = async () => {
    setBusy("all");
    let ok = 0;
    for (const row of rows) {
      const { error } = await supabase.rpc("save_entrance_exam_result", {
        p_assignment_id: row.assignment_id,
        p_score: row.score,
        p_max_score: row.max_score,
        p_result_status: row.result_status || "pending",
        p_comment: row.comment,
        p_source: row.source || "manual",
        p_subject_scores: (row.subject_scores || []) as any,
      } as any);
      if (!error) ok += 1;
    }
    setBusy(null);
    toast.success(`Saved ${ok} of ${rows.length} record(s)`);
    fetchRows();
  };

  const sendEmail = async (
    row: ResultRow,
    kind: "result" | "resit",
    resit?: { date: string | null; venue: string | null },
  ) => {
    if (kind === "result" && row.score == null) {
      return toast.error("Enter and save a score before sending the result");
    }
    setBusy(row.assignment_id);
    try {
      if (kind === "resit" && resit) {
        await supabase.rpc("set_entrance_resit_details", {
          p_assignment_id: row.assignment_id,
          p_resit_date: resit.date ? new Date(resit.date).toISOString() : null,
          p_resit_venue: resit.venue,
        } as any);
      }
      const resitWhen = resit?.date ?? row.resit_date;
      const { error } = await supabase.functions.invoke("send-admission-notification", {
        body: {
          application_id: row.application_id,
          notification_type: kind === "result" ? "exam_result" : "exam_resit",
          additional_data: {
            exam_title: examTitle,
            score: row.score,
            max_score: row.max_score,
            percentage: row.percentage ?? pct(row.score, row.max_score),
            result_status: row.result_status,
            comment: row.comment,
            subject_scores: (row.subject_scores || []).filter((s) => s.score != null),
            resit_date: resitWhen
              ? new Date(resitWhen).toLocaleString("en-NG", {
                  dateStyle: "full", timeStyle: "short",
                })
              : null,
            resit_venue: resit?.venue ?? row.resit_venue ?? null,
          },
        },
      });
      if (error) throw error;
      await supabase.rpc("mark_entrance_result_sent", { p_assignment_id: row.assignment_id, p_kind: kind });
      patch(row.assignment_id, kind === "result"
        ? { result_sent_at: new Date().toISOString() }
        : {
            resit_sent_at: new Date().toISOString(),
            resit_date: resit?.date ? new Date(resit.date).toISOString() : row.resit_date,
            resit_venue: resit?.venue ?? row.resit_venue,
          });
      toast.success(`${kind === "result" ? "Result" : "Resit"} email sent to ${row.email}`);
    } catch (e: any) {
      toast.error(`Failed to send email: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const openResit = (row: ResultRow) => {
    setResitTarget(row);
    setResitDate(row.resit_date ? new Date(row.resit_date).toISOString().slice(0, 16) : "");
    setResitVenue(row.resit_venue ?? "");
  };

  const confirmResit = async () => {
    if (!resitTarget) return;
    if (!resitDate) return toast.error("Pick the resit date and time");
    const target = resitTarget;
    setResitTarget(null);
    await sendEmail(target, "resit", { date: resitDate, venue: resitVenue || null });
  };

  const sendAllRecorded = async () => {
    const targets = rows.filter((r) => r.score != null && r.result_status !== "pending");
    if (!targets.length) return toast.error("No saved results to send");
    for (const r of targets.filter((t) => t.result_status !== "resit")) {
      await sendEmail(r, "result");
    }
    const resits = targets.filter((t) => t.result_status === "resit").length;
    if (resits) toast.info(`${resits} resit candidate(s) skipped — send those individually with a date.`);
  };

  const exportCsv = () => {
    const subjectCols = subjects.map((s) => `${s.subject} (/${s.max})`);
    const header = ["Application", "Name", "Email", ...subjectCols, "Score", "Total", "Percentage", "Outcome", "Comment"];
    const body = rows.map((r) => [
      r.application_number, r.full_name, r.email,
      ...subjects.map((s) => (r.subject_scores || []).find((x) => x.subject === s.subject)?.score ?? ""),
      r.score ?? "", r.max_score ?? "",
      r.percentage ?? pct(r.score, r.max_score) ?? "", r.result_status, (r.comment || "").replace(/"/g, "'"),
    ]);
    const csv = [header, ...body].map((line) => line.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${examTitle.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scored = rows.filter((r) => r.percentage != null || r.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.percentage ?? pct(r.score, r.max_score) ?? 0), 0) / scored.length)
    : 0;
  const passRate = rows.length
    ? Math.round((rows.filter((r) => r.result_status === "pass").length / rows.length) * 100)
    : 0;

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading results...</div>;

  if (!rows.length) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No applicants assigned to this exam yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {rows.length} applicant(s) · Avg {avg}% · Pass rate {passRate}%
          {isPaper && <Badge variant="secondary" className="ml-2">Paper exam</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isPaper && (
            <Button size="sm" variant="outline" onClick={pullOnline}>
              <RefreshCw className="h-4 w-4 mr-2" /> Pull online scores
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={saveAll} disabled={busy === "all"}>
            <Save className="h-4 w-4 mr-2" /> {busy === "all" ? "Saving..." : "Save all"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={sendAllRecorded}>
            <Mail className="h-4 w-4 mr-2" /> Send to all recorded
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const percentage = row.percentage ?? pct(row.score, row.max_score);
          return (
            <Card key={row.assignment_id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.application_number} · {row.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.online_score != null && (
                      <Badge variant="secondary">Online: {row.online_score}/{row.online_max_score ?? "-"}</Badge>
                    )}
                    <Badge variant={row.source === "online" ? "secondary" : "outline"}>{row.source}</Badge>
                    {percentage != null && <Badge>{percentage}%</Badge>}
                    {row.result_sent_at && <Badge variant="outline">Result sent</Badge>}
                    {row.resit_sent_at && <Badge variant="outline">Resit sent</Badge>}
                  </div>
                </div>

                {subjects.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {subjects.map((s) => (
                      <div key={s.subject} className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {s.subject} <span className="opacity-60">/ {s.max}</span>
                        </label>
                        <Input
                          type="number"
                          max={s.max}
                          value={(row.subject_scores || []).find((x) => x.subject === s.subject)?.score ?? ""}
                          onChange={(e) => patchSubject(row.assignment_id, s.subject, e.target.value)}
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Total</label>
                      <Input readOnly value={`${row.score ?? 0} / ${row.max_score ?? 0}`} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Score</label>
                      <Input
                        type="number"
                        value={row.score ?? ""}
                        onChange={(e) => patch(row.assignment_id, {
                          score: e.target.value === "" ? null : Number(e.target.value),
                          source: "manual",
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Total mark</label>
                      <Input
                        type="number"
                        value={row.max_score ?? ""}
                        onChange={(e) => patch(row.assignment_id, {
                          max_score: e.target.value === "" ? null : Number(e.target.value),
                        })}
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Outcome</label>
                    <Select
                      value={row.result_status || "pending"}
                      onValueChange={(v) => patch(row.assignment_id, { result_status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="pass">Pass</SelectItem>
                        <SelectItem value="fail">Fail</SelectItem>
                        <SelectItem value="resit">Resit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.resit_date && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Resit scheduled</label>
                      <Input readOnly value={new Date(row.resit_date).toLocaleString()} />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Comment to applicant</label>
                  <Textarea
                    rows={2}
                    value={row.comment ?? ""}
                    placeholder="e.g. Strong performance in Mathematics, needs improvement in English."
                    onChange={(e) => patch(row.assignment_id, { comment: e.target.value })}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={busy === row.assignment_id} onClick={() => save(row)}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button size="sm" disabled={busy === row.assignment_id} onClick={() => sendEmail(row, "result")}>
                    <Mail className="h-4 w-4 mr-2" /> Send result
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === row.assignment_id}
                    onClick={() => openResit(row)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Send resit email
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!resitTarget} onOpenChange={(o) => !o && setResitTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resit details — {resitTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resit date &amp; time</Label>
              <Input type="datetime-local" value={resitDate} onChange={(e) => setResitDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <Input
                value={resitVenue}
                onChange={(e) => setResitVenue(e.target.value)}
                placeholder="iVintage College Campus"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResitTarget(null)}>Cancel</Button>
              <Button onClick={confirmResit}>
                <Mail className="h-4 w-4 mr-2" /> Send resit email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EntranceExamResults;
