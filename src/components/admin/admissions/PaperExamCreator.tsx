import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, FileSpreadsheet } from "lucide-react";

export interface PaperSubject { subject: string; max: number }

interface Props {
  onCreated: () => void;
  trigger?: React.ReactNode;
}

const DEFAULT_SUBJECTS: PaperSubject[] = [
  { subject: "English Language", max: 40 },
  { subject: "Mathematics", max: 40 },
  { subject: "General Paper", max: 20 },
];

export const PaperExamCreator = ({ onCreated, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [subjects, setSubjects] = useState<PaperSubject[]>(DEFAULT_SUBJECTS);

  const total = subjects.reduce((s, r) => s + (Number(r.max) || 0), 0);

  const patch = (i: number, changes: Partial<PaperSubject>) =>
    setSubjects((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...changes } : r)));

  const submit = async () => {
    if (!title.trim()) return toast.error("Enter a title for the exam sitting");
    const clean = subjects
      .map((s) => ({ subject: s.subject.trim(), max: Number(s.max) || 0 }))
      .filter((s) => s.subject);
    if (!clean.length) return toast.error("Add at least one subject");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { error } = await supabase.from("exams").insert({
        title: title.trim(),
        description: "Physical (paper) entrance examination",
        instructions: instructions || null,
        created_by: user.id,
        exam_category: "entrance",
        exam_mode: "paper",
        total_questions: 0,
        duration_minutes: 0,
        status: "published",
        start_date: examDate ? new Date(examDate).toISOString() : null,
        paper_subjects: clean,
      } as any);
      if (error) throw error;

      toast.success("Paper exam sitting created");
      setOpen(false);
      setTitle("");
      setExamDate("");
      setInstructions("");
      setSubjects(DEFAULT_SUBJECTS);
      onCreated();
    } catch (e: any) {
      toast.error("Failed to create: " + (e.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Record Paper Exam
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Paper Exam Sitting</DialogTitle>
          <DialogDescription>
            For entrance exams written physically at the school. No questions needed  you enter
            the marked scores afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026/2027 Entrance Examination (Paper)"
            />
          </div>

          <div className="space-y-2">
            <Label>Exam date &amp; time</Label>
            <Input type="datetime-local" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subjects &amp; maximum marks</Label>
              <span className="text-xs text-muted-foreground">Total: {total}</span>
            </div>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={s.subject}
                    placeholder="Subject"
                    onChange={(e) => patch(i, { subject: e.target.value })}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    value={s.max}
                    onChange={(e) => patch(i, { max: Number(e.target.value) })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSubjects((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubjects((prev) => [...prev, { subject: "", max: 20 }])}
            >
              <Plus className="h-4 w-4 mr-2" /> Add subject
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Venue, invigilators, etc."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Creating..." : "Create sitting"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaperExamCreator;