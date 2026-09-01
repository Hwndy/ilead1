import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Users, Calendar, ClipboardCheck, Pencil } from "lucide-react";
import { ConsolidatedExamCreator } from "@/components/shared/ConsolidatedExamCreator";
import { EntranceExamResults } from "@/components/admin/admissions/EntranceExamResults";
import { PaperExamCreator } from "@/components/admin/admissions/PaperExamCreator";
import { EntranceExamEditor } from "@/components/admin/admissions/EntranceExamEditor";
import { Badge } from "@/components/ui/badge";

interface EntranceExam {
  id: string;
  title: string;
  start_date: string;
  duration_minutes: number;
  status: string;
  total_questions: number;
  exam_mode?: string | null;
  paper_subjects?: { subject: string; max: number }[] | null;
  instructions?: string | null;
}

export const AdmissionExamScheduler = () => {
  const [exams, setExams] = useState<EntranceExam[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [resultsExam, setResultsExam] = useState<EntranceExam | null>(null);
  const [editExam, setEditExam] = useState<EntranceExam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntranceExams();
    fetchEligibleApplicants();
  }, []);

  const fetchEntranceExams = async () => {
    try {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("exam_category", "entrance")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setExams((data || []) as unknown as EntranceExam[]);
    } catch (error: any) {
      toast.error("Failed to load exams: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleApplicants = async () => {
    try {
      const { data, error } = await supabase
        .from("admission_applications")
        .select("id, application_number, first_name, last_name, status")
        .in("status", ["submitted", "under_review"]);

      if (error) throw error;
      setApplicants(data || []);
    } catch (error: any) {
      toast.error("Failed to load applicants: " + error.message);
    }
  };

  const handleAssignToExam = async () => {
    if (!selectedExam || selectedApplicants.length === 0) {
      toast.error("Please select an exam and at least one applicant");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to assign applicants");
        return;
      }

      console.log('Assigning applicants:', {
        exam_id: selectedExam,
        applicants: selectedApplicants,
        assigned_by: user.id
      });

      const assignments = selectedApplicants.map((appId) => ({
        application_id: appId,
        exam_id: selectedExam,
        assigned_by: user.id,
      }));

      const { error: insertError, data: insertData } = await supabase
        .from("admission_exam_assignments")
        .insert(assignments)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Failed to assign applicants: ${insertError.message}`);
      }

      console.log('Assignments created:', insertData);

      // Update application status to interview_scheduled after exam assignment
      const { error: updateError } = await supabase
        .from("admission_applications")
        .update({ status: "interview_scheduled" })
        .in("id", selectedApplicants);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.warning(`Applicants assigned but status update failed: ${updateError.message}`);
      }

      toast.success(`✅ Successfully assigned ${selectedApplicants.length} applicant(s) to exam`);
      setIsAssignOpen(false);
      setSelectedApplicants([]);
      setSelectedExam(null);
      fetchEligibleApplicants();
    } catch (error: any) {
      console.error('Assignment error:', error);
      toast.error(`Failed to assign applicants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleApplicantSelection = (appId: string) => {
    setSelectedApplicants((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading entrance exams...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Entrance Exam Management</h2>
          <p className="text-muted-foreground">Schedule and manage admission entrance exams</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={isAssignOpen}
            onOpenChange={(open) => {
              setIsAssignOpen(open);
              if (open) fetchEntranceExams();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Assign Applicants
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Applicants to Exam</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Exam</Label>
                  {exams.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm space-y-3">
                      <p className="text-muted-foreground">
                        No entrance exams found. Create one first to assign applicants.
                      </p>
                      <ConsolidatedExamCreator
                        defaultCategory="entrance"
                        onExamCreated={fetchEntranceExams}
                        trigger={
                          <Button size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Entrance Exam
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={selectedExam || ""}
                      onChange={(e) => setSelectedExam(e.target.value)}
                    >
                      <option value="">Choose an exam...</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.title}
                          {exam.start_date
                            ? ` - ${new Date(exam.start_date).toLocaleDateString()}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Select Applicants ({selectedApplicants.length} selected)</Label>
                  <div className="max-h-64 overflow-y-auto border rounded-md p-4 space-y-2">
                    {applicants.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No eligible applicants (must be in <em>submitted</em> or <em>under_review</em> status).
                      </p>
                    )}
                    {applicants.map((applicant) => (
                      <div key={applicant.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedApplicants.includes(applicant.id)}
                          onCheckedChange={() => toggleApplicantSelection(applicant.id)}
                        />
                        <label className="text-sm">
                          {applicant.application_number} - {applicant.first_name} {applicant.last_name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAssignToExam}>Assign</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <ConsolidatedExamCreator
            defaultCategory="entrance"
            onExamCreated={fetchEntranceExams}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create CBT Exam
              </Button>
            }
          />
          <PaperExamCreator onCreated={fetchEntranceExams} />
        </div>
      </div>

      {exams.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No entrance exams yet. Click <strong>Create Entrance Exam</strong> to schedule one,
            then use <strong>Assign Applicants</strong> to add candidates.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <Card key={exam.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-start justify-between gap-2">
                <span>{exam.title}</span>
                <Badge variant={exam.exam_mode === "paper" ? "secondary" : "outline"}>
                  {exam.exam_mode === "paper" ? "Paper" : "CBT"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{exam.start_date ? new Date(exam.start_date).toLocaleString() : "Date not set"}</span>
              </div>
              {exam.exam_mode === "paper" ? (
                <div className="text-sm text-muted-foreground">
                  Subjects: {(exam.paper_subjects || []).map((s) => s.subject).join(", ") || "None"}
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Duration: {exam.duration_minutes} minutes
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Questions: {exam.total_questions}
                  </div>
                </>
              )}
              <Button
                size="sm"
                className="w-full mt-4"
                variant="secondary"
                onClick={() => setEditExam(exam)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Exam
              </Button>
              <Button
                size="sm"
                className="w-full"
                variant="outline"
                onClick={() => {
                  setSelectedExam(exam.id);
                  setIsAssignOpen(true);
                }}
              >
                Assign Applicants
              </Button>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setResultsExam(exam)}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Results & Emails
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!resultsExam} onOpenChange={(open) => !open && setResultsExam(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{resultsExam?.title}  Results</DialogTitle>
          </DialogHeader>
          {resultsExam && (
            <EntranceExamResults
              examId={resultsExam.id}
              examTitle={resultsExam.title}
              examMode={resultsExam.exam_mode}
              paperSubjects={resultsExam.paper_subjects}
            />
          )}
        </DialogContent>
      </Dialog>

      <EntranceExamEditor
        exam={editExam}
        open={!!editExam}
        onOpenChange={(open) => !open && setEditExam(null)}
        onSaved={fetchEntranceExams}
      />
    </div>
  );
};
