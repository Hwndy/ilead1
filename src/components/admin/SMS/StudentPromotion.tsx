import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, GraduationCap, RotateCcw, History, Users, AlertTriangle } from "lucide-react";

interface Student {
  id: string;
  admission_number: string;
  profile: {
    full_name: string;
  };
}

interface Class {
  id: string;
  name: string;
}

interface PromotionRecord {
  id: string;
  student_id: string;
  from_class_id: string;
  to_class_id: string;
  academic_year: string;
  promotion_type: string;
  promoted_at: string;
  notes: string;
  student?: {
    admission_number: string;
    profile?: {
      full_name: string;
    };
  };
  from_class?: {
    name: string;
  };
  to_class?: {
    name: string;
  };
}

export const StudentPromotion = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [targetClass, setTargetClass] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [promotionType, setPromotionType] = useState<string>("promoted");
  const [academicYear, setAcademicYear] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);

  useEffect(() => {
      }, []);

  useEffect(() => {
    if (selectedClass && undefined) {
      fetchStudents();
    }
  }, [selectedClass]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      
      .order("name");

    if (!error && data) {
      setClasses(data);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    // Get students in the selected class via class_assignments
    const { data: assignments, error } = await supabase
      .from("class_assignments")
      .select(`
        student_id,
        class_id
      `)
      
      .eq("class_id", selectedClass);
    if (!error && assignments && assignments.length > 0) {
      const studentIds = assignments.map(a => a.student_id);
      
      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          admission_number,
          profile:profiles!students_user_id_fkey(full_name)
        `)
        
        .in("id", studentIds)
        .eq("status", "active");

      setStudents((studentsData as any) || []);
    } else {
      setStudents([]);
    }
    setIsLoading(false);
  };

  const fetchPromotionHistory = async () => {
    const { data, error } = await supabase
      .from("promotion_history")
      .select(`
        *,
        student:students(
          admission_number,
          profile:profiles!students_user_id_fkey(full_name)
        ),
        from_class:classes!promotion_history_from_class_id_fkey(name),
        to_class:classes!promotion_history_to_class_id_fkey(name)
      `)
      
      .order("promoted_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setPromotionHistory(data as any);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(students.map((s) => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    }
  };

  const handlePromotion = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    if (!academicYear) {
      toast.error("Please enter the academic year");
      return;
    }

    if (promotionType !== "graduated" && !targetClass) {
      toast.error("Please select a target class");
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmPromotion = async () => {
    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Create promotion records
      const promotionRecords = selectedStudents.map((studentId) => ({
                student_id: studentId,
        from_class_id: selectedClass,
        to_class_id: promotionType === "graduated" ? null : targetClass,
        academic_year: academicYear,
        promotion_type: promotionType,
        promoted_by: userData.user?.id,
        notes: notes,
      }));

      const { error: promotionError } = await supabase
        .from("promotion_history")
        .insert(promotionRecords);

      if (promotionError) throw promotionError;

      // Update class_assignments if promoted or repeated
      if (promotionType === "promoted" || promotionType === "repeated") {
        // Delete old assignments and create new ones
        await supabase
          .from("class_assignments")
          .delete()
          
          .eq("class_id", selectedClass)
          .in("student_id", selectedStudents);

        const newAssignments = selectedStudents.map(studentId => ({
                    student_id: studentId,
          class_id: targetClass
        }));

        const { error: assignError } = await supabase
          .from("class_assignments")
          .insert(newAssignments);

        if (assignError) throw assignError;
      }

      // Update student status if graduated
      if (promotionType === "graduated") {
        const { error: updateError } = await supabase
          .from("students")
          .update({ status: "graduated" })
          .in("id", selectedStudents);

        if (updateError) throw updateError;
      }

      toast.success(`Successfully ${promotionType} ${selectedStudents.length} student(s)`);
      setSelectedStudents([]);
      setNotes("");
      fetchStudents();
      fetchPromotionHistory();
    } catch (error: any) {
      toast.error(error.message || "Failed to process promotion");
    } finally {
      setIsLoading(false);
    }
  };

  const getPromotionBadge = (type: string) => {
    switch (type) {
      case "promoted":
        return <Badge className="bg-green-500">Promoted</Badge>;
      case "repeated":
        return <Badge variant="secondary">Repeated</Badge>;
      case "graduated":
        return <Badge className="bg-blue-500">Graduated</Badge>;
      case "transferred":
        return <Badge variant="outline">Transferred</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Student Promotion</h2>
      </div>

      <Tabs defaultValue="promote">
        <TabsList>
          <TabsTrigger value="promote" className="flex items-center gap-2">
            Promote Students
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            Promotion History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promote" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Students to Promote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Source Class</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Promotion Type</label>
                  <Select value={promotionType} onValueChange={setPromotionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promoted">Promote to Next Class</SelectItem>
                      <SelectItem value="repeated">Repeat Class</SelectItem>
                      <SelectItem value="graduated">Graduate</SelectItem>
                      <SelectItem value="transferred">Transfer Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {promotionType !== "graduated" && (
                  <div>
                    <label className="text-sm font-medium">Target Class</label>
                    <Select value={targetClass} onValueChange={setTargetClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Academic Year</label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024/2025">2024/2025</SelectItem>
                      <SelectItem value="2025/2026">2025/2026</SelectItem>
                      <SelectItem value="2026/2027">2026/2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedClass && (
                <>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedStudents.length === students.length && students.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Admission No</TableHead>
                          <TableHead>Student Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              No students found in this class
                            </TableCell>
                          </TableRow>
                        ) : (
                          students.map((student) => (
                            <TableRow key={student.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedStudents.includes(student.id)}
                                  onCheckedChange={(checked) =>
                                    handleSelectStudent(student.id, checked as boolean)
                                  }
                                />
                              </TableCell>
                              <TableCell>{student.admission_number}</TableCell>
                              <TableCell>{student.profile?.full_name || "N/A"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedStudents.length} of {students.length} students selected
                    </p>
                    <Button
                      onClick={handlePromotion}
                      disabled={selectedStudents.length === 0 || isLoading}
                    >
                      {promotionType === "graduated" ? (
                        <>
                          <GraduationCap className="h-4 w-4 mr-2" />
                          Graduate Selected
                        </>
                      ) : promotionType === "repeated" ? (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Repeat Selected
                        </>
                      ) : (
                        <>
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Promote Selected
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Promotion History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>From Class</TableHead>
                    <TableHead>To Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No promotion history found
                      </TableCell>
                    </TableRow>
                  ) : (
                    promotionHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.student?.profile?.full_name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.student?.admission_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{record.from_class?.name || "N/A"}</TableCell>
                        <TableCell>{record.to_class?.name || ""}</TableCell>
                        <TableCell>{getPromotionBadge(record.promotion_type)}</TableCell>
                        <TableCell>{record.academic_year}</TableCell>
                        <TableCell>
                          {new Date(record.promoted_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              You are about to {promotionType}{" "}
              <strong>{selectedStudents.length} student(s)</strong>
              {promotionType !== "graduated" && (
                <>
                  {" "}
                  to <strong>{classes.find((c) => c.id === targetClass)?.name}</strong>
                </>
              )}
              .
            </p>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this promotion..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPromotion} disabled={isLoading}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
