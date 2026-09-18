import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, FileText, Plus, Loader2, Trophy, Clock, ClipboardCheck, Calculator, Calendar, NotebookPen, Settings } from 'lucide-react';
import { ConsolidatedExamCreator } from '@/components/shared/ConsolidatedExamCreator';
import { TeacherExamBuilder } from '@/components/teacher/TeacherExamBuilder';
import { EnhancedExamResults } from '@/components/teacher/EnhancedExamResults';
import { TeacherStudentCreator } from '@/components/teacher/TeacherStudentCreator';
import { TeacherClassAssignment } from '@/components/admin/TeacherClassAssignment';
import { AttendanceSystem } from '@/components/teacher/AttendanceSystem';
import { TeacherStudentsList } from '@/components/teacher/TeacherStudentsList';
import { TeacherTimetable } from '@/components/teacher/TeacherTimetable';
import { TeacherResultsManagement } from '@/components/teacher/TeacherResultsManagement';
import { AssignmentsManager } from '@/components/teacher/AssignmentsManager';
import { LessonNotesManager } from '@/components/teacher/LessonNotesManager';
import { LeaveRequestForm } from '@/components/teacher/LeaveRequestForm';
import { StaffProfileSettings } from '@/components/teacher/StaffProfileSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TeacherStats {
  totalExams: number;
  questionsBank: number;
  studentSubmissions: number;
  isLoading: boolean;
}

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'exams';
  
  const [stats, setStats] = useState<TeacherStats>({
    totalExams: 0,
    questionsBank: 0,
    studentSubmissions: 0,
    isLoading: true,
  });

  useEffect(() => {
    if (user?.id) {
      fetchTeacherStats();
    }
  }, [user?.id]);

  const fetchTeacherStats = async () => {
    if (!user?.id) return;

    try {
      const examsQuery = supabase.from('exams').select('id', { count: 'exact' }).eq('created_by', user.id);
      const { count: examCount } = await examsQuery;

      const questionsQuery = supabase.from('questions').select('id', { count: 'exact' }).eq('created_by', user.id);
      const { count: questionCount } = await questionsQuery;

      const { data: teacherExams } = await supabase.from('exams').select('id').eq('created_by', user.id);

      let submissionCount = 0;
      if (teacherExams && teacherExams.length > 0) {
        const examIds = teacherExams.map(e => e.id);
        const { count } = await supabase.from('exam_sessions').select('id', { count: 'exact' }).in('exam_id', examIds).eq('status', 'completed');
        submissionCount = count || 0;
      }

      setStats({
        totalExams: examCount || 0,
        questionsBank: questionCount || 0,
        studentSubmissions: submissionCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching teacher stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'exams':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold">My Exams</h2>
              <ConsolidatedExamCreator
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Exam
                  </Button>
                }
                isTeacher={true}
                onExamCreated={fetchTeacherStats}
              />
            </div>
            <TeacherExamBuilder />
          </div>
        );
      case 'students-list': return <TeacherStudentsList />;
      case 'results': return <EnhancedExamResults />;
      case 'timetable': return <TeacherTimetable />;
      case 'attendance': return <AttendanceSystem />;
      case 'results-mgmt': return <TeacherResultsManagement />;
      case 'assignments-mgr': return <AssignmentsManager />;
      case 'lesson-notes': return <LessonNotesManager />;
      case 'leave': return <LeaveRequestForm />;
      case 'profile': return <StaffProfileSettings />;
      case 'students': return <TeacherStudentCreator />;
      case 'assignments': return <TeacherClassAssignment teacherId={user?.id} />;
      default: return <TeacherExamBuilder />;
    }
  };
  
  return (
    <DashboardLayout title="Teacher Dashboard">
      <div className="space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {stats.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.totalExams}</p>}
                  <p className="text-sm text-muted-foreground">Total Exams</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  {stats.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.questionsBank}</p>}
                  <p className="text-sm text-muted-foreground">Questions Bank</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  {stats.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.studentSubmissions}</p>}
                  <p className="text-sm text-muted-foreground">Student Submissions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="bg-card rounded-xl border shadow-sm p-6">
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};
