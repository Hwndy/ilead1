import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Loader2, Printer, Eye, Save, MessageSquare, Send } from 'lucide-react';
import { TagExamsDialog } from '@/components/admin/TagExamsDialog';
import { fetchSchoolBranding } from '@/lib/school-branding';
import { generateReportCardHTML, renderReportCardBody, wrapReportCardDocument, openReportCardPrintWindow } from '@/lib/report-card-html';

interface ClassData {
  id: string;
  name: string;
}

interface SubjectData {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  user_id: string;
  registration_number?: string;
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  section?: string;
  photo_url?: string | null;
}

interface GradeEntry {
  student_id: string;
  subject_id: string;
  subject_name: string;
  test1_score: number;
  test2_score: number;
  exam_score: number;
  total: number;
  grade: string;
  subject_position: number;
  class_average: number;
  highest_in_class: number;
  lowest_in_class: number;
  remark: string;
}

interface AttendanceData {
  days_school_opened: number;
  days_present: number;
  days_absent: number;
}

interface CommentsData {
  class_teacher_comment: string;
  head_teacher_comment: string;
  principal_comment: string;
}

interface StudentReportCard {
  student_id: string;
  student_name: string;
  registration_number: string;
  class_name: string;
  section: string;
  term: string;
  academic_year: string;
  age: number | null;
  gender: string;
  weight: number | null;
  height: number | null;
  photo_url: string | null;
  grades: GradeEntry[];
  total_obtained: number;
  total_max: number;
  average: number;
  position: number;
  total_students: number;
  overall_grade: string;
  attendance: AttendanceData;
  comments: CommentsData;
  class_average: number;
  highest_average: number;
  lowest_average: number;
}

interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  motto: string;
  logo_url: string;
  principal_name?: string;
}

interface AutomationSettings {
  min_promotion_average: number;
  below_max: number;
  average_max: number;
  above_max: number;
  principal_remark_below: string;
  principal_remark_average: string;
  principal_remark_above: string;
  principal_remark_distinction: string;
  show_parent_signature: boolean;
}

const DEFAULT_AUTOMATION: AutomationSettings = {
  min_promotion_average: 40,
  below_max: 39,
  average_max: 59,
  above_max: 74,
  principal_remark_below: 'Below Average. Needs to work much harder next term.',
  principal_remark_average: 'A bit above average. Keep pushing to improve.',
  principal_remark_above: 'Far above average. Well done, keep it up.',
  principal_remark_distinction: 'Distinction. Excellent performance!',
  show_parent_signature: false,
};

