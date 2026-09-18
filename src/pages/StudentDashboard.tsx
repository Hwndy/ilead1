import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Trophy, Clock, TrendingUp, Calendar, Library, FileText, NotebookPen } from 'lucide-react';
import { ExamList } from '@/components/student/ExamList';
import { StudentTimetable } from '@/components/student/StudentTimetable';
import { LibraryCatalog } from '@/components/student/LibraryCatalog';
import { StudentReportCards } from '@/components/student/StudentReportCards';
import { StudentAssignments } from '@/components/student/StudentAssignments';
import { StudentLessonNotes } from '@/components/student/StudentLessonNotes';
import { ProfileCompletionPrompt } from '@/components/student/ProfileCompletionPrompt';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'exams';

  const [stats, setStats] = useState({
    availableExams: 0,
    completedExams: 0,
    averageScore: 0,
    totalStudyTime: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const { data: classAssignments } = await supabase.from('class_assignments').select('class_id').eq('student_id', user.id);
        const classIds = classAssignments?.map(ca => ca.class_id) || [];
        let availableQuery = supabase.from('exams').select('id, start_date, end_date').eq('status', 'published');
        if (classIds.length > 0) {
          availableQuery = availableQuery.or(`class_id.is.null,class_id.in.(${classIds.join(',')})`);
        } else {
          availableQuery = availableQuery.is('class_id', null);
        }
        const { data: availableExams } = await availableQuery;
        const currentTime = new Date();
        const activeExams = availableExams?.filter(exam => {
          const startDate = exam.start_date ? new Date(exam.start_date) : null;
          const endDate = exam.end_date ? new Date(exam.end_date) : null;
          return (!endDate || currentTime <= endDate) && (!startDate || currentTime >= startDate);
        }) || [];
        const { data: completedSessions } = await supabase.from('exam_sessions').select('total_score, max_score, percentage, started_at, ended_at').eq('student_id', user.id).eq('status', 'completed');
        const completedCount = completedSessions?.length || 0;
        const validSessions = completedSessions?.filter(s => s.percentage !== null) || [];
        const averageScore = validSessions.length > 0 ? Math.round(validSessions.reduce((sum, session) => sum + (session.percentage || 0), 0) / validSessions.length) : 0;
        const totalStudyTime = completedSessions?.reduce((total, session) => {
          if (session.started_at && session.ended_at) {
            return total + Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60));
          }
          return total;
        }, 0) || 0;
        setStats({ availableExams: activeExams.length, completedExams: completedCount, averageScore, totalStudyTime });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, [user]);

  const renderContent = () => {
    switch (activeTab) {
      case 'exams': return <ExamList />;
      case 'timetable': return <StudentTimetable />;
      case 'library': return <LibraryCatalog />;
      case 'assignments': return <StudentAssignments />;
      case 'notes': return <StudentLessonNotes />;
      case 'report-cards': return <StudentReportCards />;
      default: return <ExamList />;
    }
  };

  return (
    <DashboardLayout title="Student Dashboard">
      <div className="space-y-8">
        <ProfileCompletionPrompt />
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.availableExams}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-success shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                  <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.completedExams}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.averageScore}%</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg. Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-accent shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-1.5 sm:p-2 bg-accent/10 rounded-lg flex-shrink-0">
                  <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalStudyTime} min</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Study Time</p>
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
