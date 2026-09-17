import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { JAMBExamInterface } from '@/components/exam/JAMBExamInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  current_question_index: number;
  time_remaining_seconds: number;
  started_at?: string;
  ended_at?: string;
  exams: {
    id: string;
    title: string;
    description?: string;
    duration_minutes: number;
    total_questions: number;
    pass_mark: number;
  };
}

export const ExamPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (sessionId && user) {
      fetchSession();
    } else {
      navigate('/dashboard');
    }
  }, [sessionId, user]);

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          exams (
            id,
            title,
            description,
            duration_minutes,
            total_questions,
            pass_mark
          )
        `)
        .eq('id', sessionId)
        .eq('student_id', user?.id)
        .single();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: 'Session Not Found',
          description: 'This exam session does not exist or you do not have access to it.',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setSession(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load exam session',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExam = async (answers: Record<string, string>) => {
    if (!session) return;

    try {
      // Update session status
      const { error } = await supabase
        .from('exam_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;

      // Navigate to results page
      navigate(`/exam/results/${session.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to submit exam',
        variant: 'destructive',
      });
    }
  };

  const handleExitExam = () => {
    if (confirm('Are you sure you want to exit the exam? Your progress will be saved.')) {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              This exam session could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Convert session data to exam format for JAMBExamInterface
  const examData = {
    id: session.exams.id,
    title: session.exams.title,
    subject: 'Combined',
    class: 'General',
    duration: session.exams.duration_minutes,
    totalQuestions: session.exams.total_questions,
    questions: [], // Will be loaded by JAMBExamInterface
    randomizeQuestions: true,
    shuffleAnswers: true,
    createdBy: 'teacher',
    createdAt: new Date().toISOString(),
    status: 'published' as const,
  };

  return (
    <div data-exam-active="true">
      <JAMBExamInterface
        exam={examData}
        onSubmit={handleSubmitExam}
        onExit={handleExitExam}
      />
    </div>
  );
};