// iVintage A-F Grading Scale
const GRADING_SCALE = [
  { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
  { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59, grade: 'C', remark: 'Good' },
  { min: 40, max: 49, grade: 'D', remark: 'Pass' },
  { min: 30, max: 39, grade: 'E', remark: 'Poor' },
  { min: 0, max: 29, grade: 'F', remark: 'Fail' },
];

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const TERM_VALUES: Record<string, 'first' | 'second' | 'third'> = {
  'First Term': 'first',
  'Second Term': 'second',
  'Third Term': 'third',
};

interface AcademicSession {
  id: string;
  session_name: string;
  academic_year: string;
  is_current: boolean;
}

export const ReportCardGenerator: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [reportCards, setReportCards] = useState<StudentReportCard[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [automation, setAutomation] = useState<AutomationSettings>(DEFAULT_AUTOMATION);
  const [publishedKeys, setPublishedKeys] = useState<Set<string>>(new Set());

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('First Term');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewingCard, setPreviewingCard] = useState<StudentReportCard | null>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [editingComments, setEditingComments] = useState<{
    studentId: string;
    comments: CommentsData;
  } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSessionId) {
      fetchStudentsAndGrades();
    }
  }, [selectedClass, selectedTerm, selectedSessionId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [classesRes, subjectsRes, sessionsRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('subjects').select('id, name').order('name'),
          supabase
            .from('admission_sessions')
            .select('id, session_name, academic_year, is_current')
            .order('start_date', { ascending: false })
        ,
      ]);

      // Load automation settings (per school)
      
      setClasses(classesRes.data || []);
      setSubjects(subjectsRes.data || []);
      const branding = await fetchSchoolBranding();
      setSchoolInfo(branding);
      const sessionList = (sessionsRes.data || []) as AcademicSession[];
      setSessions(sessionList);
      const current = sessionList.find(s => s.is_current) || sessionList[0];
      if (current) setSelectedSessionId(current.id);

      if (classesRes.data && classesRes.data.length > 0) {
        setSelectedClass(classesRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentsAndGrades = async () => {
    if (!selectedClass || !selectedSessionId) return;

    try {
      // Fetch students in the class
      const { data: classAssignments } = await supabase
        .from('class_assignments')
        .select('student_id')
        .eq('class_id', selectedClass);

      const studentUserIds = classAssignments?.map(ca => ca.student_id) || [];
      
      if (studentUserIds.length === 0) {
        setStudents([]);
        setReportCards([]);
        return;
      }

      // Fetch student profiles and student records
      const [profilesRes, studentsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', studentUserIds),
        supabase.from('students').select('id, user_id, registration_number, age, gender, weight, height, section, photo_url').in('user_id', studentUserIds),
      ]);

      const profiles = profilesRes.data || [];
      const studentsData = studentsRes.data || [];

      const studentsList: StudentData[] = profiles.map(p => {
        const studentRecord = studentsData.find(s => s.user_id === p.user_id);
        return {
          id: studentRecord?.id || p.user_id,
          full_name: p.full_name,
          user_id: p.user_id,
          registration_number: studentRecord?.registration_number,
          age: studentRecord?.age,
          gender: studentRecord?.gender,
          weight: studentRecord?.weight,
          height: studentRecord?.height,
          section: studentRecord?.section,
          photo_url: (studentRecord as any)?.photo_url ?? null,
        };
      });

      setStudents(studentsList);

      // Fetch unified term scores from the view (online exams + manual gradebook)
      const studentIds = studentsData.map(s => s.id);
      if (studentIds.length === 0) {
        setReportCards([]);
        return;
      }

      const termValue = TERM_VALUES[selectedTerm];
      const academicYearText =
        sessions.find(s => s.id === selectedSessionId)?.academic_year || '';

      const [scoresRes, subjectsMapRes, commentsRes, attendanceRes] = await Promise.all([
        supabase
          .from('v_student_term_scores')
          .select('*')
          .in('student_id', studentIds)
          .eq('class_id', selectedClass)
          .eq('session_id', selectedSessionId)
          .eq('term', termValue),
        supabase.from('subjects').select('id, name'),
        supabase
          .from('report_card_comments')
          .select('*')
          .in('student_id', studentIds)
          .eq('class_id', selectedClass)
          .eq('term', selectedTerm)
          .eq('academic_year', academicYearText),
        supabase
          .from('attendance_summary')
          .select('*')
          .in('student_id', studentIds)
          .eq('class_id', selectedClass)
          .eq('term', selectedTerm)
          .eq('academic_year', academicYearText),
      ]);

      const rawScores = scoresRes.data || [];
      const subjectsMap = new Map(
        (subjectsMapRes.data || []).map((s: any) => [s.id, s.name])
      );
      // Re-shape view rows into the same shape generateReportCards expects.
      const grades = rawScores.map((r: any) => ({
        student_id: r.student_id,
        subject_id: r.subject_id,
        class_id: r.class_id,
        test1_score: Number(r.test1) || 0,
        test2_score: Number(r.test2) || 0,
        exam_score: Number(r.exam_score) || 0,
        subjects: { name: subjectsMap.get(r.subject_id) || 'Unknown' },
      }));
      const comments = commentsRes.data || [];
      const attendance = attendanceRes.data || [];

      // Process grades into report cards
      const className = classes.find(c => c.id === selectedClass)?.name || '';
      const processedCards = generateReportCards(studentsList, grades, comments, attendance, className);
      setReportCards(processedCards);

      // Load which of these are already published
      const { data: pubs } = await supabase
        .from('report_card_publications')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('class_id', selectedClass)
        .eq('session_id', selectedSessionId)
        .eq('term', selectedTerm);
      setPublishedKeys(new Set((pubs || []).map((p: any) => p.student_id)));
    } catch (error) {
      console.error('Error fetching students and grades:', error);
      toast({ title: 'Error', description: 'Failed to load report card data', variant: 'destructive' });
    }
  };

  const getGrade = (percentage: number): { grade: string; remark: string } => {
    const scale = GRADING_SCALE.find(s => percentage >= s.min && percentage <= s.max);
    return scale || { grade: 'F', remark: 'Fail' };
  };

  const generateReportCards = (
    studentsList: StudentData[], 
    grades: any[],
    comments: any[],
    attendance: any[],
    className: string
  ): StudentReportCard[] => {
    // Group grades by subject to calculate class statistics
    const subjectStats: Record<string, { scores: number[]; highest: number; lowest: number; average: number }> = {};
    
    grades.forEach(g => {
      const total = (g.test1_score || 0) + (g.test2_score || 0) + (g.exam_score || 0);
      if (!subjectStats[g.subject_id]) {
        subjectStats[g.subject_id] = { scores: [], highest: 0, lowest: 100, average: 0 };
      }
      subjectStats[g.subject_id].scores.push(total);
    });

    // Calculate statistics for each subject
    Object.keys(subjectStats).forEach(subjectId => {
      const stats = subjectStats[subjectId];
      stats.highest = Math.max(...stats.scores);
      stats.lowest = Math.min(...stats.scores);
      stats.average = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
    });

    // Calculate student averages for positioning
    const studentAverages: { id: string; average: number }[] = [];
    
    studentsList.forEach(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      if (studentGrades.length === 0) {
        studentAverages.push({ id: student.id, average: 0 });
        return;
      }

      const totalObtained = studentGrades.reduce((sum, g) => 
        sum + (g.test1_score || 0) + (g.test2_score || 0) + (g.exam_score || 0), 0);
      const maxPossible = studentGrades.length * 100;
      const average = maxPossible > 0 ? (totalObtained / maxPossible) * 100 : 0;
      studentAverages.push({ id: student.id, average });
    });

    // Sort by average for positions
    studentAverages.sort((a, b) => b.average - a.average);
    const positionMap = new Map(studentAverages.map((s, i) => [s.id, i + 1]));

    // Calculate class-wide statistics
    const allAverages = studentAverages.map(s => s.average);
    const classAverage = allAverages.length > 0 ? allAverages.reduce((a, b) => a + b, 0) / allAverages.length : 0;
    const highestAverage = allAverages.length > 0 ? Math.max(...allAverages) : 0;
    const lowestAverage = allAverages.length > 0 ? Math.min(...allAverages) : 0;

    // Generate report cards
    const cards: StudentReportCard[] = studentsList.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      const studentComments = comments.find(c => c.student_id === student.id);
      const studentAttendance = attendance.find(a => a.student_id === student.id);
      
      // Calculate subject positions
      const gradeEntries: GradeEntry[] = studentGrades.map(g => {
        const total = (g.test1_score || 0) + (g.test2_score || 0) + (g.exam_score || 0);
        const stats = subjectStats[g.subject_id];
        
        // Calculate position in subject
        const subjectScores = stats?.scores.sort((a, b) => b - a) || [];
        const subjectPosition = subjectScores.indexOf(total) + 1;

        const { grade, remark } = getGrade(total);

        return {
          student_id: student.id,
          subject_id: g.subject_id,
          subject_name: g.subjects?.name || 'Unknown',
          test1_score: g.test1_score || 0,
          test2_score: g.test2_score || 0,
          exam_score: g.exam_score || 0,
          total,
          grade,
          subject_position: subjectPosition || 1,
          class_average: Math.round((stats?.average || 0) * 10) / 10,
          highest_in_class: stats?.highest || 0,
          lowest_in_class: stats?.lowest || 0,
          remark,
        };
      });

      const totalObtained = gradeEntries.reduce((sum, g) => sum + g.total, 0);
      const totalMax = gradeEntries.length * 100;
      const average = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const { grade: overallGrade } = getGrade(average);

      return {
        student_id: student.id,
        student_name: student.full_name,
        registration_number: student.registration_number || 'N/A',
        class_name: className,
        section: student.section || '',
        term: selectedTerm,
        academic_year:
          sessions.find(s => s.id === selectedSessionId)?.academic_year || '',
        age: student.age || null,
        gender: student.gender || 'N/A',
        weight: student.weight || null,
        height: student.height || null,
        photo_url: student.photo_url || null,
        grades: gradeEntries,
        total_obtained: totalObtained,
        total_max: totalMax,
        average: Math.round(average * 10) / 10,
        position: positionMap.get(student.id) || studentsList.length,
        total_students: studentsList.length,
        overall_grade: overallGrade,
        attendance: {
          days_school_opened: studentAttendance?.days_school_opened || 0,
          days_present: studentAttendance?.days_present || 0,
          days_absent: studentAttendance?.days_absent || 0,
        },
        comments: {
          class_teacher_comment: studentComments?.class_teacher_comment || '',
          head_teacher_comment: studentComments?.head_teacher_comment || '',
          principal_comment: studentComments?.principal_comment || '',
        },
        class_average: Math.round(classAverage * 10) / 10,
        highest_average: Math.round(highestAverage * 10) / 10,
        lowest_average: Math.round(lowestAverage * 10) / 10,
      };
    });

    return cards.sort((a, b) => a.position - b.position);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(reportCards.map(r => r.student_id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handlePreview = (card: StudentReportCard) => {
    setPreviewingCard(card);
    setPreviewOpen(true);
  };

  const handlePublish = async (card: StudentReportCard) => {
        try {
      const { error } = await supabase
        .from('report_card_publications')
        .upsert({
                    student_id: card.student_id,
          class_id: selectedClass,
          session_id: selectedSessionId,
          term: selectedTerm,
          published_by: user?.id,
        }, { onConflict: 'student_id,class_id,session_id,term' });
      if (error) throw error;
      setPublishedKeys(prev => new Set(prev).add(card.student_id));
      toast({ title: 'Published', description: `${card.student_name}'s report card is now visible to parents.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditComments = (card: StudentReportCard) => {
    setEditingComments({
      studentId: card.student_id,
      comments: { ...card.comments },
    });
    setCommentsDialogOpen(true);
  };

  const handleSaveComments = async () => {
    if (!editingComments) return;

    try {
      const student = students.find(s => s.id === editingComments.studentId);
      if (!student) return;

      const { error } = await supabase
        .from('report_card_comments')
        .upsert({
                    student_id: editingComments.studentId,
          class_id: selectedClass,
          term: selectedTerm,
          academic_year:
            sessions.find(s => s.id === selectedSessionId)?.academic_year || '',
          ...editingComments.comments,
        }, {
          onConflict: 'student_id,class_id,term,academic_year',
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'Comments saved successfully' });
      setCommentsDialogOpen(false);
      fetchStudentsAndGrades();
    } catch (error: any) {
      console.error('Error saving comments:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const brandingForPrint = () => ({
    name: schoolInfo?.name || 'iVintage College',
    address: schoolInfo?.address || '',
    phone: schoolInfo?.phone || '',
    email: schoolInfo?.email || '',
    motto: schoolInfo?.motto || '',
    logo_url: schoolInfo?.logo_url || '/ivintage_logo.png',
    principal_name: schoolInfo?.principal_name || '',
  });

  const handlePrintReportCard = (card: StudentReportCard) => {
    openReportCardPrintWindow(generatePrintableHTML(card));
  };

  const generatePrintableHTML = (card: StudentReportCard): string =>
    generateReportCardHTML(card as any, brandingForPrint(), automation);

  const handleBulkPrint = () => {
    const selectedCards = reportCards.filter(r => selectedStudents.has(r.student_id));
    if (selectedCards.length === 0) {
      toast({ title: 'No Selection', description: 'Please select students to print', variant: 'destructive' });
      return;
    }
    const body = selectedCards
      .map(card => renderReportCardBody(card as any, brandingForPrint(), automation))
      .join('');
    openReportCardPrintWindow(wrapReportCardDocument(body, 'Report Cards'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Report Card Generator</h2>
          <p className="text-muted-foreground">Generate iVintage format report cards with TEST 1, TEST 2 & EXAM scores</p>
        </div>
      </div>

      <div className="space-y-6">
          {/* Filters */}
          <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Class & Term</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.session_name}{s.is_current ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={handleBulkPrint}
          disabled={selectedStudents.size === 0}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Selected ({selectedStudents.size})
        </Button>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {reportCards.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedStudents.size === reportCards.length && reportCards.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Reg. No</TableHead>
                  <TableHead className="text-center">Subjects</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Average</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCards.map((card) => (
                  <TableRow key={card.student_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStudents.has(card.student_id)}
                        onCheckedChange={(checked) => handleSelectStudent(card.student_id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={card.position <= 3 ? 'default' : 'secondary'}>
                        {card.position}/{card.total_students}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{card.student_name}</TableCell>
                    <TableCell className="text-muted-foreground">{card.registration_number}</TableCell>
                    <TableCell className="text-center">{card.grades.length}</TableCell>
                    <TableCell className="text-center">{card.total_obtained}/{card.total_max}</TableCell>
                    <TableCell className="text-center font-medium">{card.average}%</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={card.average >= 50 ? 'default' : 'destructive'}>
                        {card.overall_grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEditComments(card)} title="Add Comments">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handlePreview(card)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handlePrintReportCard(card)} title="Print">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={publishedKeys.has(card.student_id) ? 'default' : 'ghost'}
                          onClick={() => handlePublish(card)}
                          title={publishedKeys.has(card.student_id) ? 'Published to parent' : 'Publish to parent'}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-foreground">No scores yet for this class, session and term.</p>
              <p className="text-sm mt-2 max-w-md mx-auto">
                Scores come from two places: online exams tagged as <strong>Test 1 / Test 2 / Exam</strong>
                under this session and term, or manual entries in the Gradebook.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <TagExamsDialog />
              </div>
              <p className="text-xs mt-3">
                Tip: most schools already have completed online exams — tag them above to start populating report cards immediately.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Report Card Preview - {previewingCard?.student_name}</DialogTitle>
          </DialogHeader>
          {previewingCard && (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted rounded-lg text-sm">
                <div><span className="text-muted-foreground">Name:</span> <strong>{previewingCard.student_name}</strong></div>
                <div><span className="text-muted-foreground">Reg. No:</span> <strong>{previewingCard.registration_number}</strong></div>
                <div><span className="text-muted-foreground">Class:</span> <strong>{previewingCard.class_name}</strong></div>
                <div><span className="text-muted-foreground">Term:</span> <strong>{previewingCard.term}</strong></div>
                <div><span className="text-muted-foreground">Position:</span> <strong>{previewingCard.position}/{previewingCard.total_students}</strong></div>
                <div><span className="text-muted-foreground">Average:</span> <strong>{previewingCard.average}%</strong></div>
                <div><span className="text-muted-foreground">Grade:</span> <Badge>{previewingCard.overall_grade}</Badge></div>
                <div><span className="text-muted-foreground">Session:</span> <strong>{previewingCard.academic_year}</strong></div>
              </div>

              {/* Grades Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-center">Test 1 (20)</TableHead>
                      <TableHead className="text-center">Test 2 (20)</TableHead>
                      <TableHead className="text-center">Exam (60)</TableHead>
                      <TableHead className="text-center">Total (100)</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Pos.</TableHead>
                      <TableHead className="text-center">Class Avg</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewingCard.grades.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{g.subject_name}</TableCell>
                        <TableCell className="text-center">{g.test1_score}</TableCell>
                        <TableCell className="text-center">{g.test2_score}</TableCell>
                        <TableCell className="text-center">{g.exam_score}</TableCell>
                        <TableCell className="text-center font-bold">{g.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={g.total >= 50 ? 'default' : 'destructive'}>{g.grade}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{g.subject_position}</TableCell>
                        <TableCell className="text-center">{g.class_average}</TableCell>
                        <TableCell>{g.remark}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Attendance */}
              <div className="p-4 bg-muted rounded-lg">
                <strong className="block mb-2">Attendance:</strong>
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>Days Opened: <strong>{previewingCard.attendance.days_school_opened}</strong></span>
                  <span>Days Present: <strong>{previewingCard.attendance.days_present}</strong></span>
                  <span>Days Absent: <strong>{previewingCard.attendance.days_absent}</strong></span>
                </div>
              </div>

              {/* Comments */}
              {(previewingCard.comments.class_teacher_comment || previewingCard.comments.head_teacher_comment || previewingCard.comments.principal_comment) && (
                <div className="space-y-2">
                  {previewingCard.comments.class_teacher_comment && (
                    <div className="p-3 border rounded-lg">
                      <strong className="text-sm text-muted-foreground">Class Teacher:</strong>
                      <p>{previewingCard.comments.class_teacher_comment}</p>
                    </div>
                  )}
                  {previewingCard.comments.head_teacher_comment && (
                    <div className="p-3 border rounded-lg">
                      <strong className="text-sm text-muted-foreground">Head Teacher:</strong>
                      <p>{previewingCard.comments.head_teacher_comment}</p>
                    </div>
                  )}
                  {previewingCard.comments.principal_comment && (
                    <div className="p-3 border rounded-lg">
                      <strong className="text-sm text-muted-foreground">Principal:</strong>
                      <p>{previewingCard.comments.principal_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={() => previewingCard && handlePrintReportCard(previewingCard)}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Report Card Comments</DialogTitle>
          </DialogHeader>
          {editingComments && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Class Teacher's Remarks</Label>
                <Textarea
                  value={editingComments.comments.class_teacher_comment}
                  onChange={(e) => setEditingComments({
                    ...editingComments,
                    comments: { ...editingComments.comments, class_teacher_comment: e.target.value }
                  })}
                  placeholder="Enter class teacher's remarks..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Head Teacher's Remarks</Label>
                <Textarea
                  value={editingComments.comments.head_teacher_comment}
                  onChange={(e) => setEditingComments({
                    ...editingComments,
                    comments: { ...editingComments.comments, head_teacher_comment: e.target.value }
                  })}
                  placeholder="Enter head teacher's remarks..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Principal's Remarks</Label>
                <Textarea
                  value={editingComments.comments.principal_comment}
                  onChange={(e) => setEditingComments({
                    ...editingComments,
                    comments: { ...editingComments.comments, principal_comment: e.target.value }
                  })}
                  placeholder="Enter principal's remarks..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveComments}>
              <Save className="h-4 w-4 mr-2" />
              Save Comments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
