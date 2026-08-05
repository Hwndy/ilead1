-- ============================================================
-- iVintage College Portal - full database setup
-- Generated from supabase/migrations (schema + reference data).
-- Run this ONCE in the SQL editor of your new Supabase project.
-- Legacy rows tied to the old project's auth users were excluded.
-- ============================================================


-- ===== 20250910205214_6c532866-3bbd-4f0c-9b2c-1c5ce54b0152.sql =====

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class_assignments table (students assigned to classes)
CREATE TABLE public.class_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

-- Create subject_assignments table (teachers/students assigned to subjects)
CREATE TABLE public.subject_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_id, class_id)
);

-- Create app_settings table for admin configuration
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_current_user_role() = 'admin';
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create function to check if user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT public.get_current_user_role() IN ('admin', 'teacher');
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE USING (public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE USING (public.is_admin());

-- Classes policies
CREATE POLICY "Authenticated users can view classes" ON public.classes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage classes" ON public.classes
FOR ALL USING (public.is_admin());

-- Subjects policies
CREATE POLICY "Authenticated users can view subjects" ON public.subjects
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
FOR ALL USING (public.is_admin());

-- Class assignments policies
CREATE POLICY "Users can view their class assignments" ON public.class_assignments
FOR SELECT USING (auth.uid() = student_id OR public.is_teacher());

CREATE POLICY "Admins can manage class assignments" ON public.class_assignments
FOR ALL USING (public.is_admin());

-- Subject assignments policies
CREATE POLICY "Users can view their subject assignments" ON public.subject_assignments
FOR SELECT USING (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "Admins and teachers can manage subject assignments" ON public.subject_assignments
FOR ALL USING (public.is_teacher());

-- App settings policies
CREATE POLICY "Admins can manage app settings" ON public.app_settings
FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated users can view app settings" ON public.app_settings
FOR SELECT TO authenticated USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default app settings
INSERT INTO public.app_settings (setting_key, setting_value) VALUES
('allow_student_registration', 'true'),
('school_name', '"ALBARI Secondary School"'),
('academic_year', '"2024/2025"');

-- Insert some default classes
INSERT INTO public.classes (name, description) VALUES
('JSS 1', 'Junior Secondary School 1'),
('JSS 2', 'Junior Secondary School 2'), 
('JSS 3', 'Junior Secondary School 3'),
('SSS 1', 'Senior Secondary School 1'),
('SSS 2', 'Senior Secondary School 2'),
('SSS 3', 'Senior Secondary School 3');

-- Insert some default subjects
INSERT INTO public.subjects (name, description) VALUES
('Mathematics', 'Mathematics and Numerical Skills'),
('English Language', 'English Language and Communication'),
('Basic Science', 'Integrated Science and Technology'),
('Social Studies', 'Social Studies and Civic Education'),
('Computer Studies', 'Computer Studies and ICT'),
('Business Studies', 'Business Studies and Economics'),
('French', 'French Language'),
('Physical and Health Education', 'Physical and Health Education'),
('Creative Arts', 'Creative Arts and Cultural Studies'),
('Agricultural Science', 'Agricultural Science');


-- ===== 20250915173549_0949558b-d49b-4d18-830a-ab326539cf95.sql =====

-- CBT System Database Migration
-- Create comprehensive structure for Computer Based Testing

-- Create question types enum
CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'fill_blank');

-- Create difficulty levels enum  
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Create exam status enum
CREATE TYPE exam_status AS ENUM ('draft', 'published', 'archived');

-- Create session status enum
CREATE TYPE session_status AS ENUM ('not_started', 'in_progress', 'completed', 'expired');

-- Question Banks table
CREATE TABLE public.question_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL, -- references auth.users(id)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Questions table  
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_bank_id UUID REFERENCES public.question_banks(id) ON DELETE CASCADE,
  question_type question_type NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  explanation TEXT, -- explanation for correct answer
  difficulty_level difficulty_level NOT NULL DEFAULT 'medium',
  points INTEGER NOT NULL DEFAULT 1,
  has_media BOOLEAN NOT NULL DEFAULT false,
  media_url TEXT, -- for images, audio files
  formula_latex TEXT, -- for mathematical formulas
  created_by UUID NOT NULL, -- references auth.users(id)  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Question Options table (for MCQ and True/False)
CREATE TABLE public.question_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  option_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exams table
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL, -- references auth.users(id)
  
  -- Exam settings
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_questions INTEGER NOT NULL DEFAULT 20,
  pass_mark INTEGER NOT NULL DEFAULT 50, -- percentage
  
  -- Question behavior
  randomize_questions BOOLEAN NOT NULL DEFAULT true,
  shuffle_answers BOOLEAN NOT NULL DEFAULT true,
  allow_review BOOLEAN NOT NULL DEFAULT true, -- can student review answers before submit
  show_results_immediately BOOLEAN NOT NULL DEFAULT false,
  
  -- Navigation settings  
  sequential_navigation BOOLEAN NOT NULL DEFAULT false, -- lock previous questions
  allow_question_flagging BOOLEAN NOT NULL DEFAULT true,
  
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Status and metadata
  status exam_status NOT NULL DEFAULT 'draft',
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exam Questions table (links exams to questions with specific order/points)
CREATE TABLE public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure no duplicate questions per exam
  UNIQUE(exam_id, question_id)
);

-- Student Exam Sessions table
CREATE TABLE public.exam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL, -- references auth.users(id)
  
  -- Session timing
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  time_remaining_seconds INTEGER, -- for paused sessions
  
  -- Session state
  status session_status NOT NULL DEFAULT 'not_started',
  current_question_index INTEGER DEFAULT 0,
  
  -- Results (calculated when session completes)
  total_score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0, 
  percentage DECIMAL(5,2) DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One active session per student per exam
  UNIQUE(exam_id, student_id)
);

-- Question Responses table (student answers)
CREATE TABLE public.question_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  
  -- Answer data
  selected_option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL,
  text_answer TEXT, -- for fill in the blank
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  
  -- Metadata
  is_flagged BOOLEAN DEFAULT false,
  time_spent_seconds INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one response per question per session
  UNIQUE(session_id, question_id)
);

-- Enable RLS on all tables
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Question Banks
CREATE POLICY "Teachers can manage question banks" ON public.question_banks
  FOR ALL USING (is_teacher());

CREATE POLICY "Students can view published question banks" ON public.question_banks  
  FOR SELECT USING (true);

-- Create RLS policies for Questions
CREATE POLICY "Teachers can manage questions" ON public.questions
  FOR ALL USING (is_teacher());

CREATE POLICY "Students can view questions during exams" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exam_questions eq ON eq.exam_id = es.exam_id
      WHERE eq.question_id = questions.id 
      AND es.student_id = auth.uid()
      AND es.status = 'in_progress'
    )
  );

-- Create RLS policies for Question Options  
CREATE POLICY "Teachers can manage question options" ON public.question_options
  FOR ALL USING (is_teacher());

CREATE POLICY "Students can view options during exams" ON public.question_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exam_questions eq ON eq.exam_id = es.exam_id
      WHERE eq.question_id = question_options.question_id
      AND es.student_id = auth.uid()  
      AND es.status = 'in_progress'
    )
  );

-- Create RLS policies for Exams
CREATE POLICY "Teachers can manage exams" ON public.exams
  FOR ALL USING (is_teacher());

CREATE POLICY "Students can view published exams for their class" ON public.exams
  FOR SELECT USING (
    status = 'published' 
    AND (
      class_id IS NULL OR 
      EXISTS (
        SELECT 1 FROM public.class_assignments ca 
        WHERE ca.class_id = exams.class_id 
        AND ca.student_id = auth.uid()
      )
    )
  );

-- Create RLS policies for Exam Questions
CREATE POLICY "Teachers can manage exam questions" ON public.exam_questions
  FOR ALL USING (is_teacher());

CREATE POLICY "Students can view exam questions during session" ON public.exam_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      WHERE es.exam_id = exam_questions.exam_id
      AND es.student_id = auth.uid()
      AND es.status IN ('in_progress', 'completed')
    )
  );

-- Create RLS policies for Exam Sessions  
CREATE POLICY "Students can manage their own sessions" ON public.exam_sessions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view all sessions" ON public.exam_sessions
  FOR SELECT USING (is_teacher());

-- Create RLS policies for Question Responses
CREATE POLICY "Students can manage their own responses" ON public.question_responses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      WHERE es.id = question_responses.session_id
      AND es.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view all responses" ON public.question_responses
  FOR SELECT USING (is_teacher());

-- Create indexes for performance
CREATE INDEX idx_question_banks_subject ON public.question_banks(subject_id);

CREATE INDEX idx_questions_bank ON public.questions(question_bank_id);

CREATE INDEX idx_questions_type ON public.questions(question_type);

CREATE INDEX idx_question_options_question ON public.question_options(question_id);

CREATE INDEX idx_exam_questions_exam ON public.exam_questions(exam_id);

CREATE INDEX idx_exam_questions_question ON public.exam_questions(question_id);

CREATE INDEX idx_exam_sessions_student ON public.exam_sessions(student_id);

CREATE INDEX idx_exam_sessions_exam ON public.exam_sessions(exam_id);

CREATE INDEX idx_question_responses_session ON public.question_responses(session_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_question_banks_updated_at
  BEFORE UPDATE ON public.question_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions  
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exam_sessions_updated_at  
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets for media files
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('question-media', 'question-media', false),
  ('exam-attachments', 'exam-attachments', false);

-- Create storage policies for question media
CREATE POLICY "Teachers can upload question media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'question-media' 
    AND is_teacher()
  );

CREATE POLICY "Teachers can update question media" ON storage.objects  
  FOR UPDATE USING (
    bucket_id = 'question-media'
    AND is_teacher()
  );

CREATE POLICY "Teachers can delete question media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'question-media'
    AND is_teacher()  
  );

CREATE POLICY "Authenticated users can view question media" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-media');

-- Create storage policies for exam attachments
CREATE POLICY "Teachers can manage exam attachments" ON storage.objects
  FOR ALL USING (
    bucket_id = 'exam-attachments'
    AND is_teacher()
  );

CREATE POLICY "Students can view exam attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'exam-attachments');

-- Create helper functions for exam management
CREATE OR REPLACE FUNCTION public.calculate_exam_score(session_id_param UUID)
RETURNS JSON AS $$
DECLARE
  session_record RECORD;
  total_points INTEGER := 0;
  earned_points INTEGER := 0;
  percentage DECIMAL(5,2);
  result JSON;
BEGIN
  -- Get session info
  SELECT * INTO session_record 
  FROM public.exam_sessions 
  WHERE id = session_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  
  -- Calculate total possible points
  SELECT COALESCE(SUM(eq.points), 0) INTO total_points
  FROM public.exam_questions eq
  WHERE eq.exam_id = session_record.exam_id;
  
  -- Calculate earned points  
  SELECT COALESCE(SUM(qr.points_earned), 0) INTO earned_points
  FROM public.question_responses qr
  WHERE qr.session_id = session_id_param;
  
  -- Calculate percentage
  IF total_points > 0 THEN
    percentage := (earned_points::DECIMAL / total_points::DECIMAL) * 100;
  ELSE
    percentage := 0;
  END IF;
  
  -- Update session with calculated scores
  UPDATE public.exam_sessions 
  SET 
    total_score = earned_points,
    max_score = total_points,
    percentage = percentage,
    passed = percentage >= (
      SELECT pass_mark FROM public.exams WHERE id = session_record.exam_id
    ),
    updated_at = now()
  WHERE id = session_id_param;
  
  -- Return result
  result := json_build_object(
    'total_score', earned_points,
    'max_score', total_points, 
    'percentage', percentage,
    'passed', percentage >= (
      SELECT pass_mark FROM public.exams WHERE id = session_record.exam_id
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-grade MCQ and True/False questions
CREATE OR REPLACE FUNCTION public.grade_question_response()
RETURNS TRIGGER AS $$
DECLARE
  question_record RECORD;
  is_answer_correct BOOLEAN := false;
  points_to_award INTEGER := 0;
BEGIN
  -- Get question details
  SELECT q.*, eq.points INTO question_record
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  JOIN public.exam_sessions es ON es.exam_id = eq.exam_id
  WHERE q.id = NEW.question_id 
  AND es.id = NEW.session_id;
  
  -- Grade based on question type
  IF question_record.question_type IN ('mcq', 'true_false') THEN
    -- Check if selected option is correct
    SELECT is_correct INTO is_answer_correct
    FROM public.question_options
    WHERE id = NEW.selected_option_id;
    
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
    
  ELSIF question_record.question_type = 'fill_blank' THEN
    -- For fill in the blank, check if any correct option matches
    SELECT EXISTS(
      SELECT 1 FROM public.question_options qo
      WHERE qo.question_id = NEW.question_id
      AND qo.is_correct = true
      AND LOWER(TRIM(qo.option_text)) = LOWER(TRIM(NEW.text_answer))
    ) INTO is_answer_correct;
    
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  END IF;
  
  -- Update response with grading results
  NEW.is_correct := is_answer_correct;
  NEW.points_earned := points_to_award;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-grading
CREATE TRIGGER trigger_grade_question_response
  BEFORE INSERT OR UPDATE ON public.question_responses
  FOR EACH ROW EXECUTE FUNCTION public.grade_question_response();


-- ===== 20250915173722_6f1d5a5f-3111-4ef5-8196-0c904e9053a6.sql =====

-- Fix security warnings: Set proper search_path for functions

-- Fix calculate_exam_score function
CREATE OR REPLACE FUNCTION public.calculate_exam_score(session_id_param UUID)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record RECORD;
  total_points INTEGER := 0;
  earned_points INTEGER := 0;
  percentage DECIMAL(5,2);
  result JSON;
BEGIN
  -- Get session info
  SELECT * INTO session_record 
  FROM public.exam_sessions 
  WHERE id = session_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  
  -- Calculate total possible points
  SELECT COALESCE(SUM(eq.points), 0) INTO total_points
  FROM public.exam_questions eq
  WHERE eq.exam_id = session_record.exam_id;
  
  -- Calculate earned points  
  SELECT COALESCE(SUM(qr.points_earned), 0) INTO earned_points
  FROM public.question_responses qr
  WHERE qr.session_id = session_id_param;
  
  -- Calculate percentage
  IF total_points > 0 THEN
    percentage := (earned_points::DECIMAL / total_points::DECIMAL) * 100;
  ELSE
    percentage := 0;
  END IF;
  
  -- Update session with calculated scores
  UPDATE public.exam_sessions 
  SET 
    total_score = earned_points,
    max_score = total_points,
    percentage = percentage,
    passed = percentage >= (
      SELECT pass_mark FROM public.exams WHERE id = session_record.exam_id
    ),
    updated_at = now()
  WHERE id = session_id_param;
  
  -- Return result
  result := json_build_object(
    'total_score', earned_points,
    'max_score', total_points, 
    'percentage', percentage,
    'passed', percentage >= (
      SELECT pass_mark FROM public.exams WHERE id = session_record.exam_id
    )
  );
  
  RETURN result;
END;
$$;

-- Fix grade_question_response function
CREATE OR REPLACE FUNCTION public.grade_question_response()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  question_record RECORD;
  is_answer_correct BOOLEAN := false;
  points_to_award INTEGER := 0;
BEGIN
  -- Get question details
  SELECT q.*, eq.points INTO question_record
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  JOIN public.exam_sessions es ON es.exam_id = eq.exam_id
  WHERE q.id = NEW.question_id 
  AND es.id = NEW.session_id;
  
  -- Grade based on question type
  IF question_record.question_type IN ('mcq', 'true_false') THEN
    -- Check if selected option is correct
    SELECT is_correct INTO is_answer_correct
    FROM public.question_options
    WHERE id = NEW.selected_option_id;
    
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
    
  ELSIF question_record.question_type = 'fill_blank' THEN
    -- For fill in the blank, check if any correct option matches
    SELECT EXISTS(
      SELECT 1 FROM public.question_options qo
      WHERE qo.question_id = NEW.question_id
      AND qo.is_correct = true
      AND LOWER(TRIM(qo.option_text)) = LOWER(TRIM(NEW.text_answer))
    ) INTO is_answer_correct;
    
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  END IF;
  
  -- Update response with grading results
  NEW.is_correct := is_answer_correct;
  NEW.points_earned := points_to_award;
  
  RETURN NEW;
END;
$$;


-- ===== 20250915173820_16332d25-398c-441c-aad5-27b0ef216ee9.sql =====

-- Create table for storing OTP codes for password reset and email verification
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Create policy for OTP access (only the system can manage these)
CREATE POLICY "Service role can manage OTPs" ON public.password_reset_otps
  FOR ALL USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps(email);

CREATE INDEX idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Create trigger for updated_at
CREATE TRIGGER update_password_reset_otps_updated_at
  BEFORE UPDATE ON public.password_reset_otps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.password_reset_otps 
  WHERE expires_at < now() OR used = true;
$$;


-- ===== 20250915174018_d5fa9122-4713-48d7-8a08-99273fa4d9ac.sql =====

-- Create table for storing OTP codes for password reset and email verification
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Create policy for OTP access (only the system can manage these)
CREATE POLICY "Service role can manage OTPs" ON public.password_reset_otps
  FOR ALL USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps(email);

CREATE INDEX idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Create trigger for updated_at
CREATE TRIGGER update_password_reset_otps_updated_at
  BEFORE UPDATE ON public.password_reset_otps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.password_reset_otps 
  WHERE expires_at < now() OR used = true;
$$;


-- ===== 20250921061842_5f697871-c848-42f1-b687-db99b24e82be.sql =====


-- [SKIPPED: legacy/auth-config statement from the old project]


-- ===== 20250921062214_a2276136-f4d8-4591-a9c7-96a81356ac83.sql =====

-- Update the exam dates to make it available to students
UPDATE public.exams 
SET 
  start_date = '2025-09-21 00:00:00+00',
  end_date = '2025-09-25 23:59:59+00',
  updated_at = now()
WHERE id = '45c42a1d-df3f-48c8-bef5-251f1f3bcd65';


-- ===== 20250921093753_0278e1ea-e0c9-494c-bbca-5a64e4f18e26.sql =====

-- Ensure grading triggers exist for question_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_ins'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_ins
    BEFORE INSERT ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_upd'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_upd
    BEFORE UPDATE OF selected_option_id, text_answer ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;
END $$;

-- Allow teachers to view student profiles for results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Teachers can view profiles'
  ) THEN
    CREATE POLICY "Teachers can view profiles"
    ON public.profiles
    FOR SELECT
    USING (public.is_teacher());
  END IF;
END $$;

-- Recalculate scores for all completed sessions to backfill totals
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.exam_sessions WHERE status = 'completed' LOOP
    PERFORM public.calculate_exam_score(s.id);
  END LOOP;
END $$;


-- ===== 20250921093813_5090884d-3814-4be5-b4be-ad18bc9770ea.sql =====

-- Ensure grading triggers exist for question_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_ins'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_ins
    BEFORE INSERT ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_upd'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_upd
    BEFORE UPDATE OF selected_option_id, text_answer ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;
END $$;

-- Allow teachers to view student profiles for results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Teachers can view profiles'
  ) THEN
    CREATE POLICY "Teachers can view profiles"
    ON public.profiles
    FOR SELECT
    USING (public.is_teacher());
  END IF;
END $$;

-- Recalculate scores for all completed sessions to backfill totals
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.exam_sessions WHERE status = 'completed' LOOP
    PERFORM public.calculate_exam_score(s.id);
  END LOOP;
END $$;


-- ===== 20250921093835_5aaf529b-c481-446f-adcd-6b1bb3ec62dd.sql =====

-- Ensure grading triggers exist for question_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_ins'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_ins
    BEFORE INSERT ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_upd'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_upd
    BEFORE UPDATE OF selected_option_id, text_answer ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;
END $$;

-- Allow teachers to view student profiles for results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Teachers can view profiles'
  ) THEN
    CREATE POLICY "Teachers can view profiles"
    ON public.profiles
    FOR SELECT
    USING (public.is_teacher());
  END IF;
END $$;

-- Recalculate scores for all completed sessions to backfill totals
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.exam_sessions WHERE status = 'completed' LOOP
    PERFORM public.calculate_exam_score(s.id);
  END LOOP;
END $$;


-- ===== 20250921093902_a3aa7587-2122-40bd-81d1-b6c8c83e0a64.sql =====

-- Fix the calculate_exam_score function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.calculate_exam_score(session_id_param uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  total_points INTEGER := 0;
  earned_points INTEGER := 0;
  calc_percentage DECIMAL(5,2);
  pass_mark_value INTEGER;
  result JSON;
BEGIN
  -- Get session info
  SELECT * INTO session_record 
  FROM public.exam_sessions 
  WHERE id = session_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  
  -- Get pass mark
  SELECT pass_mark INTO pass_mark_value
  FROM public.exams 
  WHERE id = session_record.exam_id;
  
  -- Calculate total possible points
  SELECT COALESCE(SUM(eq.points), 0) INTO total_points
  FROM public.exam_questions eq
  WHERE eq.exam_id = session_record.exam_id;
  
  -- Calculate earned points  
  SELECT COALESCE(SUM(qr.points_earned), 0) INTO earned_points
  FROM public.question_responses qr
  WHERE qr.session_id = session_id_param;
  
  -- Calculate percentage
  IF total_points > 0 THEN
    calc_percentage := (earned_points::DECIMAL / total_points::DECIMAL) * 100;
  ELSE
    calc_percentage := 0;
  END IF;
  
  -- Update session with calculated scores
  UPDATE public.exam_sessions 
  SET 
    total_score = earned_points,
    max_score = total_points,
    percentage = calc_percentage,
    passed = calc_percentage >= pass_mark_value,
    updated_at = now()
  WHERE id = session_id_param;
  
  -- Return result
  result := json_build_object(
    'total_score', earned_points,
    'max_score', total_points, 
    'percentage', calc_percentage,
    'passed', calc_percentage >= pass_mark_value
  );
  
  RETURN result;
END;
$function$;

-- Ensure grading triggers exist for question_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_ins'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_ins
    BEFORE INSERT ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_question_response_upd'
  ) THEN
    CREATE TRIGGER trg_grade_question_response_upd
    BEFORE UPDATE OF selected_option_id, text_answer ON public.question_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.grade_question_response();
  END IF;
END $$;

-- Allow teachers to view student profiles for results  
DROP POLICY IF EXISTS "Teachers can view profiles" ON public.profiles;

CREATE POLICY "Teachers can view profiles"
ON public.profiles
FOR SELECT
USING (public.is_teacher());

-- Recalculate scores for all completed sessions to backfill totals
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.exam_sessions WHERE status = 'completed' LOOP
    PERFORM public.calculate_exam_score(s.id);
  END LOOP;
END $$;


-- ===== 20250921104640_e963293a-24ee-4cc7-894b-50c11bdb85cd.sql =====

-- Fix RLS policies to allow public access to classes and subjects for registration
-- Update classes table policy to allow public read access for registration
DROP POLICY IF EXISTS "Authenticated users can view classes" ON public.classes;

CREATE POLICY "Public can view classes for registration" ON public.classes FOR SELECT USING (true);

-- Update subjects table policy to allow public read access for registration  
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;

CREATE POLICY "Public can view subjects for registration" ON public.subjects FOR SELECT USING (true);

-- Add missing triggers for grading
DROP TRIGGER IF EXISTS grade_question_response_trigger ON public.question_responses;

CREATE TRIGGER grade_question_response_trigger
  BEFORE INSERT OR UPDATE ON public.question_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.grade_question_response();

-- Add missing updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_exam_sessions_updated_at ON public.exam_sessions;

CREATE TRIGGER update_exam_sessions_updated_at
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add missing user creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ===== 20250921105003_9d85829b-692c-4d5c-8462-5ed24c4bc060.sql =====

-- Add diagram question type to the enum
ALTER TYPE question_type ADD VALUE 'diagram';


-- ===== 20250921131123_730fd22a-9f3d-459c-aa75-56181a6fbdfa.sql =====

-- Fix admin user management by ensuring proper RLS policies for CRUD operations
-- First check if we need to update RLS policies for user management

-- Enable admin users to create profiles when creating new users
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (is_admin());

-- Update admin deletion policy to allow deleting user profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (is_admin());

-- Create a function to handle user creation by admins
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  result JSONB;
BEGIN
  -- Only admins can create users
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  -- Insert into auth.users (this requires service role permissions)
  -- Since we can't directly insert into auth.users from client code,
  -- this function will be called from the client using supabase.auth.admin.createUser
  
  -- For now, just create the profile record when called after user creation
  IF user_role IN ('admin', 'teacher', 'student') THEN
    RETURN jsonb_build_object('success', true, 'message', 'User creation process initiated');
  ELSE
    RETURN jsonb_build_object('error', 'Invalid role specified');
  END IF;
END;
$$;

-- Create a function to safely delete user profiles
CREATE OR REPLACE FUNCTION public.delete_user_profile(user_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can delete users
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  -- Delete the profile (this will cascade through RLS)
  DELETE FROM public.profiles WHERE user_id = user_id_param;
  
  RETURN jsonb_build_object('success', true, 'message', 'Profile deleted successfully');
END;
$$;


-- ===== 20250921132542_93180717-7328-49c2-a831-7d6e7255dc8d.sql =====

-- Fix admin user management by updating RLS policies and functions

-- Update the create_user_with_profile function to be more robust
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  user_email text, 
  user_password text, 
  user_full_name text, 
  user_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can create users
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  -- Validate role
  IF user_role NOT IN ('admin', 'teacher', 'student') THEN
    RETURN jsonb_build_object('error', 'Invalid role specified');
  END IF;

  -- Return success - the actual user creation will be handled by the client
  RETURN jsonb_build_object('success', true, 'message', 'User creation authorized');
END;
$$;

-- Update the delete_user_profile function to be more robust
CREATE OR REPLACE FUNCTION public.delete_user_profile(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can delete users
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  -- Delete the profile (this will cascade through RLS)
  DELETE FROM public.profiles WHERE user_id = user_id_param;
  
  RETURN jsonb_build_object('success', true, 'message', 'Profile deleted successfully');
END;
$$;

-- Enhance question categorization with class support
ALTER TABLE public.question_banks 
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id);

-- Create index for better performance on question filtering
CREATE INDEX IF NOT EXISTS idx_questions_bank_subject_class 
ON public.questions(question_bank_id);

CREATE INDEX IF NOT EXISTS idx_question_banks_subject_class 
ON public.question_banks(subject_id, class_id);

-- Update question banks to support class-based categorization
COMMENT ON COLUMN public.question_banks.class_id IS 'Optional class assignment for question bank categorization';


-- ===== 20250921132648_c400580b-5209-48be-a65a-31b6e3adb83d.sql =====


-- [SKIPPED: legacy/auth-config statement from the old project]


-- [SKIPPED: legacy/auth-config statement from the old project]


-- [SKIPPED: legacy/auth-config statement from the old project]


-- [SKIPPED: legacy/auth-config statement from the old project]


-- ===== 20250921135447_8535df7d-7006-4811-bcc6-a70cde264fa6.sql =====

-- Add teacher class assignments table
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(teacher_id, class_id)
);

-- Enable RLS
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for teacher class assignments
CREATE POLICY "Teachers can view their class assignments" 
ON public.teacher_class_assignments 
FOR SELECT 
USING (teacher_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage teacher class assignments" 
ON public.teacher_class_assignments 
FOR ALL 
USING (is_admin());

-- Add support for different question types
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS allow_multiple_correct boolean DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_teacher_id ON public.teacher_class_assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class_id ON public.teacher_class_assignments(class_id);

-- Update RLS policies for exams to include teacher-class assignments
DROP POLICY IF EXISTS "Teachers can manage exams" ON public.exams;

CREATE POLICY "Teachers can manage exams" 
ON public.exams 
FOR ALL 
USING (
  is_admin() OR 
  created_by = auth.uid() OR 
  (
    is_teacher() AND 
    (
      class_id IS NULL OR 
      EXISTS (
        SELECT 1 FROM public.teacher_class_assignments tca 
        WHERE tca.teacher_id = auth.uid() AND tca.class_id = exams.class_id
      )
    )
  )
);

-- Update exam sessions policy to fix the live monitor issue
DROP POLICY IF EXISTS "Teachers can view all sessions" ON public.exam_sessions;

CREATE POLICY "Teachers can view exam sessions" 
ON public.exam_sessions 
FOR SELECT 
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM public.exams e
    LEFT JOIN public.teacher_class_assignments tca ON tca.class_id = e.class_id
    WHERE e.id = exam_sessions.exam_id 
    AND (
      e.created_by = auth.uid() OR 
      tca.teacher_id = auth.uid() OR
      is_admin()
    )
  )
);


-- ===== 20250921143129_e1ef54f1-8f5b-45ac-be09-501d55f6e95e.sql =====

-- Fix RLS policies for exams to allow teachers to see admin-created exams for their subjects

-- Drop the existing policy
DROP POLICY IF EXISTS "Teachers can manage exams" ON public.exams;

-- Create new policy for teachers to manage their own exams and view admin exams for their subjects
CREATE POLICY "Teachers can manage exams" ON public.exams
FOR ALL USING (
  is_admin() OR 
  created_by = auth.uid() OR 
  (
    is_teacher() AND 
    (
      -- Teacher created this exam
      created_by = auth.uid() OR
      -- Teacher is assigned to teach this subject
      EXISTS (
        SELECT 1 FROM public.teacher_class_assignments tca 
        WHERE tca.teacher_id = auth.uid() 
        AND (tca.class_id = exams.class_id OR exams.class_id IS NULL)
      ) AND
      EXISTS (
        SELECT 1 FROM public.subject_assignments sa 
        WHERE sa.user_id = auth.uid() 
        AND sa.subject_id = exams.subject_id
      )
    )
  )
);


-- ===== 20250922115249_eebfd3f3-7954-4f8b-b1b6-64a51bd27291.sql =====

-- Add class_id to questions table for categorization by both subject and class
ALTER TABLE public.questions 
ADD COLUMN class_id UUID REFERENCES public.classes(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_questions_class_id ON public.questions(class_id);

-- Update existing questions to have class_id based on their question_bank's class
UPDATE public.questions 
SET class_id = (
  SELECT qb.class_id 
  FROM public.question_banks qb 
  WHERE qb.id = questions.question_bank_id
) 
WHERE class_id IS NULL;


-- ===== 20250922121248_fe431d3f-f6a6-4335-8ecb-1d7e23d9e158.sql =====

-- Add class_id to question_banks table to categorize questions by class and subject
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id);

-- Create index for better performance when filtering by class
CREATE INDEX IF NOT EXISTS idx_question_banks_class_id ON question_banks(class_id);

-- Update questions table to include class_id reference
ALTER TABLE questions ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id);

-- Create index for better performance when filtering questions by class
CREATE INDEX IF NOT EXISTS idx_questions_class_id ON questions(class_id);

-- Create a function to update questions class_id based on question_bank
CREATE OR REPLACE FUNCTION update_question_class_from_bank()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the question's class_id to match its question bank's class_id
  IF NEW.question_bank_id IS NOT NULL THEN
    UPDATE questions 
    SET class_id = (
      SELECT class_id 
      FROM question_banks 
      WHERE id = NEW.question_bank_id
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update question class_id when question_bank_id changes
DROP TRIGGER IF EXISTS trigger_update_question_class ON questions;

CREATE TRIGGER trigger_update_question_class
  AFTER INSERT OR UPDATE OF question_bank_id ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_question_class_from_bank();


-- ===== 20250922121355_a02dc583-0231-4a04-8498-e6041914a3b0.sql =====

-- Fix search path security issues for functions
CREATE OR REPLACE FUNCTION update_question_class_from_bank()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the question's class_id to match its question bank's class_id
  IF NEW.question_bank_id IS NOT NULL THEN
    UPDATE questions 
    SET class_id = (
      SELECT class_id 
      FROM question_banks 
      WHERE id = NEW.question_bank_id
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


-- ===== 20250923133412_950ca336-2cc6-4f90-92dc-5c2dec4a51cd.sql =====

-- Create function to automatically assign teachers to classes when they register
-- This ensures teachers have proper class assignments for exam visibility

CREATE OR REPLACE FUNCTION public.auto_assign_teacher_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_class_id uuid;
BEGIN
    -- Only process if this is a teacher profile
    IF NEW.role != 'teacher' THEN
        RETURN NEW;
    END IF;
    
    -- Get a default class to assign (you can modify this logic)
    -- For now, we'll skip auto-assignment and let admins assign manually
    -- But we ensure the structure is in place
    
    RETURN NEW;
END;
$$;

-- Update exam RLS policies to better handle teacher visibility
-- Teachers should see exams they created OR exams for classes they're assigned to

DROP POLICY IF EXISTS "Teachers can manage exams" ON exams;

CREATE POLICY "Teachers can manage exams" 
ON exams 
FOR ALL 
USING (
  is_admin() OR 
  created_by = auth.uid() OR 
  (
    is_teacher() AND (
      -- Teachers can see exams they created
      created_by = auth.uid() OR
      -- Teachers can see exams for classes they're assigned to (if they have class assignments)
      (
        EXISTS (
          SELECT 1 FROM teacher_class_assignments tca 
          WHERE tca.teacher_id = auth.uid() 
          AND tca.class_id = exams.class_id
        )
      ) OR
      -- Teachers can see exams for subjects they're assigned to (even without class assignment)
      (
        EXISTS (
          SELECT 1 FROM subject_assignments sa 
          WHERE sa.user_id = auth.uid() 
          AND sa.subject_id = exams.subject_id
        )
      )
    )
  )
);

-- Update question bank policies to ensure proper visibility
DROP POLICY IF EXISTS "Teachers can manage question banks" ON question_banks;

CREATE POLICY "Teachers can manage question banks" 
ON question_banks 
FOR ALL 
USING (
  is_teacher() AND (
    -- Teachers can access question banks they created
    created_by = auth.uid() OR
    -- Teachers can access question banks for subjects they're assigned to
    EXISTS (
      SELECT 1 FROM subject_assignments sa 
      WHERE sa.user_id = auth.uid() 
      AND sa.subject_id = question_banks.subject_id
    ) OR
    -- Teachers can access question banks for classes they're assigned to
    (
      class_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM teacher_class_assignments tca 
        WHERE tca.teacher_id = auth.uid() 
        AND tca.class_id = question_banks.class_id
      )
    )
  )
);

-- Ensure existing question banks without class_id are accessible
UPDATE question_banks 
SET class_id = NULL 
WHERE class_id IS NULL;


-- ===== 20250923135129_4855b805-22a9-4cc6-adc6-a51c0ba625de.sql =====

-- Add foreign key constraint from exam_sessions.student_id to profiles.user_id
ALTER TABLE public.exam_sessions 
ADD CONSTRAINT fk_exam_sessions_student_id 
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions(student_id);


-- ===== 20250923140603_692c61d6-0b61-4dd3-ae1c-6a2f1d782612.sql =====

-- Create website CMS tables for Al-Bari Group of Schools Website

-- Website pages for static content management
CREATE TABLE public.website_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  meta_title text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Website sections for reusable content blocks
CREATE TABLE public.website_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid,
  section_type text NOT NULL, -- 'hero', 'statistics', 'content', 'gallery', etc.
  title text,
  content text,
  image_url text,
  section_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (page_id) REFERENCES public.website_pages(id) ON DELETE CASCADE
);

-- News and events articles
CREATE TABLE public.news_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  featured_image text,
  category text NOT NULL DEFAULT 'news', -- 'news', 'events', 'announcements'
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  event_date timestamp with time zone, -- for events
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Gallery for images and media
CREATE TABLE public.gallery (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  category text NOT NULL DEFAULT 'general', -- 'facilities', 'events', 'activities', etc.
  alt_text text,
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- School information and settings
CREATE TABLE public.school_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  info_key text NOT NULL UNIQUE,
  info_value text NOT NULL,
  category text NOT NULL DEFAULT 'general', -- 'contact', 'social', 'statistics', etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Testimonials from students and parents
CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL, -- 'student', 'parent', 'alumni', 'staff'
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Website settings for global configuration
CREATE TABLE public.website_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all website tables
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.school_info ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for website content (public read access, admin write access)
CREATE POLICY "Public can view published pages" ON public.website_pages
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage pages" ON public.website_pages
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view active sections" ON public.website_sections
  FOR SELECT USING (is_active = true AND EXISTS (
    SELECT 1 FROM public.website_pages 
    WHERE id = website_sections.page_id AND is_published = true
  ));

CREATE POLICY "Admins can manage sections" ON public.website_sections
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view published articles" ON public.news_articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage articles" ON public.news_articles
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view gallery" ON public.gallery
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage gallery" ON public.gallery
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view active school info" ON public.school_info
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage school info" ON public.school_info
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view published testimonials" ON public.testimonials
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage testimonials" ON public.testimonials
  FOR ALL USING (is_admin());

CREATE POLICY "Admins can manage website settings" ON public.website_settings
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view website settings" ON public.website_settings
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX idx_website_pages_slug ON public.website_pages(slug);

CREATE INDEX idx_website_pages_published ON public.website_pages(is_published);

CREATE INDEX idx_website_sections_page_order ON public.website_sections(page_id, section_order);

CREATE INDEX idx_news_articles_slug ON public.news_articles(slug);

CREATE INDEX idx_news_articles_published ON public.news_articles(is_published, published_at);

CREATE INDEX idx_news_articles_category ON public.news_articles(category);

CREATE INDEX idx_gallery_category ON public.gallery(category);

CREATE INDEX idx_school_info_key ON public.school_info(info_key);

CREATE INDEX idx_testimonials_featured ON public.testimonials(is_featured, is_published);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_website_pages_updated_at
  BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_website_sections_updated_at
  BEFORE UPDATE ON public.website_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_info_updated_at
  BEFORE UPDATE ON public.school_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial school information
INSERT INTO public.school_info (info_key, info_value, category) VALUES
('school_name', 'Al-Bari Group of Schools', 'general'),
('phone', '+234 813 418 7710', 'contact'),
('email', 'info@albari.edu.ng', 'contact'),
('address', 'Lagos, Nigeria', 'contact'),
('established', '2010', 'general'),
('student_count', '500+', 'statistics'),
('teacher_count', '50+', 'statistics'),
('success_rate', '98%', 'statistics'),
('facebook', 'https://facebook.com/albariGroup of Schools', 'social'),
('twitter', 'https://twitter.com/albariGroup of Schools', 'social'),
('instagram', 'https://instagram.com/albariGroup of Schools', 'social');

-- Insert initial website settings
INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
('site_title', '"Al-Bari Group of Schools - Excellence in Education"', 'Main site title'),
('site_tagline', '"Building Tomorrow''s Leaders Today"', 'Site tagline/motto'),
('contact_email', '"info@albari.edu.ng"', 'Main contact email'),
('contact_phone', '"+234 813 418 7710"', 'Main contact phone'),
('social_links', '{"facebook": "https://facebook.com/albariGroup of Schools", "twitter": "https://twitter.com/albariGroup of Schools", "instagram": "https://instagram.com/albariGroup of Schools"}', 'Social media links'),
('school_colors', '{"primary": "#22c55e", "secondary": "#16a34a", "accent": "#15803d"}', 'School brand colors');


-- ===== 20250923211228_29afeaa1-2801-4243-93f5-e171626e8901.sql =====

-- Phase 1: Core SMS Tables Creation

-- Student Information Management
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_number text UNIQUE NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female')),
  blood_group text,
  address jsonb, -- {street, city, state, postal_code, country}
  emergency_contact jsonb, -- {name, relationship, phone, email}
  medical_info jsonb, -- {allergies, medications, conditions}
  admission_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'graduated')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Parent/Guardian Management  
CREATE TABLE public.parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text, -- Mr., Mrs., Dr., etc.
  occupation text,
  workplace text,
  phone_primary text,
  phone_secondary text,
  address jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Student-Parent Relationships
CREATE TABLE public.student_parent_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  relationship_type text CHECK (relationship_type IN ('father', 'mother', 'guardian', 'other')),
  is_primary_contact boolean DEFAULT false,
  is_emergency_contact boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Fee Management
CREATE TABLE public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id),
  academic_year text NOT NULL,
  fee_type text NOT NULL, -- tuition, transport, library, etc.
  amount decimal(10,2) NOT NULL,
  due_date date,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id),
  fee_structure_id uuid REFERENCES public.fee_structures(id),
  amount_paid decimal(10,2) NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text, -- cash, bank_transfer, online, cheque
  transaction_id text,
  receipt_number text UNIQUE,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Attendance Management
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id),
  subject_id uuid REFERENCES public.subjects(id),
  teacher_id uuid REFERENCES auth.users(id),
  date date DEFAULT CURRENT_DATE,
  period_number integer,
  start_time time,
  end_time time,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id uuid REFERENCES public.attendance_sessions(id),
  student_id uuid REFERENCES public.students(id),
  status text CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_at timestamptz DEFAULT now(),
  marked_by uuid REFERENCES auth.users(id),
  notes text
);

-- Communication & Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  target_audience text[] DEFAULT '{}', -- ['all', 'students', 'teachers', 'parents', 'specific_class']
  class_ids uuid[], -- for class-specific announcements
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_published boolean DEFAULT false,
  publish_date timestamptz,
  expire_date timestamptz,
  attachments jsonb, -- file URLs and metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Academic Calendar & Events
CREATE TABLE public.academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'holiday', 'exam', 'event', 'meeting'
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  is_recurring boolean DEFAULT false,
  recurrence_pattern jsonb, -- {type: 'weekly', 'monthly', days: [], etc.}
  classes_affected uuid[], -- specific classes or null for all
  is_school_wide boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Gradebooks & Report Cards
CREATE TABLE public.gradebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id),
  subject_id uuid REFERENCES public.subjects(id),
  class_id uuid REFERENCES public.classes(id),
  assessment_type text NOT NULL, -- 'assignment', 'quiz', 'exam', 'project'
  assessment_name text NOT NULL,
  max_score decimal(5,2) NOT NULL,
  obtained_score decimal(5,2),
  grade text,
  assessment_date date DEFAULT CURRENT_DATE,
  remarks text,
  teacher_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Library Management
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn text,
  title text NOT NULL,
  author text,
  publisher text,
  category text,
  total_copies integer DEFAULT 1,
  available_copies integer DEFAULT 1,
  location text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.book_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.library_books(id),
  student_id uuid REFERENCES public.students(id),
  issued_date date DEFAULT CURRENT_DATE,
  due_date date,
  returned_date date,
  fine_amount decimal(8,2) DEFAULT 0,
  status text DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue', 'lost')),
  issued_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_parent_relationships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gradebook_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.book_issues ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Students
CREATE POLICY "Students can view their own profile" ON public.students
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Parents can view their children's profiles" ON public.students
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.student_parent_relationships spr
    JOIN public.parents p ON p.id = spr.parent_id
    WHERE spr.student_id = students.id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers and admins can manage students" ON public.students
FOR ALL USING (is_teacher());

-- Create RLS Policies for Parents
CREATE POLICY "Parents can view and update their own profile" ON public.parents
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all parents" ON public.parents
FOR ALL USING (is_admin());

CREATE POLICY "Teachers can view parents" ON public.parents
FOR SELECT USING (is_teacher());

-- Create RLS Policies for Student-Parent Relationships
CREATE POLICY "Users can view their family relationships" ON public.student_parent_relationships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.parents p WHERE p.id = parent_id AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage family relationships" ON public.student_parent_relationships
FOR ALL USING (is_admin());

-- Create RLS Policies for Fee Management
CREATE POLICY "Students and parents can view relevant fees" ON public.fee_structures
FOR SELECT USING (
  class_id IN (
    SELECT ca.class_id FROM public.class_assignments ca
    JOIN public.students s ON s.id = ca.student_id
    WHERE s.user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.student_parent_relationships spr
      JOIN public.parents p ON p.id = spr.parent_id
      WHERE spr.student_id = s.id AND p.user_id = auth.uid()
    )
  ) OR is_teacher()
);

CREATE POLICY "Admins can manage fee structures" ON public.fee_structures
FOR ALL USING (is_admin());

CREATE POLICY "Students and parents can view their payments" ON public.fee_payments
FOR SELECT USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.student_parent_relationships spr
      JOIN public.parents p ON p.id = spr.parent_id
      WHERE spr.student_id = s.id AND p.user_id = auth.uid()
    )
  ) OR is_teacher()
);

CREATE POLICY "Admins can manage fee payments" ON public.fee_payments
FOR ALL USING (is_admin());

-- Create RLS Policies for Attendance
CREATE POLICY "Teachers can manage attendance sessions" ON public.attendance_sessions
FOR ALL USING (teacher_id = auth.uid() OR is_admin());

CREATE POLICY "Students can view their attendance sessions" ON public.attendance_sessions
FOR SELECT USING (
  class_id IN (
    SELECT ca.class_id FROM public.class_assignments ca
    JOIN public.students s ON s.id = ca.student_id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Students and parents can view attendance records" ON public.student_attendance
FOR SELECT USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.student_parent_relationships spr
      JOIN public.parents p ON p.id = spr.parent_id
      WHERE spr.student_id = s.id AND p.user_id = auth.uid()
    )
  ) OR is_teacher()
);

CREATE POLICY "Teachers can manage attendance records" ON public.student_attendance
FOR ALL USING (is_teacher());

-- Create RLS Policies for Announcements
CREATE POLICY "Everyone can view published announcements" ON public.announcements
FOR SELECT USING (is_published = true);

CREATE POLICY "Admins and teachers can manage announcements" ON public.announcements
FOR ALL USING (is_teacher());

-- Create RLS Policies for Academic Calendar
CREATE POLICY "Everyone can view academic calendar" ON public.academic_calendar
FOR SELECT USING (true);

CREATE POLICY "Admins can manage academic calendar" ON public.academic_calendar
FOR ALL USING (is_admin());

-- Create RLS Policies for Gradebook
CREATE POLICY "Students and parents can view relevant grades" ON public.gradebook_entries
FOR SELECT USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.student_parent_relationships spr
      JOIN public.parents p ON p.id = spr.parent_id
      WHERE spr.student_id = s.id AND p.user_id = auth.uid()
    )
  ) OR is_teacher()
);

CREATE POLICY "Teachers can manage gradebook entries" ON public.gradebook_entries
FOR ALL USING (is_teacher());

-- Create RLS Policies for Library
CREATE POLICY "Everyone can view available books" ON public.library_books
FOR SELECT USING (true);

CREATE POLICY "Admins can manage library books" ON public.library_books
FOR ALL USING (is_admin());

CREATE POLICY "Students and parents can view their book issues" ON public.book_issues
FOR SELECT USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.student_parent_relationships spr
      JOIN public.parents p ON p.id = spr.parent_id
      WHERE spr.student_id = s.id AND p.user_id = auth.uid()
    )
  ) OR is_teacher()
);

CREATE POLICY "Admins can manage book issues" ON public.book_issues
FOR ALL USING (is_admin());

-- Create triggers for updated_at columns
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parents_updated_at
BEFORE UPDATE ON public.parents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ===== 20250926060815_46b44e9d-b5ca-43da-b8f6-cf23fc661a04.sql =====

-- Add columns to exams table for question pool management
ALTER TABLE exams 
ADD COLUMN questions_per_student INTEGER DEFAULT NULL,
ADD COLUMN question_pool_size INTEGER DEFAULT NULL;

-- Add comment to clarify usage
COMMENT ON COLUMN exams.questions_per_student IS 'Number of questions each student should answer (subset of total pool)';

COMMENT ON COLUMN exams.question_pool_size IS 'Total number of questions in the pool (for reference)';


-- ===== 20251010082739_f7cfa91a-1af1-489f-8c66-4670a1987114.sql =====

-- PHASE 1: CORE INFRASTRUCTURE - Security & Admission Database

-- ============================================
-- 1.1 SECURITY OVERHAUL - Role-based Access Control
-- ============================================

-- Create app_role enum
CREATE TYPE app_role AS ENUM ('admin', 'teacher', 'student', 'parent');

-- Create user_roles table for proper role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Helper function to check if current user is teacher or admin
CREATE OR REPLACE FUNCTION public.is_teacher_v2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin');
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role::app_role
FROM public.profiles
WHERE role IN ('admin', 'teacher', 'student', 'parent')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- 1.2 ADMISSION SYSTEM DATABASE ARCHITECTURE
-- ============================================

-- Admission status enum
CREATE TYPE admission_status AS ENUM (
  'submitted',
  'under_review',
  'interview_scheduled',
  'accepted',
  'rejected',
  'payment_pending',
  'enrolled',
  'withdrawn'
);

-- Admission applications table
CREATE TABLE public.admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE NOT NULL,
  
  -- Student Information
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  blood_group TEXT,
  state_of_origin TEXT,
  lga TEXT,
  nationality TEXT DEFAULT 'Nigerian',
  religion TEXT,
  
  -- Contact Information
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address JSONB NOT NULL,
  
  -- Academic Information
  previous_school TEXT,
  previous_class TEXT,
  applying_for_class_id UUID REFERENCES public.classes(id),
  
  -- Parent/Guardian Information
  parent_guardian_info JSONB NOT NULL,
  
  -- Medical Information
  medical_conditions TEXT,
  allergies TEXT,
  special_needs TEXT,
  
  -- Application Status
  status admission_status NOT NULL DEFAULT 'submitted',
  application_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Admission Details
  admission_date TIMESTAMPTZ,
  admitted_to_class_id UUID REFERENCES public.classes(id),
  student_id UUID REFERENCES public.students(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admission documents table
CREATE TABLE public.admission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admission interviews table
CREATE TABLE public.admission_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  interview_type TEXT NOT NULL DEFAULT 'in-person',
  location TEXT,
  interviewer_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  feedback TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admission payments table
CREATE TABLE public.admission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'application_fee',
  payment_method TEXT,
  transaction_id TEXT UNIQUE,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admission workflow logs table
CREATE TABLE public.admission_workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL,
  from_status admission_status,
  to_status admission_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all admission tables
ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_interviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admission_applications
CREATE POLICY "Public can submit applications"
ON public.admission_applications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Applicants can view their own application"
ON public.admission_applications FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Admins can view all applications"
ON public.admission_applications FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
ON public.admission_applications FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admission_documents
CREATE POLICY "Applicants can view their documents"
ON public.admission_documents FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Public can upload documents"
ON public.admission_documents FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage documents"
ON public.admission_documents FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admission_interviews
CREATE POLICY "Applicants can view their interviews"
ON public.admission_interviews FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Admins can manage interviews"
ON public.admission_interviews FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admission_payments
CREATE POLICY "Applicants can view their payments"
ON public.admission_payments FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Public can create payments"
ON public.admission_payments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage payments"
ON public.admission_payments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admission_workflow_logs
CREATE POLICY "Admins can view workflow logs"
ON public.admission_workflow_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create workflow logs"
ON public.admission_workflow_logs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to generate unique application number
CREATE OR REPLACE FUNCTION public.generate_application_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.application_number := 'APP' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('admission_app_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for application numbers
CREATE SEQUENCE admission_app_seq START 1;

-- Trigger to auto-generate application number
CREATE TRIGGER set_application_number
BEFORE INSERT ON public.admission_applications
FOR EACH ROW
WHEN (NEW.application_number IS NULL)
EXECUTE FUNCTION public.generate_application_number();

-- Function to log admission status changes
CREATE OR REPLACE FUNCTION public.log_admission_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
CREATE TRIGGER log_status_change
AFTER UPDATE ON public.admission_applications
FOR EACH ROW
EXECUTE FUNCTION public.log_admission_status_change();

-- Update timestamp trigger for admission tables
CREATE TRIGGER update_admission_applications_updated_at
BEFORE UPDATE ON public.admission_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admission_interviews_updated_at
BEFORE UPDATE ON public.admission_interviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 1.3 ENHANCED PARENT-STUDENT RELATIONSHIP
-- ============================================

-- Add access control columns to student_parent_relationships
ALTER TABLE public.student_parent_relationships
ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'full' CHECK (access_level IN ('full', 'limited')),
ADD COLUMN IF NOT EXISTS can_view_grades BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_view_attendance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_view_fees BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "in_app": true}'::jsonb;


-- ===== 20251010082800_1320340a-61d2-499c-9897-a9e23b04a321.sql =====

-- Fix security warnings from previous migration

-- Fix generate_application_number function - add search_path
CREATE OR REPLACE FUNCTION public.generate_application_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.application_number := 'APP' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('admission_app_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

-- Fix log_admission_status_change function - add search_path
CREATE OR REPLACE FUNCTION public.log_admission_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;


-- ===== 20251011054525_47c7204d-8803-4351-933c-4dbdc6db6271.sql =====

-- Create storage bucket for admission documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('admission-documents', 'admission-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for admission documents bucket
CREATE POLICY "Admins can manage admission documents"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'admission-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own application documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'admission-documents' AND
  (
    -- Check if the folder name matches an application the user has access to
    EXISTS (
      SELECT 1 FROM public.admission_applications aa
      WHERE aa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND (storage.foldername(name))[1] = aa.id::text
    )
    OR
    -- Or if they are an admin
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "Public can upload application documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'admission-documents'
);


-- ===== 20251012135218_8a058362-51b0-48f2-9b3e-fb62aca322e6.sql =====

-- Fix permission denied error for public admission applications
-- Update the SELECT policy to handle unauthenticated users properly

DROP POLICY IF EXISTS "Applicants can view their own application" ON admission_applications;

CREATE POLICY "Applicants can view their own application"
ON admission_applications FOR SELECT
USING (
  -- Only allow authenticated users to view via this policy
  -- Unauthenticated users won't trigger auth.users access
  auth.uid() IS NOT NULL AND
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
);


-- ===== 20251012162043_ef06a27e-b7fe-4710-8508-d0d1b6c610a0.sql =====

-- Fix RLS policies for admission_applications to allow public tracking and admin access

-- Drop the restrictive "Applicants can view their own application" policy
DROP POLICY IF EXISTS "Applicants can view their own application" ON public.admission_applications;

-- Create new policy that allows public SELECT
-- The ApplicationTracker component filters by email + application_number in the query
CREATE POLICY "Public can view applications"
ON public.admission_applications
FOR SELECT
TO anon, authenticated
USING (true);

-- Ensure the admin policy is using the has_role function correctly
DROP POLICY IF EXISTS "Admins can view all applications" ON public.admission_applications;

CREATE POLICY "Admins can view all applications"
ON public.admission_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- ===== 20251012163337_71f9e160-bd0b-42b6-a869-5935a63ba863.sql =====

-- Complete Admission Management System Database Schema

-- Create admission_sessions table for session configuration
CREATE TABLE IF NOT EXISTS public.admission_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  session_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed')),
  application_fee NUMERIC NOT NULL,
  classes_open JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_applicants INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interview_panels table for multi-member panels
CREATE TABLE IF NOT EXISTS public.interview_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.admission_interviews(id) ON DELETE CASCADE NOT NULL,
  interviewer_id UUID REFERENCES public.profiles(user_id) NOT NULL,
  role TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interview_feedback table for structured evaluations
CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.admission_interviews(id) ON DELETE CASCADE NOT NULL,
  panel_member_id UUID REFERENCES public.profiles(user_id) NOT NULL,
  ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  comments TEXT,
  recommendation TEXT CHECK (recommendation IN ('strong_accept', 'accept', 'neutral', 'reject')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admission_offers table for offer letters
CREATE TABLE IF NOT EXISTS public.admission_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL UNIQUE,
  offer_letter_url TEXT,
  offered_class_id UUID REFERENCES public.classes(id),
  acceptance_fee NUMERIC NOT NULL,
  acceptance_deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'declined', 'expired')),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admission_exam_assignments table
CREATE TABLE IF NOT EXISTS public.admission_exam_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(application_id, exam_id)
);

-- Add exam_category field to exams table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'exams' AND column_name = 'exam_category') THEN
    ALTER TABLE public.exams ADD COLUMN exam_category TEXT DEFAULT 'regular' CHECK (exam_category IN ('regular', 'entrance'));
  END IF;
END $$;

-- Add aggregate_score and panel_decision to admission_interviews if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admission_interviews' AND column_name = 'aggregate_score') THEN
    ALTER TABLE public.admission_interviews ADD COLUMN aggregate_score NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admission_interviews' AND column_name = 'panel_decision') THEN
    ALTER TABLE public.admission_interviews ADD COLUMN panel_decision TEXT CHECK (panel_decision IN ('accept', 'reject', 'waitlist'));
  END IF;
END $$;

-- Add combined_score to admission_applications
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admission_applications' AND column_name = 'combined_score') THEN
    ALTER TABLE public.admission_applications ADD COLUMN combined_score NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admission_applications' AND column_name = 'merit_rank') THEN
    ALTER TABLE public.admission_applications ADD COLUMN merit_rank INTEGER;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE public.admission_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interview_panels ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_offers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admission_exam_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admission_sessions
CREATE POLICY "Admins can manage admission sessions"
ON public.admission_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view active sessions"
ON public.admission_sessions
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- RLS Policies for interview_panels
CREATE POLICY "Admins can manage interview panels"
ON public.interview_panels
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Panel members can view their assignments"
ON public.interview_panels
FOR SELECT
TO authenticated
USING (interviewer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for interview_feedback
CREATE POLICY "Admins can view all feedback"
ON public.interview_feedback
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Panel members can manage their feedback"
ON public.interview_feedback
FOR ALL
TO authenticated
USING (panel_member_id = auth.uid());

-- RLS Policies for admission_offers
CREATE POLICY "Admins can manage offers"
ON public.admission_offers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Applicants can view and accept their offers"
ON public.admission_offers
FOR SELECT
TO anon, authenticated
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Applicants can update offer status"
ON public.admission_offers
FOR UPDATE
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
)
WITH CHECK (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- RLS Policies for admission_exam_assignments
CREATE POLICY "Admins can manage exam assignments"
ON public.admission_exam_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Applicants can view their exam assignments"
ON public.admission_exam_assignments
FOR SELECT
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admission_sessions_status ON public.admission_sessions(status);

CREATE INDEX IF NOT EXISTS idx_interview_panels_interview_id ON public.interview_panels(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_interview_id ON public.interview_feedback(interview_id);

CREATE INDEX IF NOT EXISTS idx_admission_offers_application_id ON public.admission_offers(application_id);

CREATE INDEX IF NOT EXISTS idx_admission_offers_status ON public.admission_offers(status);

CREATE INDEX IF NOT EXISTS idx_admission_exam_assignments_application_id ON public.admission_exam_assignments(application_id);

CREATE INDEX IF NOT EXISTS idx_admission_applications_combined_score ON public.admission_applications(combined_score);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_admission_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admission_sessions_updated_at
BEFORE UPDATE ON public.admission_sessions
FOR EACH ROW
EXECUTE FUNCTION update_admission_sessions_updated_at();

CREATE TRIGGER update_admission_offers_updated_at
BEFORE UPDATE ON public.admission_offers
FOR EACH ROW
EXECUTE FUNCTION update_admission_sessions_updated_at();


-- ===== 20251012165831_6c1843be-0b01-4e99-944a-8265e8ad68e7.sql =====

-- Add missing columns to admission_offers table
ALTER TABLE public.admission_offers 
ADD COLUMN IF NOT EXISTS acceptance_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP WITH TIME ZONE;

-- Create index on acceptance_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_admission_offers_acceptance_token 
ON public.admission_offers(acceptance_token);


-- ===== 20251012170210_fb2c9436-d632-4f42-81b0-076cf230182c.sql =====

-- Create email_logs table for tracking all emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resend_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  application_id UUID REFERENCES public.admission_applications(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);

CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);

CREATE INDEX IF NOT EXISTS idx_email_logs_application ON public.email_logs(application_id);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all email logs
CREATE POLICY "Admins can manage email logs" ON public.email_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own email logs
CREATE POLICY "Users can view their email logs" ON public.email_logs
  FOR SELECT
  USING (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Add trigger to update updated_at
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ===== 20251012172659_9847094c-b5fd-4de6-b88b-193c8a5c8ee3.sql =====

-- Fix RLS policy for admission_documents to allow admin access
DROP POLICY IF EXISTS "Admins can manage documents" ON admission_documents;

CREATE POLICY "Admins can manage documents" 
ON admission_documents 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add validation function to check if interview exists
CREATE OR REPLACE FUNCTION interview_exists(interview_uuid UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admission_interviews 
    WHERE id = interview_uuid
  );
END;
$$;


-- ===== 20251012172759_ed12528a-6a25-481f-8d27-e87c6ca70bf8.sql =====

-- Fix search_path for interview_exists function
CREATE OR REPLACE FUNCTION interview_exists(interview_uuid UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admission_interviews 
    WHERE id = interview_uuid
  );
END;
$$;


-- ===== 20251012174943_9597c640-79e3-415b-94de-8d6dbbf1bb6e.sql =====

-- Fix RLS policy for admission_documents to allow admin access
DROP POLICY IF EXISTS "Admins can manage documents" ON admission_documents;

-- Create new policy that checks profiles table directly for admin role
CREATE POLICY "Admins can manage documents" 
ON admission_documents 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);


-- ===== 20251022064828_4e26320e-b342-404a-8162-13107664e44b.sql =====

-- Fix RLS recursion by updating role checking functions to use security definer

-- Update is_admin() to use the secure has_role function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Update is_teacher() to use the secure has_role function
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin');
$$;

-- Fix the RLS policy on user_roles to use security definer function
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure the "Users can view their own roles" policy exists (this one is fine)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);


-- ===== 20251022065849_9ecdfa59-a76c-4677-ab9a-bcaec521d6ab.sql =====

-- Fix 2: Create admission_documents table
CREATE TABLE IF NOT EXISTS public.admission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.admission_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('birth_certificate', 'previous_school_report', 'passport_photo', 'medical_certificate', 'other')),
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for admission_documents
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage admission documents" ON public.admission_documents;

DROP POLICY IF EXISTS "Applicants can view their documents" ON public.admission_documents;

DROP POLICY IF EXISTS "Public can upload documents during application" ON public.admission_documents;

-- Admins can manage all documents
CREATE POLICY "Admins can manage admission documents"
ON public.admission_documents
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Applicants can view their own documents
CREATE POLICY "Applicants can view their documents"
ON public.admission_documents
FOR SELECT
TO public
USING (
  application_id IN (
    SELECT id FROM admission_applications
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  )
);

-- Public can insert documents (for application submission)
CREATE POLICY "Public can upload documents during application"
ON public.admission_documents
FOR INSERT
TO public
WITH CHECK (true);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_admission_documents_updated_at ON public.admission_documents;

CREATE TRIGGER update_admission_documents_updated_at
  BEFORE UPDATE ON public.admission_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix 3: Add webhook verification table for Paystack
CREATE TABLE IF NOT EXISTS public.paystack_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  reference TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS for webhook logs (admin only)
ALTER TABLE public.paystack_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.paystack_webhooks;

CREATE POLICY "Admins can view webhook logs"
ON public.paystack_webhooks
FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes
DROP INDEX IF EXISTS idx_paystack_webhooks_reference;

DROP INDEX IF EXISTS idx_paystack_webhooks_processed;

CREATE INDEX idx_paystack_webhooks_reference ON public.paystack_webhooks(reference);

CREATE INDEX idx_paystack_webhooks_processed ON public.paystack_webhooks(processed, created_at);


-- ===== 20251022072146_b91d0dc2-bc7f-4e21-a13f-0a9ffdb55e32.sql =====

-- =========================================
-- PDF OFFER LETTER STORAGE POLICIES
-- =========================================
-- This migration sets up storage policies for offer letter PDFs

-- Ensure admission-documents bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('admission-documents', 'admission-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admins can upload offer letters" ON storage.objects;

DROP POLICY IF EXISTS "Public can view offer letters" ON storage.objects;

DROP POLICY IF EXISTS "Applicants can view their offer letters" ON storage.objects;

-- Admin can upload and manage offer letters
CREATE POLICY "Admins can upload offer letters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'admission-documents' 
  AND (storage.foldername(name))[1] = 'offer-letters'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Public can view offer letters (for email links)
CREATE POLICY "Public can view offer letters"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'offer-letters'
);

-- Admins can delete offer letters
CREATE POLICY "Admins can delete offer letters"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'offer-letters'
  AND has_role(auth.uid(), 'admin'::app_role)
);


-- ===== 20251022083157_fe0ab7ec-dd8b-4dcf-87db-bdff0169ee46.sql =====

-- Fix storage policies for admission-documents bucket to allow public uploads during application

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage admission documents" ON storage.objects;

-- Allow public to upload documents to admission-documents bucket
CREATE POLICY "Public can upload admission documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'admission-documents' AND
  (storage.foldername(name))[1] IS NOT NULL
);

-- Allow public to read documents from admission-documents bucket (already public bucket)
CREATE POLICY "Public can view admission documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'admission-documents');

-- Allow admins to manage all admission documents
CREATE POLICY "Admins can manage admission documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'admission-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'admission-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete admission documents
CREATE POLICY "Admins can delete admission documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'admission-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);


-- ===== 20251022084310_52335fa8-7c1c-4023-a93d-77bf6b254218.sql =====

-- Fix RLS policy on admission_applications that causes "permission denied for table users" error
-- The issue: The policy queries auth.users table which triggers recursive RLS evaluation

-- Drop the problematic policy that queries auth.users
DROP POLICY IF EXISTS "Applicants can view own application" ON admission_applications;

-- Create new policy using auth.email() function instead of querying auth.users table
-- This avoids recursive RLS issues while maintaining security
CREATE POLICY "Authenticated users can view own applications"
ON admission_applications
FOR SELECT
TO authenticated
USING (
  email = auth.email()
);

-- Also ensure public users can submit applications (should already exist but verify)
DROP POLICY IF EXISTS "Public can submit applications" ON admission_applications;

CREATE POLICY "Public can submit applications"
ON admission_applications
FOR INSERT
TO public
WITH CHECK (true);


-- ===== 20251104060835_dd3429c5-0338-48d0-af5e-a603979fd3fd.sql =====

-- Clean up duplicate/conflicting storage policies for admission-documents bucket
-- This removes the less secure policy and keeps the structured one

-- Drop the redundant policy that allows all uploads without folder structure
DROP POLICY IF EXISTS "Public can upload application documents" ON storage.objects;


-- ===== 20251104163628_e80691cd-e6c2-4ba6-962d-d291929cfe90.sql =====

-- Fix RLS policy to allow both public and authenticated users to submit applications
DROP POLICY IF EXISTS "Public can submit applications" ON admission_applications;

-- Create new policy that allows both public and authenticated users to submit
CREATE POLICY "Anyone can submit applications"
ON admission_applications
FOR INSERT
TO public, authenticated
WITH CHECK (true);


-- ===== 20251104163847_4735448f-db89-4dd9-84bf-269be2ff6be9.sql =====

-- Fix admission_applications schema to make application_number auto-generated
-- Update the column to have a default empty string (will be overwritten by trigger)
ALTER TABLE admission_applications 
ALTER COLUMN application_number SET DEFAULT '';


-- ===== 20251117055345_93a4f739-4307-4a18-a3df-f2baff25f065.sql =====

-- Clean up orphaned subject assignments
-- Delete subject assignments without class_id where the teacher has class assignments
DELETE FROM subject_assignments
WHERE class_id IS NULL
AND user_id IN (
  SELECT DISTINCT teacher_id 
  FROM teacher_class_assignments
);


-- ===== 20251117060711_212c55e7-cc1f-4522-9d6f-a54d7c85f118.sql =====

-- Create secure RPC function to manage teacher class assignments
CREATE OR REPLACE FUNCTION public.create_teacher_class_assignments(
  p_teacher_id uuid,
  p_class_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing assignments for this teacher
  DELETE FROM teacher_class_assignments
  WHERE teacher_id = p_teacher_id;
  
  -- Insert new assignments
  INSERT INTO teacher_class_assignments (teacher_id, class_id)
  SELECT p_teacher_id, unnest(p_class_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_teacher_class_assignments(uuid, uuid[]) TO authenticated;

-- Backfill missing class assignments for existing teacher "Sulaimon Ibrahim Semako"
-- This fixes the current issue where teacher has subject_assignments but no teacher_class_assignments
INSERT INTO teacher_class_assignments (teacher_id, class_id)
SELECT '7da1a8c8-8eef-4fa2-a55e-f2b30eb23620'::uuid, unnest(ARRAY[
  '7aa4d643-37bb-4ed3-a95a-448dae49dc05'::uuid,  -- JSS 1
  'd2cd93d4-09e2-414d-bca3-7da88d479330'::uuid   -- JSS 2
])
ON CONFLICT DO NOTHING;


-- ===== 20251119101409_eb7a3f92-fed7-4e91-a372-2f79438c70f1.sql =====

-- ==========================================
-- PHASE 1: Multi-Tenancy Implementation
-- Create schools table and add school_id to all tables
-- ==========================================

-- Create schools table
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#4F46E5',
  secondary_color TEXT DEFAULT '#10B981',
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on schools table
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Create index on subdomain for fast lookups
CREATE INDEX idx_schools_subdomain ON public.schools(subdomain);

CREATE INDEX idx_schools_active ON public.schools(is_active);

-- Add school_id to all relevant tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.question_banks ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.assessment_types ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.gradebook_entries ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.grade_comments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.book_issues ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.academic_calendar ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.class_timetables ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.periods ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.timetable_templates ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.admission_sessions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.admission_applications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Create indexes on school_id columns for performance
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);

CREATE INDEX idx_classes_school_id ON public.classes(school_id);

CREATE INDEX idx_subjects_school_id ON public.subjects(school_id);

CREATE INDEX idx_students_school_id ON public.students(school_id);

CREATE INDEX idx_parents_school_id ON public.parents(school_id);

CREATE INDEX idx_exams_school_id ON public.exams(school_id);

CREATE INDEX idx_questions_school_id ON public.questions(school_id);

CREATE INDEX idx_question_banks_school_id ON public.question_banks(school_id);

CREATE INDEX idx_exam_sessions_school_id ON public.exam_sessions(school_id);

CREATE INDEX idx_announcements_school_id ON public.announcements(school_id);

CREATE INDEX idx_attendance_sessions_school_id ON public.attendance_sessions(school_id);

CREATE INDEX idx_assessments_school_id ON public.assessments(school_id);

CREATE INDEX idx_fee_structures_school_id ON public.fee_structures(school_id);

CREATE INDEX idx_admission_sessions_school_id ON public.admission_sessions(school_id);

CREATE INDEX idx_admission_applications_school_id ON public.admission_applications(school_id);

-- Create helper function to get user's school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create helper function to check if user is super admin (can access all schools)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
    AND (SELECT school_id FROM public.profiles WHERE user_id = auth.uid()) IS NULL
  );
$$;

-- Update trigger for schools table
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for schools table
CREATE POLICY "Super admins can manage all schools"
  ON public.schools FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Users can view their own school"
  ON public.schools FOR SELECT
  USING (id = public.get_user_school_id() OR public.is_super_admin());

-- Create default school for existing data (can be updated later)
INSERT INTO public.schools (name, subdomain, is_active)
VALUES ('Default School', 'default', true)
ON CONFLICT (subdomain) DO NOTHING;

-- Update existing profiles to have the default school_id
UPDATE public.profiles
SET school_id = (SELECT id FROM public.schools WHERE subdomain = 'default')
WHERE school_id IS NULL;

-- Update existing data for all tables to have the default school_id
DO $$
DECLARE
  default_school_id UUID;
BEGIN
  SELECT id INTO default_school_id FROM public.schools WHERE subdomain = 'default';
  
  UPDATE public.classes SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.subjects SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.students SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.parents SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.exams SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.questions SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.question_banks SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.exam_sessions SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.announcements SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.attendance_sessions SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.assessments SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.assessment_types SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grades SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.gradebook_entries SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grade_comments SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.fee_structures SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.fee_payments SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.library_books SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.book_issues SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.academic_calendar SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.admission_sessions SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.admission_applications SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.news_articles SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.gallery SET school_id = default_school_id WHERE school_id IS NULL;
END $$;

-- Make school_id NOT NULL after data migration (except for super admins in profiles)
ALTER TABLE public.classes ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.subjects ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.exams ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.questions ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.question_banks ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.announcements ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_sessions ALTER COLUMN school_id SET NOT NULL;


-- ===== 20251119101445_d72dbc4d-e1eb-4d0a-a955-50ce3d4e9442.sql =====

-- ==========================================
-- PHASE 2: Update RLS Policies for Multi-Tenancy
-- Add school_id filtering to all existing policies
-- ==========================================

-- Drop existing policies that need to be updated with school filtering
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;

DROP POLICY IF EXISTS "Public can view classes for registration" ON public.classes;

DROP POLICY IF EXISTS "Admins can manage all parents" ON public.parents;

DROP POLICY IF EXISTS "Parents can view and update their own profile" ON public.parents;

DROP POLICY IF EXISTS "Teachers can view parents" ON public.parents;

DROP POLICY IF EXISTS "Admins can manage all students" ON public.students;

DROP POLICY IF EXISTS "Students can view their own profile" ON public.students;

DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.students;

DROP POLICY IF EXISTS "Parents can view their children" ON public.parents;

DROP POLICY IF EXISTS "Teachers can manage exams" ON public.exams;

DROP POLICY IF EXISTS "Students can view published exams for their class" ON public.exams;

DROP POLICY IF EXISTS "Teachers can manage exam questions" ON public.questions;

DROP POLICY IF EXISTS "Students can view exam questions during session" ON public.exam_questions;

DROP POLICY IF EXISTS "Admins can manage admission sessions" ON public.admission_sessions;

DROP POLICY IF EXISTS "Public can view active sessions" ON public.admission_sessions;

DROP POLICY IF EXISTS "Admins can update applications" ON public.admission_applications;

DROP POLICY IF EXISTS "Admins can view all applications" ON public.admission_applications;

DROP POLICY IF EXISTS "Anyone can submit applications" ON public.admission_applications;

DROP POLICY IF EXISTS "Authenticated users can view own applications" ON public.admission_applications;

-- Classes: School-aware policies
CREATE POLICY "Admins can manage classes in their school"
  ON public.classes FOR ALL
  USING (
    school_id = public.get_user_school_id() AND is_admin()
    OR public.is_super_admin()
  );

CREATE POLICY "Public can view classes for their school"
  ON public.classes FOR SELECT
  USING (
    school_id = public.get_user_school_id()
    OR is_teacher()
    OR public.is_super_admin()
  );

-- Subjects: School-aware policies
CREATE POLICY "School members can view subjects"
  ON public.subjects FOR SELECT
  USING (
    school_id = public.get_user_school_id()
    OR is_teacher()
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can manage subjects in their school"
  ON public.subjects FOR ALL
  USING (
    school_id = public.get_user_school_id() AND is_admin()
    OR public.is_super_admin()
  );

-- Students: School-aware policies
CREATE POLICY "Students can view their own profile in school"
  ON public.students FOR SELECT
  USING (
    (user_id = auth.uid() AND school_id = public.get_user_school_id())
    OR public.is_super_admin()
  );

CREATE POLICY "Teachers can view students in their school"
  ON public.students FOR SELECT
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can manage students in their school"
  ON public.students FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );

-- Parents: School-aware policies
CREATE POLICY "Parents can manage own profile in school"
  ON public.parents FOR ALL
  USING (
    (user_id = auth.uid() AND school_id = public.get_user_school_id())
    OR public.is_super_admin()
  );

CREATE POLICY "Teachers can view parents in their school"
  ON public.parents FOR SELECT
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

-- Exams: School-aware policies
CREATE POLICY "Teachers can manage exams in their school"
  ON public.exams FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

CREATE POLICY "Students can view published exams in their school"
  ON public.exams FOR SELECT
  USING (
    (status = 'published'::exam_status AND school_id = public.get_user_school_id())
    OR public.is_super_admin()
  );

-- Questions: School-aware policies
CREATE POLICY "Teachers can manage questions in their school"
  ON public.questions FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

CREATE POLICY "Students can view questions during exam in their school"
  ON public.questions FOR SELECT
  USING (
    (school_id = public.get_user_school_id())
    OR public.is_super_admin()
  );

-- Question Banks: School-aware policies
CREATE POLICY "Teachers can manage question banks in their school"
  ON public.question_banks FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

-- Announcements: School-aware policies
CREATE POLICY "School members can view announcements"
  ON public.announcements FOR SELECT
  USING (
    (school_id = public.get_user_school_id() AND is_published = true)
    OR public.is_super_admin()
  );

CREATE POLICY "Teachers can manage announcements in their school"
  ON public.announcements FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_teacher())
    OR public.is_super_admin()
  );

-- Admission Sessions: School-aware policies
CREATE POLICY "Admins can manage admission sessions in their school"
  ON public.admission_sessions FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );

CREATE POLICY "Public can view active sessions for school"
  ON public.admission_sessions FOR SELECT
  USING (
    status = 'active'
  );

-- Admission Applications: School-aware policies
CREATE POLICY "Admins can manage applications in their school"
  ON public.admission_applications FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );

CREATE POLICY "Anyone can submit applications to school"
  ON public.admission_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own applications"
  ON public.admission_applications FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    OR (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );

-- News Articles: School-aware policies
CREATE POLICY "Public can view published news for school"
  ON public.news_articles FOR SELECT
  USING (
    is_published = true
  );

CREATE POLICY "Admins can manage news in their school"
  ON public.news_articles FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );

-- Gallery: School-aware policies
CREATE POLICY "Public can view gallery for school"
  ON public.gallery FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage gallery in their school"
  ON public.gallery FOR ALL
  USING (
    (school_id = public.get_user_school_id() AND is_admin())
    OR public.is_super_admin()
  );


-- ===== 20251119102249_c00b88ee-bd24-4b3e-9d25-4453dda58772.sql =====

-- Make school_id nullable temporarily to allow gradual migration
-- This allows the application to build and run while we update code

ALTER TABLE public.classes ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.subjects ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.exams ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.question_banks ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.questions ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.admission_sessions ALTER COLUMN school_id DROP NOT NULL;


-- ===== 20251119103446_bc6b5ce7-24ec-4014-90c5-1cd47af2a69f.sql =====

-- Phase 1: Super Admin Foundation Functions

-- Function to create/promote a user to super admin
CREATE OR REPLACE FUNCTION public.create_super_admin(admin_user_id UUID)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Set school_id to NULL to make user a super admin
  UPDATE public.profiles 
  SET school_id = NULL 
  WHERE user_id = admin_user_id;
  
  -- Ensure user has admin role
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (admin_user_id, 'admin'::app_role, admin_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Function to check if a user is a super admin (school_id IS NULL)
CREATE OR REPLACE FUNCTION public.is_user_super_admin(check_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = check_user_id 
    AND school_id IS NULL
    AND EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = check_user_id 
      AND role = 'admin'::app_role
    )
  );
$$;

-- Add indexes for better performance on school-related queries
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

CREATE INDEX IF NOT EXISTS idx_schools_subdomain ON public.schools(subdomain);

CREATE INDEX IF NOT EXISTS idx_schools_is_active ON public.schools(is_active);

COMMENT ON FUNCTION public.create_super_admin IS 'Promotes a user to super admin by setting their school_id to NULL';

COMMENT ON FUNCTION public.is_user_super_admin IS 'Checks if a user is a super admin (NULL school_id and admin role)';


-- ===== 20251119133101_6b47a6a3-1704-4e35-90d6-9b7be9d66111.sql =====

-- Promote admin@gmail.com to super admin
-- This sets their school_id to NULL, making them a system-wide super admin
SELECT public.create_super_admin('e6b082bd-8b3b-453f-9e3c-e845a33fde7b');

-- Verify the promotion was successful
SELECT 
  p.user_id,
  p.full_name,
  p.school_id,
  ur.role,
  public.is_user_super_admin(p.user_id) as is_super_admin
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
WHERE p.user_id = 'e6b082bd-8b3b-453f-9e3c-e845a33fde7b';


-- ===== 20251119180701_7e3b3402-c0a0-413d-a235-9a5556f2d11a.sql =====


-- [SKIPPED: legacy/auth-config statement from the old project]


-- ===== 20251119181718_5a84faaa-79bd-41e6-8dc6-828651158bdc.sql =====


-- [SKIPPED: legacy/auth-config statement from the old project]


-- ===== 20251119194640_108b9a3d-a4a5-4d13-9047-fd99f1754ee0.sql =====

-- ============================================================================
-- CRITICAL SECURITY FIX: Enforce School Isolation via RLS Policies
-- This migration prevents cross-school data leaks by adding school_id checks
-- ============================================================================

-- 1. FIX PROFILES TABLE - Teachers can currently see all profiles across schools
DROP POLICY IF EXISTS "Teachers can view profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO public
USING (user_id = auth.uid());

CREATE POLICY "Teachers can view profiles in their school"
ON profiles FOR SELECT
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
  OR user_id = auth.uid()
);

CREATE POLICY "Admins can manage profiles in their school"
ON profiles FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
  OR user_id = auth.uid()
);

-- 2. FIX PARENTS TABLE - Teachers can see all parent data across schools
DROP POLICY IF EXISTS "Teachers can view all parents in their school" ON parents;

CREATE POLICY "Teachers view parents in their school only"
ON parents FOR SELECT
TO public
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
  OR (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM student_parent_relationships spr
    WHERE spr.parent_id = parents.id
    AND spr.student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  ))
);

CREATE POLICY "Admins manage parents in their school"
ON parents FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 3. FIX ACADEMIC_CALENDAR - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage academic calendar" ON academic_calendar;

CREATE POLICY "Admins manage calendar in their school"
ON academic_calendar FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 4. FIX ANNOUNCEMENTS - Teachers/admins can see across schools
DROP POLICY IF EXISTS "Teachers can manage announcements in their school" ON announcements;

DROP POLICY IF EXISTS "School members can view announcements" ON announcements;

CREATE POLICY "Teachers manage announcements in their school"
ON announcements FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

CREATE POLICY "Users view announcements in their school"
ON announcements FOR SELECT
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_published = true)
  OR is_super_admin()
);

-- 5. FIX ASSESSMENT_TYPES - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage assessment types" ON assessment_types;

CREATE POLICY "Teachers manage assessment types in their school"
ON assessment_types FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- 6. FIX ASSESSMENTS - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage assessments" ON assessments;

CREATE POLICY "Teachers manage assessments in their school"
ON assessments FOR ALL
TO authenticated
USING (
  ((school_id = get_user_school_id() AND is_teacher()) OR is_admin())
  OR is_super_admin()
);

-- 7. FIX ATTENDANCE_SESSIONS - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage attendance sessions" ON attendance_sessions;

CREATE POLICY "Teachers manage attendance in their school"
ON attendance_sessions FOR ALL
TO authenticated
USING (
  ((school_id = get_user_school_id() AND is_teacher()) OR is_admin())
  OR is_super_admin()
);

-- 8. FIX BOOK_ISSUES - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage book issues" ON book_issues;

CREATE POLICY "Admins manage book issues in their school"
ON book_issues FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 9. FIX CLASS_TIMETABLES - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage timetables" ON class_timetables;

CREATE POLICY "Admins manage timetables in their school"
ON class_timetables FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 10. FIX EXAM_SESSIONS - Students can access sessions across schools
DROP POLICY IF EXISTS "Students can manage their own sessions" ON exam_sessions;

DROP POLICY IF EXISTS "Teachers can view exam sessions" ON exam_sessions;

CREATE POLICY "Students manage sessions in their school"
ON exam_sessions FOR ALL
TO public
USING (
  student_id = auth.uid()
  AND (school_id = get_user_school_id() OR school_id IS NULL)
);

CREATE POLICY "Teachers view sessions in their school"
ON exam_sessions FOR SELECT
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- 11. FIX FEE_PAYMENTS - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage fee payments" ON fee_payments;

CREATE POLICY "Admins manage fee payments in their school"
ON fee_payments FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 12. FIX FEE_STRUCTURES - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage fee structures" ON fee_structures;

CREATE POLICY "Admins manage fee structures in their school"
ON fee_structures FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- 13. FIX GRADEBOOK_ENTRIES - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage gradebook entries" ON gradebook_entries;

CREATE POLICY "Teachers manage gradebook in their school"
ON gradebook_entries FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- 14. FIX LIBRARY_BOOKS - Missing school_id check
DROP POLICY IF EXISTS "Admins can manage library books" ON library_books;

CREATE POLICY "Admins manage library books in their school"
ON library_books FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

CREATE POLICY "Users view library books in their school"
ON library_books FOR SELECT
TO public
USING (
  school_id = get_user_school_id()
  OR is_super_admin()
  OR school_id IS NULL
);

-- 15. FIX NEWS_ARTICLES - Can view across schools
DROP POLICY IF EXISTS "Admins can manage news in their school" ON news_articles;

DROP POLICY IF EXISTS "Public can view published news for school" ON news_articles;

CREATE POLICY "Admins manage news in their school"
ON news_articles FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

CREATE POLICY "Public views published news for their school"
ON news_articles FOR SELECT
TO public
USING (
  is_published = true
  AND (school_id = get_user_school_id() OR is_super_admin() OR school_id IS NULL)
);

-- 16. FIX GALLERY - Can view across schools
DROP POLICY IF EXISTS "Admins can manage gallery in their school" ON gallery;

DROP POLICY IF EXISTS "Public can view gallery for school" ON gallery;

CREATE POLICY "Admins manage gallery in their school"
ON gallery FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

CREATE POLICY "Public views gallery for their school"
ON gallery FOR SELECT
TO public
USING (
  school_id = get_user_school_id()
  OR is_super_admin()
  OR school_id IS NULL
);

-- 17. FIX GRADE_COMMENTS - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage grade comments" ON grade_comments;

CREATE POLICY "Teachers manage grade comments in their school"
ON grade_comments FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- 18. FIX GRADES - Missing school_id check
DROP POLICY IF EXISTS "Teachers can manage grades" ON grades;

CREATE POLICY "Teachers manage grades in their school"
ON grades FOR ALL
TO authenticated
USING (
  (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
  OR EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = grades.assessment_id
    AND ((a.teacher_id = auth.uid()) OR is_admin())
  )
);

-- 19. ADD HELPER FUNCTION for consistent school checking
CREATE OR REPLACE FUNCTION is_same_school(target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    target_school_id = get_user_school_id()
    OR is_super_admin()
    OR target_school_id IS NULL
$$;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'School isolation RLS policies updated successfully';
  RAISE NOTICE 'All critical cross-school data leaks have been fixed';
END $$;


-- ===== 20251119195040_57a86ddb-6d6b-4e69-ba4e-9e9bf9475018.sql =====

-- Fix Critical Data Leaks: Drop Old Conflicting RLS Policies
-- This removes policies without school_id filtering that allow cross-school access

-- Drop conflicting policies on question_banks (2 policies)
DROP POLICY IF EXISTS "Students can view published question banks" ON question_banks;

DROP POLICY IF EXISTS "Teachers can manage question banks" ON question_banks;

-- Drop conflicting policies on questions (2 policies)
DROP POLICY IF EXISTS "Teachers can manage questions" ON questions;

DROP POLICY IF EXISTS "Students can view questions during exams" ON questions;

-- Drop conflicting policies on students (2 policies)
DROP POLICY IF EXISTS "Teachers and admins can manage students" ON students;

-- Drop conflicting policies on subjects (2 policies)
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

DROP POLICY IF EXISTS "Public can view subjects for registration" ON subjects;


-- ===== 20251119195525_2aa4e244-3d26-48d6-b77f-c45355412d79.sql =====

-- COMPREHENSIVE MULTI-TENANCY FIX: Clean data, add school_id, update RLS policies

-- ============================================================
-- STEP 1: Clean orphaned records
-- ============================================================

-- Delete teacher_class_assignments with invalid class_id
DELETE FROM teacher_class_assignments tca
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = tca.class_id);

-- ============================================================
-- STEP 2: Add school_id columns
-- ============================================================

ALTER TABLE class_assignments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE question_options ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE teacher_class_assignments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE student_parent_relationships ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE periods ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

-- ============================================================
-- STEP 3: Populate school_id from related tables
-- ============================================================

UPDATE class_assignments ca 
SET school_id = c.school_id 
FROM classes c 
WHERE ca.class_id = c.id AND ca.school_id IS NULL;

UPDATE exam_questions eq 
SET school_id = e.school_id 
FROM exams e 
WHERE eq.exam_id = e.id AND eq.school_id IS NULL;

UPDATE question_options qo 
SET school_id = q.school_id 
FROM questions q 
WHERE qo.question_id = q.id AND qo.school_id IS NULL;

UPDATE question_responses qr 
SET school_id = es.school_id 
FROM exam_sessions es 
WHERE qr.session_id = es.id AND qr.school_id IS NULL;

UPDATE student_attendance sa 
SET school_id = s.school_id 
FROM students s 
WHERE sa.student_id = s.id AND sa.school_id IS NULL;

UPDATE subject_assignments sa 
SET school_id = p.school_id 
FROM profiles p 
WHERE sa.user_id = p.user_id AND sa.school_id IS NULL;

UPDATE teacher_class_assignments tca 
SET school_id = c.school_id 
FROM classes c 
WHERE tca.class_id = c.id AND tca.school_id IS NULL;

UPDATE student_parent_relationships spr 
SET school_id = s.school_id 
FROM students s 
WHERE spr.student_id = s.id AND spr.school_id IS NULL;

-- ============================================================
-- STEP 4: Set NOT NULL constraints
-- ============================================================

ALTER TABLE class_assignments ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE exam_questions ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE question_options ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE question_responses ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE student_attendance ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE subject_assignments ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE teacher_class_assignments ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE student_parent_relationships ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- STEP 5: Update ALL RLS Policies with School Filtering
-- ============================================================

-- announcements
DROP POLICY IF EXISTS "Admins and teachers can manage announcements" ON announcements;

DROP POLICY IF EXISTS "Teachers manage announcements in their school" ON announcements;

CREATE POLICY "Teachers manage announcements in their school"
ON announcements FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

-- class_assignments
DROP POLICY IF EXISTS "Admins can manage class assignments" ON class_assignments;

DROP POLICY IF EXISTS "Admins manage class assignments in their school" ON class_assignments;

CREATE POLICY "Admins manage class assignments in their school"
ON class_assignments FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can view their class assignments" ON class_assignments;

DROP POLICY IF EXISTS "Users view class assignments in their school" ON class_assignments;

CREATE POLICY "Users view class assignments in their school"
ON class_assignments FOR SELECT TO authenticated
USING ((auth.uid() = student_id) OR (school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

-- exam_questions
DROP POLICY IF EXISTS "Teachers can manage exam questions" ON exam_questions;

DROP POLICY IF EXISTS "Teachers manage exam questions in their school" ON exam_questions;

CREATE POLICY "Teachers manage exam questions in their school"
ON exam_questions FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

-- question_options
DROP POLICY IF EXISTS "Teachers can manage question options" ON question_options;

DROP POLICY IF EXISTS "Teachers manage question options in their school" ON question_options;

CREATE POLICY "Teachers manage question options in their school"
ON question_options FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

DROP POLICY IF EXISTS "Students can view options during exam" ON question_options;

DROP POLICY IF EXISTS "Students view options during exam in their school" ON question_options;

CREATE POLICY "Students view options during exam in their school"
ON question_options FOR SELECT TO public
USING (
  question_id IN (
    SELECT eq.question_id FROM exam_questions eq
    JOIN exam_sessions es ON es.exam_id = eq.exam_id
    WHERE es.student_id = auth.uid() AND es.status = 'in_progress'
  )
);

-- question_responses
DROP POLICY IF EXISTS "Teachers can view all responses" ON question_responses;

DROP POLICY IF EXISTS "Teachers view responses in their school" ON question_responses;

CREATE POLICY "Teachers view responses in their school"
ON question_responses FOR SELECT TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

DROP POLICY IF EXISTS "Students can manage their own responses" ON question_responses;

DROP POLICY IF EXISTS "Students manage responses in their school" ON question_responses;

CREATE POLICY "Students manage responses in their school"
ON question_responses FOR ALL TO public
USING (
  EXISTS (SELECT 1 FROM exam_sessions es WHERE es.id = question_responses.session_id AND es.student_id = auth.uid())
);

-- student_attendance
DROP POLICY IF EXISTS "Teachers can manage attendance records" ON student_attendance;

DROP POLICY IF EXISTS "Teachers manage attendance in their school" ON student_attendance;

CREATE POLICY "Teachers manage attendance in their school"
ON student_attendance FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

DROP POLICY IF EXISTS "Students and parents can view attendance records" ON student_attendance;

DROP POLICY IF EXISTS "Students/parents view attendance in their school" ON student_attendance;

CREATE POLICY "Students/parents view attendance in their school"
ON student_attendance FOR SELECT TO authenticated
USING (
  (student_id IN (SELECT s.id FROM students s WHERE s.user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM student_parent_relationships spr JOIN parents p ON p.id = spr.parent_id
    WHERE spr.student_id = s.id AND p.user_id = auth.uid()
  )))
  OR (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- subject_assignments
DROP POLICY IF EXISTS "Admins and teachers can manage subject assignments" ON subject_assignments;

DROP POLICY IF EXISTS "Teachers manage subject assignments in their school" ON subject_assignments;

CREATE POLICY "Teachers manage subject assignments in their school"
ON subject_assignments FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_teacher()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can view their subject assignments" ON subject_assignments;

DROP POLICY IF EXISTS "Users view subject assignments in their school" ON subject_assignments;

CREATE POLICY "Users view subject assignments in their school"
ON subject_assignments FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id)
  OR (school_id = get_user_school_id() AND is_teacher())
  OR is_super_admin()
);

-- teacher_class_assignments
DROP POLICY IF EXISTS "Admins can manage teacher class assignments" ON teacher_class_assignments;

DROP POLICY IF EXISTS "Admins manage teacher assignments in their school" ON teacher_class_assignments;

CREATE POLICY "Admins manage teacher assignments in their school"
ON teacher_class_assignments FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

DROP POLICY IF EXISTS "Teachers can view their class assignments" ON teacher_class_assignments;

DROP POLICY IF EXISTS "Teachers view assignments in their school" ON teacher_class_assignments;

CREATE POLICY "Teachers view assignments in their school"
ON teacher_class_assignments FOR SELECT TO authenticated
USING (
  (teacher_id = auth.uid())
  OR (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- student_parent_relationships
DROP POLICY IF EXISTS "Admins can manage family relationships" ON student_parent_relationships;

DROP POLICY IF EXISTS "Admins manage relationships in their school" ON student_parent_relationships;

CREATE POLICY "Admins manage relationships in their school"
ON student_parent_relationships FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

DROP POLICY IF EXISTS "Parents and students can view relationships" ON student_parent_relationships;

DROP POLICY IF EXISTS "Parents/students view relationships in their school" ON student_parent_relationships;

CREATE POLICY "Parents/students view relationships in their school"
ON student_parent_relationships FOR SELECT TO authenticated
USING (
  (EXISTS (SELECT 1 FROM students s WHERE s.id = student_parent_relationships.student_id AND s.user_id = auth.uid()))
  OR (EXISTS (SELECT 1 FROM parents p WHERE p.id = student_parent_relationships.parent_id AND p.user_id = auth.uid()))
  OR (school_id = get_user_school_id() AND is_admin())
  OR is_super_admin()
);

-- periods
DROP POLICY IF EXISTS "Admins manage periods in their school" ON periods;

CREATE POLICY "Admins manage periods in their school"
ON periods FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

DROP POLICY IF EXISTS "School members view periods" ON periods;

CREATE POLICY "School members view periods"
ON periods FOR SELECT TO authenticated
USING ((school_id = get_user_school_id()) OR is_super_admin());

-- rooms
DROP POLICY IF EXISTS "Admins manage rooms in their school" ON rooms;

CREATE POLICY "Admins manage rooms in their school"
ON rooms FOR ALL TO authenticated
USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

DROP POLICY IF EXISTS "School members view rooms" ON rooms;

CREATE POLICY "School members view rooms"
ON rooms FOR SELECT TO authenticated
USING ((school_id = get_user_school_id()) OR is_super_admin());


-- ===== 20251119195804_9969df42-fcd6-4ef1-8bb7-0d04392b9cce.sql =====

-- Make school_id nullable temporarily for incremental code updates
-- This allows existing inserts to work while code is being updated

ALTER TABLE question_responses ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE exam_questions ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE question_options ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE student_attendance ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE class_assignments ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE subject_assignments ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE teacher_class_assignments ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE student_parent_relationships ALTER COLUMN school_id DROP NOT NULL;

-- Add triggers to auto-populate school_id from related tables
CREATE OR REPLACE FUNCTION auto_populate_school_id_question_responses()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT es.school_id INTO NEW.school_id
    FROM exam_sessions es
    WHERE es.id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_auto_school_id_question_responses
BEFORE INSERT ON question_responses
FOR EACH ROW EXECUTE FUNCTION auto_populate_school_id_question_responses();

-- Similar triggers for other tables
CREATE OR REPLACE FUNCTION auto_populate_school_id_exam_questions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT e.school_id INTO NEW.school_id
    FROM exams e
    WHERE e.id = NEW.exam_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_auto_school_id_exam_questions
BEFORE INSERT ON exam_questions
FOR EACH ROW EXECUTE FUNCTION auto_populate_school_id_exam_questions();

CREATE OR REPLACE FUNCTION auto_populate_school_id_question_options()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT q.school_id INTO NEW.school_id
    FROM questions q
    WHERE q.id = NEW.question_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_auto_school_id_question_options
BEFORE INSERT ON question_options
FOR EACH ROW EXECUTE FUNCTION auto_populate_school_id_question_options();


-- ===== 20251120131343_27bb6c5a-7502-4bcc-887b-94af7d933c7b.sql =====

-- Allow public to view classes for registration
DROP POLICY IF EXISTS "Public can view classes for registration" ON classes;

CREATE POLICY "Public can view classes for registration"
ON classes FOR SELECT
TO public
USING (true);

-- Allow public to view subjects for registration
DROP POLICY IF EXISTS "Public can view subjects for registration" ON subjects;

CREATE POLICY "Public can view subjects for registration"
ON subjects FOR SELECT
TO public
USING (true);


-- ===== 20251120133327_9e8876a1-5ada-42bf-951e-0c9180e1b963.sql =====

-- Create trigger function to auto-populate school_id in class_assignments
CREATE OR REPLACE FUNCTION auto_populate_school_id_class_assignments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT c.school_id INTO NEW.school_id
    FROM classes c
    WHERE c.id = NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for class_assignments
CREATE TRIGGER before_insert_class_assignments_school_id
  BEFORE INSERT ON class_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_school_id_class_assignments();

-- Backfill profiles.school_id for students
UPDATE profiles p
SET school_id = (
  SELECT c.school_id 
  FROM class_assignments ca
  JOIN classes c ON c.id = ca.class_id
  WHERE ca.student_id = p.user_id
  LIMIT 1
)
WHERE p.school_id IS NULL 
AND EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.user_id 
  AND ur.role = 'student'
);

-- Backfill class_assignments.school_id
UPDATE class_assignments ca
SET school_id = c.school_id
FROM classes c
WHERE ca.class_id = c.id
AND ca.school_id IS NULL;

-- Backfill students.school_id
UPDATE students s
SET school_id = (
  SELECT c.school_id 
  FROM class_assignments ca
  JOIN classes c ON c.id = ca.class_id
  WHERE ca.student_id = s.user_id
  LIMIT 1
)
WHERE s.school_id IS NULL;


-- ===== 20251201084652_e41a8cf8-4fb5-45c3-9c61-154634a90625.sql =====

-- Add registration_token column to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_token TEXT UNIQUE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_schools_registration_token ON schools(registration_token);

-- Set default school token
UPDATE schools SET registration_token = '4250645' WHERE subdomain = 'default' OR name ILIKE '%albari%';

-- Generate unique tokens for other schools (using last 7 characters of UUID without dashes)
UPDATE schools 
SET registration_token = SUBSTRING(REPLACE(id::text, '-', ''), 1, 7)
WHERE registration_token IS NULL;

-- Add RLS policy to allow public token lookup for active schools only
CREATE POLICY "Public can lookup schools by registration token"
ON schools FOR SELECT
USING (is_active = true);


-- ===== 20251203123841_05a5022a-35a9-4b2c-acc1-73d091be2008.sql =====

-- Add SELECT policy for students to view exam_questions during active exam session
CREATE POLICY "Students can view exam questions during exam session"
ON exam_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions es
    WHERE es.exam_id = exam_questions.exam_id
    AND es.student_id = auth.uid()
    AND es.status IN ('not_started'::session_status, 'in_progress'::session_status)
  )
);

-- Drop the overly broad questions policy
DROP POLICY IF EXISTS "Students can view questions during exam in their school" ON questions;

-- Create a more secure policy that requires an active exam session
CREATE POLICY "Students can view questions during active exam"
ON questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM exam_questions eq
    JOIN exam_sessions es ON es.exam_id = eq.exam_id
    WHERE eq.question_id = questions.id
    AND es.student_id = auth.uid()
    AND es.status IN ('not_started'::session_status, 'in_progress'::session_status)
  )
  OR is_teacher()
  OR is_super_admin()
);


-- ===== 20251203150548_a078016a-df17-47d9-b471-6631def8b616.sql =====

-- Update existing exam_sessions to get school_id from the related exam
UPDATE exam_sessions es
SET school_id = e.school_id
FROM exams e
WHERE es.exam_id = e.id
AND es.school_id IS NULL;

-- Create trigger function to auto-populate school_id from exam
CREATE OR REPLACE FUNCTION populate_exam_session_school_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.exam_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM exams
    WHERE id = NEW.exam_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on exam_sessions
DROP TRIGGER IF EXISTS set_exam_session_school_id ON exam_sessions;

CREATE TRIGGER set_exam_session_school_id
  BEFORE INSERT ON exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION populate_exam_session_school_id();


-- ===== 20251205093001_ff73fa08-5225-4112-93c4-f8e4a2050214.sql =====

-- Fix existing exams where questions_per_student was left at default 20
-- but total_questions is higher (likely unintentional)
UPDATE exams 
SET questions_per_student = total_questions 
WHERE questions_per_student = 20 
  AND total_questions > 20 
  AND questions_per_student != total_questions;


-- ===== 20251212110358_58399314-540f-4f68-849b-1c5e20ec8107.sql =====

-- Change exam_sessions foreign key from CASCADE to SET NULL
-- This preserves student exam results when exams are deleted

-- Drop the existing CASCADE constraint
ALTER TABLE exam_sessions 
DROP CONSTRAINT IF EXISTS exam_sessions_exam_id_fkey;

-- Add new SET NULL constraint - results are preserved but unlinked when exam is deleted
ALTER TABLE exam_sessions 
ADD CONSTRAINT exam_sessions_exam_id_fkey 
FOREIGN KEY (exam_id) 
REFERENCES exams(id) 
ON DELETE SET NULL;


-- ===== 20260104163405_8f79f523-0074-4ae1-b573-c93c41b640e8.sql =====

-- ===== PHASE 1: SECURITY FIXES =====

-- Fix 1: Add RLS policies to password_reset_otps table
CREATE POLICY "Anyone can insert password reset OTPs"
ON public.password_reset_otps FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own OTPs"
ON public.password_reset_otps FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

CREATE POLICY "System can update OTPs"
ON public.password_reset_otps FOR UPDATE
USING (true);

CREATE POLICY "System can delete expired OTPs"
ON public.password_reset_otps FOR DELETE
USING (expires_at < now() OR used = true);

-- Fix 2 & 3: Update functions with search_path security
-- (Note: These are the most commonly called security functions)

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
    AND (SELECT school_id FROM public.profiles WHERE user_id = auth.uid()) IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile without role
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Create role entry in user_roles table (secure storage)
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (
    NEW.id, 
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'student'::app_role),
    NEW.id
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

-- ===== PHASE 1: ADD school_id TO MISSING TABLES =====

-- Add school_id to admission-related tables
ALTER TABLE public.admission_documents 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.admission_exam_assignments 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.admission_interviews 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.admission_offers 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.admission_payments 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.admission_workflow_logs 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.interview_feedback 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.interview_panels 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

-- Add school_id to website-related tables
ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.website_pages 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.website_sections 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

ALTER TABLE public.website_settings 
ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

-- Backfill school_id from related admission_applications
UPDATE public.admission_documents ad
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE ad.application_id = aa.id AND ad.school_id IS NULL;

UPDATE public.admission_exam_assignments aea
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE aea.application_id = aa.id AND aea.school_id IS NULL;

UPDATE public.admission_interviews ai
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE ai.application_id = aa.id AND ai.school_id IS NULL;

UPDATE public.admission_offers ao
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE ao.application_id = aa.id AND ao.school_id IS NULL;

UPDATE public.admission_payments ap
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE ap.application_id = aa.id AND ap.school_id IS NULL;

UPDATE public.admission_workflow_logs awl
SET school_id = aa.school_id
FROM public.admission_applications aa
WHERE awl.application_id = aa.id AND awl.school_id IS NULL;

-- Backfill interview_feedback from interviews
UPDATE public.interview_feedback if_tbl
SET school_id = ai.school_id
FROM public.admission_interviews ai
WHERE if_tbl.interview_id = ai.id AND if_tbl.school_id IS NULL;

UPDATE public.interview_panels ip
SET school_id = ai.school_id
FROM public.admission_interviews ai
WHERE ip.interview_id = ai.id AND ip.school_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admission_documents_school_id ON public.admission_documents(school_id);

CREATE INDEX IF NOT EXISTS idx_admission_exam_assignments_school_id ON public.admission_exam_assignments(school_id);

CREATE INDEX IF NOT EXISTS idx_admission_interviews_school_id ON public.admission_interviews(school_id);

CREATE INDEX IF NOT EXISTS idx_admission_offers_school_id ON public.admission_offers(school_id);

CREATE INDEX IF NOT EXISTS idx_admission_payments_school_id ON public.admission_payments(school_id);

CREATE INDEX IF NOT EXISTS idx_admission_workflow_logs_school_id ON public.admission_workflow_logs(school_id);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_school_id ON public.interview_feedback(school_id);

CREATE INDEX IF NOT EXISTS idx_interview_panels_school_id ON public.interview_panels(school_id);


-- ===== 20260104163429_1cfec246-5c5d-44b5-90f0-acacd067a659.sql =====

-- Fix remaining function search_path issues

CREATE OR REPLACE FUNCTION public.update_admission_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete entries older than 24 hours
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;


-- ===== 20260104165643_12dda477-ed2b-4629-8f38-185abb60ca4c.sql =====

-- =============================================
-- Phase 2.1: Report Card System Enhancement
-- Adds support for TEST 1, TEST 2, EXAM scores,
-- report card comments, and student biometric data
-- =============================================

-- 1. Add assessment type columns to gradebook_entries
ALTER TABLE gradebook_entries 
ADD COLUMN IF NOT EXISTS test1_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS test2_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS exam_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS term VARCHAR(50),
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

-- 2. Add student biometric/attendance fields to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS height DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS section VARCHAR(50);

-- 3. Create report_card_comments table for multi-level comments
CREATE TABLE IF NOT EXISTS report_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  class_teacher_comment TEXT,
  head_teacher_comment TEXT,
  principal_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, term, academic_year)
);

-- 4. Create attendance_summary table for term-based attendance tracking
CREATE TABLE IF NOT EXISTS attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  days_school_opened INTEGER DEFAULT 0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, term, academic_year)
);

-- 5. Create grading_scales table for customizable grading
CREATE TABLE IF NOT EXISTS grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  scale_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gradebook_term ON gradebook_entries(term, academic_year);

CREATE INDEX IF NOT EXISTS idx_report_comments_lookup ON report_card_comments(student_id, class_id, term, academic_year);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_lookup ON attendance_summary(student_id, class_id, term, academic_year);

-- 7. Enable RLS on new tables
ALTER TABLE report_card_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;

ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for report_card_comments
CREATE POLICY "Users can view report card comments for their school"
ON report_card_comments FOR SELECT
USING (school_id = get_user_school_id());

CREATE POLICY "Teachers and admins can insert report card comments"
ON report_card_comments FOR INSERT
WITH CHECK (
  school_id = get_user_school_id()
  AND (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Teachers and admins can update report card comments"
ON report_card_comments FOR UPDATE
USING (
  school_id = get_user_school_id()
  AND (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can delete report card comments"
ON report_card_comments FOR DELETE
USING (
  school_id = get_user_school_id()
  AND has_role(auth.uid(), 'admin')
);

-- 9. RLS policies for attendance_summary
CREATE POLICY "Users can view attendance summary for their school"
ON attendance_summary FOR SELECT
USING (school_id = get_user_school_id());

CREATE POLICY "Teachers and admins can insert attendance summary"
ON attendance_summary FOR INSERT
WITH CHECK (
  school_id = get_user_school_id()
  AND (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Teachers and admins can update attendance summary"
ON attendance_summary FOR UPDATE
USING (
  school_id = get_user_school_id()
  AND (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can delete attendance summary"
ON attendance_summary FOR DELETE
USING (
  school_id = get_user_school_id()
  AND has_role(auth.uid(), 'admin')
);

-- 10. RLS policies for grading_scales
CREATE POLICY "Users can view grading scales for their school"
ON grading_scales FOR SELECT
USING (school_id = get_user_school_id() OR school_id IS NULL);

CREATE POLICY "Admins can insert grading scales"
ON grading_scales FOR INSERT
WITH CHECK (
  school_id = get_user_school_id()
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update grading scales"
ON grading_scales FOR UPDATE
USING (
  school_id = get_user_school_id()
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete grading scales"
ON grading_scales FOR DELETE
USING (
  school_id = get_user_school_id()
  AND has_role(auth.uid(), 'admin')
);

-- 11. Insert default grading scale (Al-Bari A-F format)
INSERT INTO grading_scales (id, school_id, name, is_default, scale_data)
VALUES (
  gen_random_uuid(),
  NULL,
  'Al-Bari Primary (A-F)',
  true,
  '[
    {"grade": "A", "min": 70, "max": 100, "remark": "Excellent"},
    {"grade": "B", "min": 60, "max": 69, "remark": "Very Good"},
    {"grade": "C", "min": 50, "max": 59, "remark": "Good"},
    {"grade": "D", "min": 40, "max": 49, "remark": "Pass"},
    {"grade": "E", "min": 30, "max": 39, "remark": "Poor"},
    {"grade": "F", "min": 0, "max": 29, "remark": "Fail"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- 12. Trigger for updated_at on report_card_comments
CREATE TRIGGER update_report_card_comments_updated_at
BEFORE UPDATE ON report_card_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 13. Trigger for updated_at on attendance_summary
CREATE TRIGGER update_attendance_summary_updated_at
BEFORE UPDATE ON attendance_summary
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 14. Trigger for updated_at on grading_scales
CREATE TRIGGER update_grading_scales_updated_at
BEFORE UPDATE ON grading_scales
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===== 20260104170925_99f41150-8543-4a14-b2f7-abb7b69890cf.sql =====

-- Create notification templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  name TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sms', 'email')),
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification queue table
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  template_id UUID REFERENCES public.notification_templates(id),
  recipient_type VARCHAR(50),
  recipients JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create student ID cards table for tracking generated cards
CREATE TABLE IF NOT EXISTS public.student_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id),
  student_id UUID NOT NULL,
  card_number VARCHAR(50) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_templates
CREATE POLICY "Users can view notification templates from their school" ON public.notification_templates
  FOR SELECT USING (is_same_school(school_id));

CREATE POLICY "Admins can manage notification templates" ON public.notification_templates
  FOR ALL USING (is_admin() AND is_same_school(school_id));

-- RLS Policies for notification_queue
CREATE POLICY "Users can view notification queue from their school" ON public.notification_queue
  FOR SELECT USING (is_same_school(school_id));

CREATE POLICY "Admins can manage notification queue" ON public.notification_queue
  FOR ALL USING (is_admin() AND is_same_school(school_id));

-- RLS Policies for student_id_cards
CREATE POLICY "Users can view student ID cards from their school" ON public.student_id_cards
  FOR SELECT USING (is_same_school(school_id));

CREATE POLICY "Admins can manage student ID cards" ON public.student_id_cards
  FOR ALL USING (is_admin() AND is_same_school(school_id));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_templates_school ON public.notification_templates(school_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_school ON public.notification_queue(school_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);

CREATE INDEX IF NOT EXISTS idx_student_id_cards_school ON public.student_id_cards(school_id);

CREATE INDEX IF NOT EXISTS idx_student_id_cards_student ON public.student_id_cards(student_id);


-- ===== 20260104172902_f43e9608-277b-4718-9a3b-95af90a7b9de.sql =====

-- Create push_subscriptions table for PWA push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  subscription JSONB NOT NULL,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ===== 20260104174340_d463b5dd-db51-4931-9722-1fe19e742daa.sql =====

-- Drop tables if they were partially created
DROP TABLE IF EXISTS fee_reminder_logs CASCADE;

DROP TABLE IF EXISTS fee_installments CASCADE;

DROP TABLE IF EXISTS fee_installment_plans CASCADE;

DROP TABLE IF EXISTS staff_attendance CASCADE;

DROP TABLE IF EXISTS staff_details CASCADE;

DROP TABLE IF EXISTS promotion_history CASCADE;

-- Student Promotion History
CREATE TABLE promotion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  from_class_id UUID REFERENCES classes(id),
  to_class_id UUID REFERENCES classes(id),
  academic_year VARCHAR(20) NOT NULL,
  promotion_type VARCHAR(20) NOT NULL CHECK (promotion_type IN ('promoted', 'repeated', 'graduated', 'transferred')),
  promoted_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Details
CREATE TABLE staff_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  school_id UUID REFERENCES schools(id),
  employee_id VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  join_date DATE,
  qualifications JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  bank_details JSONB DEFAULT '{}',
  salary DECIMAL(10,2),
  employment_type VARCHAR(20) DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on-leave', 'terminated')),
  emergency_contact JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Attendance
CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id),
  staff_id UUID NOT NULL,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'half-day', 'late')),
  leave_type VARCHAR(50),
  notes TEXT,
  marked_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Fee Installment Plans
CREATE TABLE fee_installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  fee_structure_id UUID REFERENCES fee_structures(id),
  total_amount DECIMAL(10,2) NOT NULL,
  number_of_installments INTEGER NOT NULL,
  start_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Installments
CREATE TABLE fee_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES fee_installment_plans(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id),
  installment_number INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  payment_id UUID REFERENCES fee_payments(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Reminders Log
CREATE TABLE fee_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  installment_id UUID REFERENCES fee_installments(id),
  fee_structure_id UUID REFERENCES fee_structures(id),
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('email', 'sms', 'push')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT
);

-- Enable RLS on all new tables
ALTER TABLE promotion_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff_details ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE fee_installment_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;

ALTER TABLE fee_reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotion_history
CREATE POLICY "Users can view promotion history for their school" ON promotion_history
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage promotion history" ON promotion_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for staff_details
CREATE POLICY "Users can view staff details for their school" ON staff_details
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can manage staff details" ON staff_details
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid()
  );

-- RLS Policies for staff_attendance
CREATE POLICY "Users can view staff attendance for their school" ON staff_attendance
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage staff attendance" ON staff_attendance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for fee_installment_plans
CREATE POLICY "Users can view fee installment plans for their school" ON fee_installment_plans
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage fee installment plans" ON fee_installment_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for fee_installments
CREATE POLICY "Users can view fee installments for their school" ON fee_installments
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage fee installments" ON fee_installments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for fee_reminder_logs
CREATE POLICY "Admins can view fee reminder logs" ON fee_reminder_logs
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert fee reminder logs" ON fee_reminder_logs
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_promotion_history_school ON promotion_history(school_id);

CREATE INDEX idx_promotion_history_student ON promotion_history(student_id);

CREATE INDEX idx_staff_details_school ON staff_details(school_id);

CREATE INDEX idx_staff_details_user ON staff_details(user_id);

CREATE INDEX idx_staff_attendance_school ON staff_attendance(school_id);

CREATE INDEX idx_staff_attendance_date ON staff_attendance(date);

CREATE INDEX idx_fee_installment_plans_school ON fee_installment_plans(school_id);

CREATE INDEX idx_fee_installment_plans_student ON fee_installment_plans(student_id);

CREATE INDEX idx_fee_installments_plan ON fee_installments(plan_id);

CREATE INDEX idx_fee_installments_due_date ON fee_installments(due_date);

CREATE INDEX idx_fee_reminder_logs_school ON fee_reminder_logs(school_id);


-- ===== 20260607202400_dbfd647c-84c3-4b9c-9b0e-b4c5e5e18c39.sql =====

-- ============================================================
-- 1. Backfill orphan school_id values (defensive — current data shows 0)
-- ============================================================
UPDATE public.admission_applications a
SET school_id = c.school_id
FROM public.classes c
WHERE a.school_id IS NULL AND a.applying_for_class_id = c.id;

UPDATE public.admission_applications
SET school_id = (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
WHERE school_id IS NULL;

UPDATE public.admission_documents d
SET school_id = a.school_id
FROM public.admission_applications a
WHERE d.school_id IS NULL AND d.application_id = a.id;

UPDATE public.admission_payments p
SET school_id = a.school_id
FROM public.admission_applications a
WHERE p.school_id IS NULL AND p.application_id = a.id;

UPDATE public.admission_offers o
SET school_id = a.school_id
FROM public.admission_applications a
WHERE o.school_id IS NULL AND o.application_id = a.id;

UPDATE public.admission_interviews i
SET school_id = a.school_id
FROM public.admission_applications a
WHERE i.school_id IS NULL AND i.application_id = a.id;

UPDATE public.admission_workflow_logs w
SET school_id = a.school_id
FROM public.admission_applications a
WHERE w.school_id IS NULL AND w.application_id = a.id;

-- ============================================================
-- 2. Enforce NOT NULL school_id on the whole admission stack
-- ============================================================
ALTER TABLE public.admission_applications  ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_documents     ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_payments      ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_offers        ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_interviews    ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.admission_workflow_logs ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- 3. Auto-populate school_id triggers for child tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_populate_school_id_admission_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.application_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM public.admission_applications
    WHERE id = NEW.application_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admission_documents_school_id ON public.admission_documents;

CREATE TRIGGER trg_admission_documents_school_id
  BEFORE INSERT ON public.admission_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_payments_school_id ON public.admission_payments;

CREATE TRIGGER trg_admission_payments_school_id
  BEFORE INSERT ON public.admission_payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_offers_school_id ON public.admission_offers;

CREATE TRIGGER trg_admission_offers_school_id
  BEFORE INSERT ON public.admission_offers
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_interviews_school_id ON public.admission_interviews;

CREATE TRIGGER trg_admission_interviews_school_id
  BEFORE INSERT ON public.admission_interviews
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_workflow_logs_school_id ON public.admission_workflow_logs;

CREATE TRIGGER trg_admission_workflow_logs_school_id
  BEFORE INSERT ON public.admission_workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

-- ============================================================
-- 4. Clean up duplicate / leaky RLS policies
-- ============================================================
-- admission_documents
DROP POLICY IF EXISTS "Admins can manage admission documents" ON public.admission_documents;

DROP POLICY IF EXISTS "Admins can manage documents"          ON public.admission_documents;

DROP POLICY IF EXISTS "Public can upload documents during application" ON public.admission_documents;

DROP POLICY IF EXISTS "Public can upload documents"          ON public.admission_documents;

CREATE POLICY "Admins manage docs in their school"
  ON public.admission_documents
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

CREATE POLICY "Public can upload docs during application"
  ON public.admission_documents
  FOR INSERT
  WITH CHECK (true);

-- admission_payments
DROP POLICY IF EXISTS "Admins can manage payments" ON public.admission_payments;

CREATE POLICY "Admins manage payments in their school"
  ON public.admission_payments
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_offers
DROP POLICY IF EXISTS "Admins can manage offers" ON public.admission_offers;

CREATE POLICY "Admins manage offers in their school"
  ON public.admission_offers
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_interviews
DROP POLICY IF EXISTS "Admins can manage interviews" ON public.admission_interviews;

CREATE POLICY "Admins manage interviews in their school"
  ON public.admission_interviews
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_workflow_logs (tighten admin scope too)
DROP POLICY IF EXISTS "Admins can view workflow logs"  ON public.admission_workflow_logs;

DROP POLICY IF EXISTS "Admins can create workflow logs" ON public.admission_workflow_logs;

CREATE POLICY "Admins view workflow logs in their school"
  ON public.admission_workflow_logs
  FOR SELECT
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

CREATE POLICY "Admins create workflow logs in their school"
  ON public.admission_workflow_logs
  FOR INSERT
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- ============================================================
-- 5. Secure RPC: submit_admission_application (public-callable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_class_id  uuid;
  v_session_id uuid;
  v_new_id    uuid;
  v_app_no    text;
BEGIN
  v_class_id   := NULLIF(payload->>'applying_for_class_id','')::uuid;
  v_session_id := NULLIF(payload->>'session_id','')::uuid;

  -- Resolve school_id: class -> session -> first active session -> error
  IF v_class_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.classes WHERE id = v_class_id;
  END IF;

  IF v_school_id IS NULL AND v_session_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.admission_sessions WHERE id = v_session_id;
  END IF;

  IF v_school_id IS NULL THEN
    SELECT school_id INTO v_school_id
    FROM public.admission_sessions
    WHERE status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine school for application. Please contact the school.';
  END IF;

  INSERT INTO public.admission_applications (
    application_number, school_id, status,
    first_name, middle_name, last_name,
    date_of_birth, gender, blood_group,
    state_of_origin, lga, nationality, religion,
    email, phone, address,
    previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs
  ) VALUES (
    '', v_school_id, 'submitted',
    payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date,
    payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga',
    COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion',
    payload->>'email', payload->>'phone',
    COALESCE(payload->'address', '{}'::jsonb),
    payload->>'previous_school', payload->>'previous_class',
    v_class_id,
    COALESCE(payload->'parent_guardian_info', '{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs'
  )
  RETURNING id, application_number INTO v_new_id, v_app_no;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'application_number', v_app_no,
    'school_id', v_school_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_admission_application(jsonb) TO anon, authenticated;

-- ============================================================
-- 6. Secure RPC: get_application_tracking (public-callable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_application_tracking(p_app_no text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'application_number', a.application_number,
    'first_name', a.first_name,
    'last_name', a.last_name,
    'email', a.email,
    'status', a.status,
    'application_date', a.application_date,
    'applying_for_class_id', a.applying_for_class_id,
    'class_name', c.name,
    'school_id', a.school_id,
    'school_name', s.name,
    'offer', (
      SELECT jsonb_build_object(
        'id', o.id, 'status', o.status,
        'offer_date', o.offer_date, 'response_deadline', o.response_deadline
      )
      FROM public.admission_offers o
      WHERE o.application_id = a.id
      ORDER BY o.created_at DESC LIMIT 1
    ),
    'payment', (
      SELECT jsonb_build_object(
        'id', p.id, 'status', p.status, 'amount', p.amount
      )
      FROM public.admission_payments p
      WHERE p.application_id = a.id
      ORDER BY p.created_at DESC LIMIT 1
    )
  ) INTO v_app
  FROM public.admission_applications a
  LEFT JOIN public.classes c ON c.id = a.applying_for_class_id
  LEFT JOIN public.schools s ON s.id = a.school_id
  WHERE lower(a.application_number) = lower(p_app_no)
    AND lower(a.email)              = lower(p_email);

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_app;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_tracking(text, text) TO anon, authenticated;

-- ============================================================
-- 7. Secure RPC: transition_admission_status (admin-only state machine)
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_admission_status(
  p_application_id uuid,
  p_new_status     admission_status,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current admission_status;
  v_school  uuid;
  v_allowed boolean := false;
BEGIN
  SELECT status, school_id INTO v_current, v_school
  FROM public.admission_applications
  WHERE id = p_application_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF NOT (is_super_admin() OR (is_admin() AND v_school = get_user_school_id())) THEN
    RAISE EXCEPTION 'Not authorized to update this application';
  END IF;

  -- State machine
  v_allowed := CASE
    WHEN p_new_status = 'withdrawn' THEN true
    WHEN v_current = 'submitted'             AND p_new_status IN ('under_review','rejected') THEN true
    WHEN v_current = 'under_review'          AND p_new_status IN ('interview_scheduled','accepted','rejected') THEN true
    WHEN v_current = 'interview_scheduled'   AND p_new_status IN ('accepted','rejected') THEN true
    WHEN v_current = 'accepted'              AND p_new_status = 'payment_pending' THEN true
    WHEN v_current = 'payment_pending'       AND p_new_status = 'enrolled' THEN true
    WHEN v_current = p_new_status            THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_current, p_new_status;
  END IF;

  UPDATE public.admission_applications
  SET status = p_new_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = COALESCE(p_notes, review_notes),
      updated_at = now()
  WHERE id = p_application_id;

  -- workflow log (trigger log_admission_status_change should also fire)
  INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes, school_id)
  VALUES (p_application_id, v_current::text, p_new_status::text, auth.uid(), p_notes, v_school)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'from', v_current, 'to', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_admission_status(uuid, admission_status, text) TO authenticated;


-- ===== 20260615055453_685bca9f-2ce5-4133-b653-b97e9b875f6d.sql =====

-- A. Helper to fetch current user's email without exposing auth.users via RLS subqueries
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email() TO authenticated, anon;

-- Rewrite policies that referenced auth.users directly

-- admission_applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.admission_applications;

CREATE POLICY "Users can view own applications"
ON public.admission_applications
FOR SELECT
USING (
  email = public.get_user_email()
  OR (school_id = public.get_user_school_id() AND public.is_admin())
  OR public.is_super_admin()
);

-- admission_interviews
DROP POLICY IF EXISTS "Applicants can view their interviews" ON public.admission_interviews;

CREATE POLICY "Applicants can view their interviews"
ON public.admission_interviews
FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = public.get_user_email()
  )
);

-- admission_payments
DROP POLICY IF EXISTS "Applicants can view their payments" ON public.admission_payments;

CREATE POLICY "Applicants can view their payments"
ON public.admission_payments
FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = public.get_user_email()
  )
);

-- admission_exam_assignments
DROP POLICY IF EXISTS "Applicants can view their exam assignments" ON public.admission_exam_assignments;

CREATE POLICY "Applicants can view their exam assignments"
ON public.admission_exam_assignments
FOR SELECT
USING (
  application_id IN (
    SELECT id FROM public.admission_applications
    WHERE email = public.get_user_email()
  )
);

-- B. Harden application-number trigger to fire on empty strings too
DROP TRIGGER IF EXISTS set_application_number ON public.admission_applications;

CREATE TRIGGER set_application_number
BEFORE INSERT ON public.admission_applications
FOR EACH ROW
WHEN (NEW.application_number IS NULL OR NEW.application_number = '')
EXECUTE FUNCTION public.generate_application_number();

-- Update submission RPC to insert NULL so trigger always runs
CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_school_id uuid;
  v_class_id  uuid;
  v_session_id uuid;
  v_new_id    uuid;
  v_app_no    text;
BEGIN
  v_class_id   := NULLIF(payload->>'applying_for_class_id','')::uuid;
  v_session_id := NULLIF(payload->>'session_id','')::uuid;

  IF v_class_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.classes WHERE id = v_class_id;
  END IF;

  IF v_school_id IS NULL AND v_session_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.admission_sessions WHERE id = v_session_id;
  END IF;

  IF v_school_id IS NULL THEN
    SELECT school_id INTO v_school_id
    FROM public.admission_sessions
    WHERE status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine school for application. Please contact the school.';
  END IF;

  INSERT INTO public.admission_applications (
    application_number, school_id, status,
    first_name, middle_name, last_name,
    date_of_birth, gender, blood_group,
    state_of_origin, lga, nationality, religion,
    email, phone, address,
    previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs
  ) VALUES (
    NULL, v_school_id, 'submitted',
    payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date,
    payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga',
    COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion',
    payload->>'email', payload->>'phone',
    COALESCE(payload->'address', '{}'::jsonb),
    payload->>'previous_school', payload->>'previous_class',
    v_class_id,
    COALESCE(payload->'parent_guardian_info', '{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs'
  )
  RETURNING id, application_number INTO v_new_id, v_app_no;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'application_number', v_app_no,
    'school_id', v_school_id
  );
END;
$function$;

-- C. Backfill blank application numbers
UPDATE public.admission_applications
SET application_number = 'APP' || to_char(now(),'YYYY') || '-' ||
    lpad(nextval('admission_app_seq')::text, 6, '0')
WHERE application_number IS NULL OR application_number = '';


-- ===== 20260615204435_af19a0be-e9a9-49b4-b40e-c52194bc8ce8.sql =====

-- ============================================================
-- ACADEMIC FLOW OVERHAUL — Phase 1: Sessions/Terms spine,
-- assessment categories, question taxonomy, unified results view
-- ============================================================

-- 1) admission_sessions: mark a current session per school
ALTER TABLE public.admission_sessions
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS admission_sessions_one_current_per_school
  ON public.admission_sessions(school_id)
  WHERE is_current = true;

-- 2) Term + session linkage on exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.admission_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS term text CHECK (term IN ('first','second','third')),
  ADD COLUMN IF NOT EXISTS assessment_category text
    CHECK (assessment_category IN ('test1','test2','exam','ca','mock','other'));

CREATE INDEX IF NOT EXISTS exams_session_term_idx ON public.exams(session_id, term);

CREATE INDEX IF NOT EXISTS exams_subject_class_idx ON public.exams(subject_id, class_id);

-- 3) Term + session linkage on gradebook_entries (already has term/academic_year text)
ALTER TABLE public.gradebook_entries
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.admission_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gradebook_entries_session_term_idx
  ON public.gradebook_entries(session_id, term);

-- Backfill session_id from academic_year text where possible
UPDATE public.gradebook_entries ge
SET session_id = s.id
FROM public.admission_sessions s
WHERE ge.session_id IS NULL
  AND ge.school_id = s.school_id
  AND ge.academic_year IS NOT NULL
  AND (s.academic_year = ge.academic_year OR s.session_name = ge.academic_year);

-- 4) Question taxonomy: topic + tags + direct subject_id
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS questions_subject_class_idx ON public.questions(subject_id, class_id);

CREATE INDEX IF NOT EXISTS questions_topic_idx ON public.questions(topic);

CREATE INDEX IF NOT EXISTS questions_tags_gin ON public.questions USING GIN (tags);

-- Backfill questions.subject_id from question_banks
UPDATE public.questions q
SET subject_id = qb.subject_id
FROM public.question_banks qb
WHERE q.subject_id IS NULL
  AND q.question_bank_id = qb.id
  AND qb.subject_id IS NOT NULL;

-- 5) Helper: get current session for a school
CREATE OR REPLACE FUNCTION public.get_current_session(p_school_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.admission_sessions
  WHERE school_id = p_school_id AND is_current = true
  LIMIT 1
$$;

-- 6) Fix existing SECURITY DEFINER functions missing search_path (safe hardening)
CREATE OR REPLACE FUNCTION public.grade_question_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  question_record RECORD;
  is_answer_correct BOOLEAN := false;
  points_to_award INTEGER := 0;
BEGIN
  SELECT q.*, eq.points INTO question_record
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  JOIN public.exam_sessions es ON es.exam_id = eq.exam_id
  WHERE q.id = NEW.question_id AND es.id = NEW.session_id;

  IF question_record.question_type IN ('mcq', 'true_false') THEN
    SELECT is_correct INTO is_answer_correct
    FROM public.question_options
    WHERE id = NEW.selected_option_id;
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  ELSIF question_record.question_type = 'fill_blank' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.question_options qo
      WHERE qo.question_id = NEW.question_id
      AND qo.is_correct = true
      AND LOWER(TRIM(qo.option_text)) = LOWER(TRIM(NEW.text_answer))
    ) INTO is_answer_correct;
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  END IF;

  NEW.is_correct := is_answer_correct;
  NEW.points_earned := points_to_award;
  RETURN NEW;
END;
$function$;

-- 7) Unified results view
-- Combines manual gradebook_entries (test1/test2/exam_score) with online
-- exam_sessions (mapped via exams.assessment_category).
CREATE OR REPLACE VIEW public.v_student_term_scores AS
WITH online_scores AS (
  SELECT
    es.student_id,
    e.school_id,
    e.session_id,
    e.term,
    e.class_id,
    e.subject_id,
    e.assessment_category,
    es.percentage,
    es.total_score,
    es.max_score
  FROM public.exam_sessions es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE es.status = 'completed'
    AND e.assessment_category IN ('test1','test2','exam')
    AND e.session_id IS NOT NULL
    AND e.term IS NOT NULL
),
online_pivot AS (
  SELECT
    student_id, school_id, session_id, term, class_id, subject_id,
    MAX(CASE WHEN assessment_category = 'test1'
        THEN ROUND((percentage * 20.0 / 100.0)::numeric, 2) END) AS o_test1,
    MAX(CASE WHEN assessment_category = 'test2'
        THEN ROUND((percentage * 20.0 / 100.0)::numeric, 2) END) AS o_test2,
    MAX(CASE WHEN assessment_category = 'exam'
        THEN ROUND((percentage * 60.0 / 100.0)::numeric, 2) END) AS o_exam
  FROM online_scores
  GROUP BY student_id, school_id, session_id, term, class_id, subject_id
),
manual AS (
  SELECT
    student_id, school_id, session_id, term, class_id, subject_id,
    MAX(test1_score) AS m_test1,
    MAX(test2_score) AS m_test2,
    MAX(exam_score)  AS m_exam
  FROM public.gradebook_entries
  WHERE session_id IS NOT NULL AND term IS NOT NULL
  GROUP BY student_id, school_id, session_id, term, class_id, subject_id
),
combined AS (
  SELECT
    COALESCE(m.student_id, o.student_id)   AS student_id,
    COALESCE(m.school_id, o.school_id)     AS school_id,
    COALESCE(m.session_id, o.session_id)   AS session_id,
    COALESCE(m.term, o.term)               AS term,
    COALESCE(m.class_id, o.class_id)       AS class_id,
    COALESCE(m.subject_id, o.subject_id)   AS subject_id,
    COALESCE(m.m_test1, o.o_test1, 0)::numeric AS test1,
    COALESCE(m.m_test2, o.o_test2, 0)::numeric AS test2,
    COALESCE(m.m_exam,  o.o_exam,  0)::numeric AS exam_score
  FROM manual m
  FULL OUTER JOIN online_pivot o
    ON m.student_id = o.student_id
   AND m.session_id = o.session_id
   AND m.term       = o.term
   AND m.subject_id = o.subject_id
)
SELECT
  c.*,
  (c.test1 + c.test2 + c.exam_score)::numeric AS total,
  RANK() OVER (
    PARTITION BY c.school_id, c.session_id, c.term, c.class_id, c.subject_id
    ORDER BY (c.test1 + c.test2 + c.exam_score) DESC
  ) AS subject_position
FROM combined c;

GRANT SELECT ON public.v_student_term_scores TO authenticated;

GRANT ALL    ON public.v_student_term_scores TO service_role;


-- ===== 20260615204455_f41c9c47-8e6d-401b-82d6-86060bd17db2.sql =====

ALTER VIEW public.v_student_term_scores SET (security_invoker = on);


-- ===== 20260616205302_02a42cd8-6a8b-48c8-8868-0b7cb60bf050.sql =====

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url text;


-- ===== 20260616211417_a9fcdb16-2bb5-4f98-8023-3cbbe9fc85a1.sql =====

-- Fix policy that referenced auth.users directly (caused "permission denied for table users")
DROP POLICY IF EXISTS "Users can view their own application documents" ON storage.objects;

CREATE POLICY "Users can view their own application documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'admission-documents' AND (
    EXISTS (
      SELECT 1 FROM public.admission_applications aa
      WHERE aa.email = public.get_user_email()
        AND (storage.foldername(objects.name))[1] = aa.id::text
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Admin-scoped policies for the students/ folder
DROP POLICY IF EXISTS "Admins manage student photos" ON storage.objects;

CREATE POLICY "Admins manage student photos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'students'
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'students'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);


-- ===== 20260616214332_2a34b06e-e719-4905-8179-c21df91a34a2.sql =====

-- 1) Allow admission_number to be NULL so new students can exist before assignment
ALTER TABLE public.students ALTER COLUMN admission_number DROP NOT NULL;

-- 2) Security-definer helpers that bypass RLS to break recursion cycles
CREATE OR REPLACE FUNCTION public.is_my_student_record(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = _student_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_my_parent_record(_parent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parents WHERE id = _parent_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_parent_relationships spr
    JOIN public.parents p ON p.id = spr.parent_id
    WHERE spr.student_id = _student_id AND p.user_id = auth.uid()
  )
$$;

-- 3) Rebuild recursive policies

-- students: replace recursive parent-view policy
DROP POLICY IF EXISTS "Parents can view their children's profiles" ON public.students;
CREATE POLICY "Parents can view their children's profiles"
ON public.students FOR SELECT
USING (public.is_parent_of_student(id));

-- student_parent_relationships: collapse duplicate recursive policies
DROP POLICY IF EXISTS "Parents/students view relationships in their school" ON public.student_parent_relationships;

DROP POLICY IF EXISTS "Users can view their family relationships" ON public.student_parent_relationships;

CREATE POLICY "Family and admins view relationships"
ON public.student_parent_relationships FOR SELECT
USING (
  public.is_my_student_record(student_id)
  OR public.is_my_parent_record(parent_id)
  OR ((school_id = public.get_user_school_id()) AND public.is_admin())
  OR public.is_super_admin()
);

-- parents: remove the policy that recursively queried students
DROP POLICY IF EXISTS "Teachers view parents in their school only" ON public.parents;

CREATE POLICY "Teachers and family view parents in their school"
ON public.parents FOR SELECT
USING (
  ((school_id = public.get_user_school_id()) AND public.is_teacher())
  OR public.is_super_admin()
  OR (user_id = auth.uid())
);


-- ===== 20260704093332_5dd8479f-650d-4e67-9783-5c2242ecf62a.sql =====

CREATE UNIQUE INDEX IF NOT EXISTS gradebook_entries_term_key
ON public.gradebook_entries (school_id, student_id, subject_id, class_id, session_id, term)
WHERE session_id IS NOT NULL AND term IS NOT NULL;


-- ===== 20260704095039_aca8bdcc-3a3e-4853-9f1e-4882df5175bf.sql =====

-- 1. Fix the upsert-blocking partial index
DROP INDEX IF EXISTS public.gradebook_entries_term_key;

DROP INDEX IF EXISTS public.gradebook_entries_manual_key;

DELETE FROM public.gradebook_entries a
USING public.gradebook_entries b
WHERE a.ctid < b.ctid
  AND a.school_id IS NOT DISTINCT FROM b.school_id
  AND a.student_id IS NOT DISTINCT FROM b.student_id
  AND a.subject_id IS NOT DISTINCT FROM b.subject_id
  AND a.class_id   IS NOT DISTINCT FROM b.class_id
  AND a.session_id IS NOT DISTINCT FROM b.session_id
  AND a.term       IS NOT DISTINCT FROM b.term;

CREATE UNIQUE INDEX gradebook_entries_manual_key
  ON public.gradebook_entries (school_id, student_id, subject_id, class_id, session_id, term);

-- 2. Result automation settings (one row per school)
CREATE TABLE IF NOT EXISTS public.result_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  min_promotion_average numeric NOT NULL DEFAULT 40,
  below_max numeric NOT NULL DEFAULT 39,
  average_max numeric NOT NULL DEFAULT 59,
  above_max numeric NOT NULL DEFAULT 74,
  principal_remark_below text NOT NULL DEFAULT 'Below Average. Needs to work much harder next term.',
  principal_remark_average text NOT NULL DEFAULT 'A bit above average. Keep pushing to improve.',
  principal_remark_above text NOT NULL DEFAULT 'Far above average. Well done, keep it up.',
  principal_remark_distinction text NOT NULL DEFAULT 'Distinction. Excellent performance!',
  show_parent_signature boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_automation_settings TO authenticated;

GRANT ALL ON public.result_automation_settings TO service_role;

ALTER TABLE public.result_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school members read automation settings"
  ON public.result_automation_settings FOR SELECT
  USING (school_id = get_user_school_id() OR is_super_admin());

CREATE POLICY "admins manage automation settings"
  ON public.result_automation_settings FOR ALL
  USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin())
  WITH CHECK ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

-- 3. Report card publications (which terms are visible to parents)
CREATE TABLE IF NOT EXISTS public.report_card_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.admission_sessions(id) ON DELETE CASCADE,
  term text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  UNIQUE (school_id, student_id, class_id, session_id, term)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_card_publications TO authenticated;

GRANT ALL ON public.report_card_publications TO service_role;

ALTER TABLE public.report_card_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school members read publications"
  ON public.report_card_publications FOR SELECT
  USING (
    school_id = get_user_school_id()
    OR is_super_admin()
    OR is_parent_of_student(student_id)
  );

CREATE POLICY "admins manage publications"
  ON public.report_card_publications FOR ALL
  USING ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin())
  WITH CHECK ((school_id = get_user_school_id() AND is_admin()) OR is_super_admin());

-- 4. Student archive columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

-- 5. Staff signature column
ALTER TABLE public.staff_details
  ADD COLUMN IF NOT EXISTS signature_url text;


-- ===== 20260704102535_1b80150b-31e7-49e7-9334-9b984760aabd.sql =====

-- 1. Delete non-Al-Bari rows in dependency order (children first)
DO $$
DECLARE
  t text;
  al uuid := 'bbe68d9f-b5b4-481e-81d9-0766f4e030da'::uuid;
  tables text[] := ARRAY[
    -- deepest children first
    'question_responses','exam_questions','question_options','questions','question_banks',
    'exam_sessions','exams',
    'admission_workflow_logs','admission_documents','admission_payments','admission_offers',
    'admission_interviews','admission_exam_assignments','admission_applications','admission_sessions',
    'report_card_publications','report_card_comments','result_automation_settings',
    'gradebook_entries','grade_comments','grades','grading_scales','assessments','assessment_types',
    'promotion_history',
    'book_issues','library_books',
    'student_attendance','attendance_sessions','attendance_summary','staff_attendance',
    'class_timetables','timetable_templates','periods','rooms',
    'fee_reminder_logs','fee_payments','fee_installments','fee_installment_plans','fee_structures',
    'notification_queue','notification_templates','email_logs','announcements','academic_calendar',
    'news_articles','gallery','testimonials','website_pages','website_sections','website_settings','school_info',
    'student_id_cards','student_parent_relationships','parents','students',
    'teacher_class_assignments','subject_assignments','class_assignments','subjects','classes',
    'staff_details'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='school_id') THEN
      EXECUTE format('DELETE FROM public.%I WHERE school_id IS NOT NULL AND school_id <> %L', t, al);
    END IF;
  END LOOP;
END $$;

-- Reassign super admin, delete other profiles
UPDATE public.profiles SET school_id = 'bbe68d9f-b5b4-481e-81d9-0766f4e030da'::uuid WHERE school_id IS NULL;

DELETE FROM public.profiles WHERE school_id <> 'bbe68d9f-b5b4-481e-81d9-0766f4e030da'::uuid;

-- 2. Drop the view referencing school_id
DROP VIEW IF EXISTS public.v_student_term_scores CASCADE;

-- 3. Drop school_id columns via CASCADE
DO $$
DECLARE t text;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns 
    WHERE table_schema='public' AND column_name='school_id' AND table_name <> 'profiles'
    AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN school_id CASCADE', t);
  END LOOP;
END $$;

-- 4. Drop multitenancy helpers
DROP FUNCTION IF EXISTS public.get_user_school_id() CASCADE;

DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;

DROP FUNCTION IF EXISTS public.is_user_super_admin(uuid) CASCADE;

DROP FUNCTION IF EXISTS public.create_super_admin(uuid) CASCADE;

DROP FUNCTION IF EXISTS public.is_same_school(uuid) CASCADE;

DROP FUNCTION IF EXISTS public.auto_populate_school_id_admission_child() CASCADE;

DROP FUNCTION IF EXISTS public.auto_populate_school_id_class_assignments() CASCADE;

DROP FUNCTION IF EXISTS public.auto_populate_school_id_question_responses() CASCADE;

DROP FUNCTION IF EXISTS public.auto_populate_school_id_exam_questions() CASCADE;

DROP FUNCTION IF EXISTS public.auto_populate_school_id_question_options() CASCADE;

DROP FUNCTION IF EXISTS public.populate_exam_session_school_id() CASCADE;

-- 5. Rewrite RPCs
DROP FUNCTION IF EXISTS public.submit_admission_application(jsonb);

CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_class_id uuid; v_new_id uuid; v_app_no text;
BEGIN
  v_class_id := NULLIF(payload->>'applying_for_class_id','')::uuid;
  INSERT INTO public.admission_applications (
    application_number, status, first_name, middle_name, last_name,
    date_of_birth, gender, blood_group, state_of_origin, lga, nationality, religion,
    email, phone, address, previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs
  ) VALUES (
    NULL, 'submitted', payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date, payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga', COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion', payload->>'email', payload->>'phone',
    COALESCE(payload->'address','{}'::jsonb), payload->>'previous_school', payload->>'previous_class',
    v_class_id, COALESCE(payload->'parent_guardian_info','{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs'
  ) RETURNING id, application_number INTO v_new_id, v_app_no;
  RETURN jsonb_build_object('id', v_new_id, 'application_number', v_app_no);
END $$;

DROP FUNCTION IF EXISTS public.get_application_tracking(text, text);

CREATE OR REPLACE FUNCTION public.get_application_tracking(p_app_no text, p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_app jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id, 'application_number', a.application_number,
    'first_name', a.first_name, 'last_name', a.last_name, 'email', a.email,
    'status', a.status, 'application_date', a.application_date,
    'applying_for_class_id', a.applying_for_class_id, 'class_name', c.name,
    'offer', (SELECT jsonb_build_object('id',o.id,'status',o.status,'offer_date',o.offer_date,'response_deadline',o.response_deadline)
              FROM public.admission_offers o WHERE o.application_id=a.id ORDER BY o.created_at DESC LIMIT 1),
    'payment', (SELECT jsonb_build_object('id',p.id,'status',p.status,'amount',p.amount)
                FROM public.admission_payments p WHERE p.application_id=a.id ORDER BY p.created_at DESC LIMIT 1)
  ) INTO v_app
  FROM public.admission_applications a LEFT JOIN public.classes c ON c.id=a.applying_for_class_id
  WHERE lower(a.application_number)=lower(p_app_no) AND lower(a.email)=lower(p_email);
  IF v_app IS NULL THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
  RETURN v_app;
END $$;

DROP FUNCTION IF EXISTS public.transition_admission_status(uuid, admission_status, text);

CREATE OR REPLACE FUNCTION public.transition_admission_status(p_application_id uuid, p_new_status admission_status, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_current admission_status; v_allowed boolean := false;
BEGIN
  SELECT status INTO v_current FROM public.admission_applications WHERE id=p_application_id;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_allowed := CASE
    WHEN p_new_status='withdrawn' THEN true
    WHEN v_current='submitted' AND p_new_status IN ('under_review','rejected') THEN true
    WHEN v_current='under_review' AND p_new_status IN ('interview_scheduled','accepted','rejected') THEN true
    WHEN v_current='interview_scheduled' AND p_new_status IN ('accepted','rejected') THEN true
    WHEN v_current='accepted' AND p_new_status='payment_pending' THEN true
    WHEN v_current='payment_pending' AND p_new_status='enrolled' THEN true
    WHEN v_current=p_new_status THEN true ELSE false END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Invalid status transition: % -> %', v_current, p_new_status; END IF;
  UPDATE public.admission_applications
  SET status=p_new_status, reviewed_by=auth.uid(), reviewed_at=now(), review_notes=COALESCE(p_notes,review_notes), updated_at=now()
  WHERE id=p_application_id;
  INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes)
  VALUES (p_application_id, v_current::text, p_new_status::text, auth.uid(), p_notes) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true, 'from', v_current, 'to', p_new_status);
END $$;

DROP FUNCTION IF EXISTS public.get_current_session(uuid);

CREATE OR REPLACE FUNCTION public.get_current_session()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.admission_sessions WHERE is_current=true LIMIT 1
$$;

-- 6. Drop profiles.school_id and schools table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS school_id CASCADE;

DROP TABLE IF EXISTS public.schools CASCADE;

-- 7. Recreate v_student_term_scores without school_id
CREATE OR REPLACE VIEW public.v_student_term_scores AS
WITH online_scores AS (
  SELECT es.student_id, e.session_id, e.term, e.class_id, e.subject_id, e.assessment_category,
         es.percentage
  FROM public.exam_sessions es JOIN public.exams e ON e.id=es.exam_id
  WHERE es.status='completed'::session_status
    AND e.assessment_category = ANY (ARRAY['test1'::text,'test2'::text,'exam'::text])
    AND e.session_id IS NOT NULL AND e.term IS NOT NULL
),
online_pivot AS (
  SELECT student_id, session_id, term, class_id, subject_id,
    max(CASE WHEN assessment_category='test1' THEN round(percentage*20.0/100.0,2) END) AS o_test1,
    max(CASE WHEN assessment_category='test2' THEN round(percentage*20.0/100.0,2) END) AS o_test2,
    max(CASE WHEN assessment_category='exam'  THEN round(percentage*60.0/100.0,2) END) AS o_exam
  FROM online_scores GROUP BY student_id, session_id, term, class_id, subject_id
),
manual AS (
  SELECT student_id, session_id, term, class_id, subject_id,
    max(test1_score) AS m_test1, max(test2_score) AS m_test2, max(exam_score) AS m_exam
  FROM public.gradebook_entries
  WHERE session_id IS NOT NULL AND term IS NOT NULL
  GROUP BY student_id, session_id, term, class_id, subject_id
),
combined AS (
  SELECT COALESCE(m.student_id,o.student_id) AS student_id,
         COALESCE(m.session_id,o.session_id) AS session_id,
         COALESCE(m.term,o.term::varchar) AS term,
         COALESCE(m.class_id,o.class_id) AS class_id,
         COALESCE(m.subject_id,o.subject_id) AS subject_id,
         COALESCE(m.m_test1,o.o_test1,0) AS test1,
         COALESCE(m.m_test2,o.o_test2,0) AS test2,
         COALESCE(m.m_exam,o.o_exam,0)   AS exam_score
  FROM manual m FULL JOIN online_pivot o
    ON m.student_id=o.student_id AND m.session_id=o.session_id
   AND m.term::text=o.term AND m.subject_id=o.subject_id
)
SELECT student_id, session_id, term, class_id, subject_id, test1, test2, exam_score,
       test1+test2+exam_score AS total,
       rank() OVER (PARTITION BY session_id, term, class_id, subject_id ORDER BY (test1+test2+exam_score) DESC) AS subject_position
FROM combined;

GRANT SELECT ON public.v_student_term_scores TO authenticated;

-- 8. Recreate policies for previously-scoped tables
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'academic_calendar','admission_applications','admission_documents','admission_interviews',
    'admission_offers','admission_payments','admission_sessions','admission_workflow_logs',
    'announcements','assessment_types','assessments','attendance_sessions','attendance_summary',
    'book_issues','class_assignments','class_timetables','classes','exam_questions','exam_sessions',
    'exams','fee_installment_plans','fee_installments','fee_payments','fee_reminder_logs',
    'fee_structures','gallery','grade_comments','gradebook_entries','grades','grading_scales',
    'library_books','news_articles','notification_queue','notification_templates','parents',
    'periods','promotion_history','question_banks','question_options','question_responses',
    'questions','report_card_comments','report_card_publications','result_automation_settings',
    'rooms','staff_attendance','staff_details','student_attendance','student_id_cards',
    'student_parent_relationships','students','subject_assignments','subjects',
    'teacher_class_assignments','testimonials','timetable_templates','website_pages',
    'website_sections','website_settings','school_info'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())', tbl);
    END IF;
  END LOOP;

  FOR tbl IN SELECT unnest(ARRAY[
    'announcements','assessment_types','assessments','attendance_sessions','class_timetables',
    'exam_questions','exam_sessions','exams','grade_comments','gradebook_entries',
    'grades','question_banks','question_options','question_responses','questions',
    'student_attendance','subject_assignments','subjects','students','parents',
    'student_parent_relationships','teacher_class_assignments','report_card_comments',
    'report_card_publications','result_automation_settings','classes'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Teachers full access" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Teachers full access" ON public.%I FOR ALL TO authenticated USING (is_teacher()) WITH CHECK (is_teacher())', tbl);
    END IF;
  END LOOP;

  FOR tbl IN SELECT unnest(ARRAY['news_articles','gallery','testimonials','website_pages','website_sections','website_settings','school_info','classes','admission_sessions'])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Public read" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', tbl);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anyone can submit applications" ON public.admission_applications;

CREATE POLICY "Anyone can submit applications" ON public.admission_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can upload docs" ON public.admission_documents;

CREATE POLICY "Public can upload docs" ON public.admission_documents
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can create payments" ON public.admission_payments;

CREATE POLICY "Public can create payments" ON public.admission_payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);


-- ===== 20260721194426_d24e1938-c2db-40d1-869a-27bb9ed5082e.sql =====

DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
  END LOOP;
END$$;

GRANT SELECT ON public.classes TO anon;

GRANT SELECT ON public.school_info TO anon;

GRANT SELECT ON public.news_articles TO anon;

GRANT SELECT ON public.gallery TO anon;

GRANT SELECT ON public.testimonials TO anon;

GRANT SELECT ON public.website_pages TO anon;

GRANT SELECT ON public.website_sections TO anon;

GRANT SELECT ON public.website_settings TO anon;

GRANT SELECT ON public.academic_calendar TO anon;

GRANT SELECT ON public.admission_sessions TO anon;

GRANT INSERT ON public.admission_documents TO anon;

GRANT INSERT ON public.admission_applications TO anon;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;


-- ===== 20260721203106_c3bfca2d-e9ca-4677-94c7-449a3e70c03c.sql =====

-- 1. Extend student_parent_relationships
ALTER TABLE public.student_parent_relationships
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz NOT NULL DEFAULT now();

-- 2. Extend fee_payments for online payments
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS parent_user_id uuid,
  ADD COLUMN IF NOT EXISTS fee_installment_id uuid REFERENCES public.fee_installments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_payment_reference_key
  ON public.fee_payments(payment_reference) WHERE payment_reference IS NOT NULL;

-- 3. Auto-create parents row on parent signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role app_role;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'student'::app_role);

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (NEW.id, v_role, NEW.id)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, phone_primary)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill parents rows for any existing parent users missing one
INSERT INTO public.parents (user_id)
SELECT ur.user_id FROM public.user_roles ur
LEFT JOIN public.parents p ON p.user_id = ur.user_id
WHERE ur.role = 'parent' AND p.id IS NULL;

-- 4. RPC: parent-initiated linking
CREATE OR REPLACE FUNCTION public.link_parent_to_student(
  p_admission_number text,
  p_date_of_birth date,
  p_relationship_type text DEFAULT 'parent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_student record;
  v_rel_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'parent'::app_role) THEN
    RAISE EXCEPTION 'Only parents can link children' USING ERRCODE='42501';
  END IF;

  SELECT id INTO v_parent_id FROM public.parents WHERE user_id = auth.uid();
  IF v_parent_id IS NULL THEN
    INSERT INTO public.parents (user_id) VALUES (auth.uid()) RETURNING id INTO v_parent_id;
  END IF;

  SELECT s.id, s.admission_number, s.date_of_birth, p.full_name
  INTO v_student
  FROM public.students s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE lower(s.admission_number) = lower(trim(p_admission_number))
    AND s.date_of_birth = p_date_of_birth;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'No student found with that admission number and date of birth' USING ERRCODE='P0002';
  END IF;

  -- Idempotent link
  SELECT id INTO v_rel_id FROM public.student_parent_relationships
    WHERE parent_id = v_parent_id AND student_id = v_student.id;

  IF v_rel_id IS NULL THEN
    INSERT INTO public.student_parent_relationships (
      student_id, parent_id, relationship_type, is_primary_contact,
      can_view_grades, can_view_attendance, can_view_fees, verified
    ) VALUES (
      v_student.id, v_parent_id, COALESCE(p_relationship_type, 'parent'), true,
      true, true, true, true
    ) RETURNING id INTO v_rel_id;
  END IF;

  RETURN jsonb_build_object(
    'relationship_id', v_rel_id,
    'student_id', v_student.id,
    'admission_number', v_student.admission_number,
    'full_name', v_student.full_name
  );
END;
$$;

-- 5. Admin RPCs for manual linking
CREATE OR REPLACE FUNCTION public.admin_link_parent_to_student(
  p_parent_user_id uuid,
  p_student_id uuid,
  p_relationship_type text DEFAULT 'parent'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_rel_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO v_parent_id FROM public.parents WHERE user_id = p_parent_user_id;
  IF v_parent_id IS NULL THEN
    INSERT INTO public.parents (user_id) VALUES (p_parent_user_id) RETURNING id INTO v_parent_id;
  END IF;

  SELECT id INTO v_rel_id FROM public.student_parent_relationships
    WHERE parent_id = v_parent_id AND student_id = p_student_id;

  IF v_rel_id IS NULL THEN
    INSERT INTO public.student_parent_relationships (
      student_id, parent_id, relationship_type, is_primary_contact,
      can_view_grades, can_view_attendance, can_view_fees, verified
    ) VALUES (
      p_student_id, v_parent_id, COALESCE(p_relationship_type, 'parent'), true,
      true, true, true, true
    ) RETURNING id INTO v_rel_id;
  END IF;

  RETURN v_rel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlink_parent(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.student_parent_relationships WHERE id = p_relationship_id;
END;
$$;

-- 6. Helper: get children for current parent
CREATE OR REPLACE FUNCTION public.get_parent_children()
RETURNS TABLE (
  student_id uuid,
  full_name text,
  admission_number text,
  gender text,
  date_of_birth date,
  status text,
  class_id uuid,
  class_name text,
  relationship_id uuid,
  can_view_grades boolean,
  can_view_attendance boolean,
  can_view_fees boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, pr.full_name, s.admission_number, s.gender, s.date_of_birth, s.status,
         c.id, c.name, spr.id,
         spr.can_view_grades, spr.can_view_attendance, spr.can_view_fees
  FROM public.parents p
  JOIN public.student_parent_relationships spr ON spr.parent_id = p.id
  JOIN public.students s ON s.id = spr.student_id
  LEFT JOIN public.profiles pr ON pr.user_id = s.user_id
  LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE p.user_id = auth.uid()
  ORDER BY pr.full_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.link_parent_to_student(text, date, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_link_parent_to_student(uuid, uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_unlink_parent(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_parent_children() TO authenticated;

-- 7. RLS for parents to read child-scoped data
-- Grades
DROP POLICY IF EXISTS "Parents read grades of linked children" ON public.gradebook_entries;

CREATE POLICY "Parents read grades of linked children" ON public.gradebook_entries
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- Attendance
DROP POLICY IF EXISTS "Parents read attendance of linked children" ON public.student_attendance;

CREATE POLICY "Parents read attendance of linked children" ON public.student_attendance
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- Fee structures - any authenticated user can view (class-based)
DROP POLICY IF EXISTS "Authenticated read fee_structures" ON public.fee_structures;

CREATE POLICY "Authenticated read fee_structures" ON public.fee_structures
  FOR SELECT TO authenticated USING (true);

-- Fee payments - parents see child payments
DROP POLICY IF EXISTS "Parents read fee_payments of linked children" ON public.fee_payments;

CREATE POLICY "Parents read fee_payments of linked children" ON public.fee_payments
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- Fee installments
DROP POLICY IF EXISTS "Parents read installment plans" ON public.fee_installment_plans;

CREATE POLICY "Parents read installment plans" ON public.fee_installment_plans
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

DROP POLICY IF EXISTS "Parents read installments" ON public.fee_installments;

CREATE POLICY "Parents read installments" ON public.fee_installments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fee_installment_plans p
    WHERE p.id = plan_id AND public.is_parent_of_student(p.student_id)
  ));

-- Report card publications
DROP POLICY IF EXISTS "Parents read published report cards" ON public.report_card_publications;

CREATE POLICY "Parents read published report cards" ON public.report_card_publications
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- Announcements
DROP POLICY IF EXISTS "Parents read announcements" ON public.announcements;

CREATE POLICY "Parents read announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent'::app_role));

-- Parents can update their own profile
DROP POLICY IF EXISTS "Parents update own profile" ON public.parents;

CREATE POLICY "Parents update own profile" ON public.parents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Parents read own profile" ON public.parents;

CREATE POLICY "Parents read own profile" ON public.parents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Parents read their own relationships
DROP POLICY IF EXISTS "Parents read own relationships" ON public.student_parent_relationships;

CREATE POLICY "Parents read own relationships" ON public.student_parent_relationships
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parents WHERE id = parent_id AND user_id = auth.uid()
  ) OR public.is_admin() OR public.is_teacher());

-- Academic calendar readable by all authenticated
DROP POLICY IF EXISTS "Auth read calendar" ON public.academic_calendar;

CREATE POLICY "Auth read calendar" ON public.academic_calendar
  FOR SELECT TO authenticated USING (true);


-- ===== 20260721203522_a9df40b1-1f58-4527-ac3c-0a25b1c4d01c.sql =====

ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"email":true,"sms":true,"results":true,"attendance":true,"fees":true,"announcements":true}'::jsonb;


-- ===== 20260721205228_0c3fc430-2497-476e-a5cc-7be29057a549.sql =====

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.student_parent_relationships'::regclass
      AND conname = 'student_parent_relationships_relationship_type_check'
  ) THEN
    ALTER TABLE public.student_parent_relationships
      DROP CONSTRAINT student_parent_relationships_relationship_type_check;
  END IF;
END $$;

ALTER TABLE public.student_parent_relationships
  ADD CONSTRAINT student_parent_relationships_relationship_type_check
  CHECK (relationship_type = ANY (ARRAY['parent'::text, 'father'::text, 'mother'::text, 'guardian'::text, 'other'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS student_parent_relationships_parent_student_unique
  ON public.student_parent_relationships(parent_id, student_id);

CREATE UNIQUE INDEX IF NOT EXISTS parents_user_id_unique
  ON public.parents(user_id)
  WHERE user_id IS NOT NULL;


-- ===== 20260721212437_b0cdde5c-41a0-4d9f-999b-077632594f9e.sql =====

-- 1. student_qr_tokens
CREATE TABLE public.student_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX student_qr_tokens_active_uniq ON public.student_qr_tokens(student_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_qr_tokens TO authenticated;

GRANT ALL ON public.student_qr_tokens TO service_role;

ALTER TABLE public.student_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read qr tokens" ON public.student_qr_tokens FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "staff manage qr tokens" ON public.student_qr_tokens FOR ALL TO authenticated USING (public.is_teacher()) WITH CHECK (public.is_teacher());

-- 2. visitor_logs
CREATE TABLE public.visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  purpose text,
  host_name text,
  badge_no text,
  signed_in_at timestamptz NOT NULL DEFAULT now(),
  signed_out_at timestamptz,
  signed_in_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_logs TO authenticated;

GRANT ALL ON public.visitor_logs TO service_role;

ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage visitors" ON public.visitor_logs FOR ALL TO authenticated USING (public.is_teacher()) WITH CHECK (public.is_teacher());

-- 3. extend student_attendance
ALTER TABLE public.student_attendance
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_direction text,
  ADD COLUMN IF NOT EXISTS scanned_by uuid REFERENCES auth.users(id);

-- 4. extend staff_attendance
ALTER TABLE public.staff_attendance
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_direction text,
  ADD COLUMN IF NOT EXISTS scanned_by uuid REFERENCES auth.users(id);

-- 5. Issue token RPC
CREATE OR REPLACE FUNCTION public.issue_student_qr(p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.student_qr_tokens SET revoked_at = now()
    WHERE student_id = p_student_id AND revoked_at IS NULL;
  INSERT INTO public.student_qr_tokens (student_id) VALUES (p_student_id)
    RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- 6. Resolve token RPC
CREATE OR REPLACE FUNCTION public.resolve_scan_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'student_id', s.id,
    'user_id', s.user_id,
    'full_name', p.full_name,
    'admission_number', s.admission_number,
    'photo_url', s.photo_url,
    'class_id', c.id,
    'class_name', c.name,
    'status', s.status
  ) INTO v_row
  FROM public.student_qr_tokens t
  JOIN public.students s ON s.id = t.student_id
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE t.token = p_token AND t.revoked_at IS NULL;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Invalid or revoked token'; END IF;
  RETURN v_row;
END;
$$;

-- 7. Scan-attendance RPC (student)
CREATE OR REPLACE FUNCTION public.record_student_scan(p_token uuid, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_student uuid; v_info jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_direction NOT IN ('in','out') THEN RAISE EXCEPTION 'direction must be in/out'; END IF;
  SELECT student_id INTO v_student FROM public.student_qr_tokens
    WHERE token = p_token AND revoked_at IS NULL;
  IF v_student IS NULL THEN RAISE EXCEPTION 'Invalid token'; END IF;
  INSERT INTO public.student_attendance (student_id, date, status, scanned_at, scan_direction, scanned_by, marked_by)
  VALUES (v_student, CURRENT_DATE, 'present', now(), p_direction, auth.uid(), auth.uid());
  v_info := public.resolve_scan_token(p_token);
  RETURN v_info;
END;
$$;

-- 8. Backfill tokens for existing students
INSERT INTO public.student_qr_tokens (student_id)
SELECT s.id FROM public.students s
LEFT JOIN public.student_qr_tokens t ON t.student_id = s.id AND t.revoked_at IS NULL
WHERE t.id IS NULL;


-- ===== 20260721214218_ac15ca72-1a35-4170-bc2d-63cb73d08667.sql =====

CREATE OR REPLACE FUNCTION public.record_scan_by_ref(p_ref text, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student uuid;
  v_uuid uuid;
  v_match text;
  v_info jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_direction NOT IN ('in','out') THEN RAISE EXCEPTION 'direction must be in/out'; END IF;
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN RAISE EXCEPTION 'unknown_reference'; END IF;

  -- Try to extract a UUID from the ref (raw token or /scan/<token> URL)
  v_match := (regexp_match(p_ref, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'))[1];

  IF v_match IS NOT NULL THEN
    v_uuid := v_match::uuid;
    SELECT student_id INTO v_student FROM public.student_qr_tokens
      WHERE token = v_uuid AND revoked_at IS NULL;
    IF v_student IS NULL THEN
      -- Token exists but revoked?
      IF EXISTS (SELECT 1 FROM public.student_qr_tokens WHERE token = v_uuid) THEN
        RAISE EXCEPTION 'token_revoked';
      END IF;
    END IF;
  END IF;

  -- Fallback: treat ref as admission number
  IF v_student IS NULL THEN
    SELECT id INTO v_student FROM public.students
      WHERE lower(admission_number) = lower(btrim(p_ref));
    IF v_student IS NULL THEN
      RAISE EXCEPTION 'student_not_found';
    END IF;
  END IF;

  INSERT INTO public.student_attendance (student_id, date, status, scanned_at, scan_direction, scanned_by, marked_by)
  VALUES (v_student, CURRENT_DATE, 'present', now(), p_direction, auth.uid(), auth.uid());

  SELECT jsonb_build_object(
    'student_id', s.id,
    'user_id', s.user_id,
    'full_name', p.full_name,
    'admission_number', s.admission_number,
    'photo_url', s.photo_url,
    'class_id', c.id,
    'class_name', c.name,
    'status', s.status
  ) INTO v_info
  FROM public.students s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE s.id = v_student;

  RETURN v_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_scan_by_ref(text, text) TO authenticated;


-- ===== 20260721215012_4d42defa-62e2-41b4-9cd8-442f70a192e0.sql =====

CREATE OR REPLACE FUNCTION public.get_or_create_scan_session(p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.attendance_sessions
   WHERE date = p_date AND status = 'scan' AND class_id IS NULL AND subject_id IS NULL
   LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.attendance_sessions (date, status, teacher_id, period_number)
    VALUES (p_date, 'scan', auth.uid(), 0)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_scan_by_ref(p_ref text, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student uuid; v_uuid uuid; v_match text; v_info jsonb;
  v_session uuid; v_existing uuid;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_direction NOT IN ('in','out') THEN RAISE EXCEPTION 'direction must be in/out'; END IF;
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN RAISE EXCEPTION 'unknown_reference'; END IF;

  v_match := (regexp_match(p_ref, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'))[1];
  IF v_match IS NOT NULL THEN
    v_uuid := v_match::uuid;
    SELECT student_id INTO v_student FROM public.student_qr_tokens
      WHERE token = v_uuid AND revoked_at IS NULL;
    IF v_student IS NULL AND EXISTS (SELECT 1 FROM public.student_qr_tokens WHERE token = v_uuid) THEN
      RAISE EXCEPTION 'token_revoked';
    END IF;
  END IF;

  IF v_student IS NULL THEN
    SELECT id INTO v_student FROM public.students
      WHERE lower(admission_number) = lower(btrim(p_ref));
    IF v_student IS NULL THEN RAISE EXCEPTION 'student_not_found'; END IF;
  END IF;

  v_session := public.get_or_create_scan_session(CURRENT_DATE);

  SELECT id INTO v_existing FROM public.student_attendance
   WHERE attendance_session_id = v_session AND student_id = v_student
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.student_attendance
      (attendance_session_id, student_id, status, marked_at, marked_by,
       scanned_at, scan_direction, scanned_by)
    VALUES (v_session, v_student, 'present', now(), auth.uid(),
            now(), p_direction, auth.uid());
  ELSE
    UPDATE public.student_attendance
       SET scan_direction = p_direction, scanned_at = now(), scanned_by = auth.uid()
     WHERE id = v_existing;
  END IF;

  SELECT jsonb_build_object(
    'student_id', s.id, 'user_id', s.user_id, 'full_name', p.full_name,
    'admission_number', s.admission_number, 'photo_url', s.photo_url,
    'class_id', c.id, 'class_name', c.name, 'status', s.status
  ) INTO v_info
  FROM public.students s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE s.id = v_student;
  RETURN v_info;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_scan(p_token uuid, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.record_scan_by_ref(p_token::text, p_direction);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_scan_session(date) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_scan_by_ref(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_student_scan(uuid, text) TO authenticated;


-- ===== 20260721220442_d0315657-5f1d-47ba-ae3c-7e387e5dd6a3.sql =====

-- Permit the dedicated scan-session status while preserving all existing statuses.
ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;

ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'scan'::text]));

-- Guarantee one global ID-scan bucket per date and one attendance row per student/session.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_daily_scan_uniq
  ON public.attendance_sessions (date)
  WHERE status = 'scan' AND class_id IS NULL AND subject_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS student_attendance_session_student_uniq
  ON public.student_attendance (attendance_session_id, student_id)
  WHERE attendance_session_id IS NOT NULL AND student_id IS NOT NULL;

-- Reinstate RLS on private attendance/identity tables.
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Remove broad anonymous Data API access left by the earlier permissions repair.
REVOKE ALL ON TABLE public.attendance_sessions FROM anon;

REVOKE ALL ON TABLE public.student_attendance FROM anon;

REVOKE ALL ON TABLE public.staff_attendance FROM anon;

REVOKE ALL ON TABLE public.visitor_logs FROM anon;

REVOKE ALL ON TABLE public.student_qr_tokens FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_sessions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_attendance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_attendance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_logs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_qr_tokens TO authenticated;

GRANT ALL ON TABLE public.attendance_sessions TO service_role;

GRANT ALL ON TABLE public.student_attendance TO service_role;

GRANT ALL ON TABLE public.staff_attendance TO service_role;

GRANT ALL ON TABLE public.visitor_logs TO service_role;

GRANT ALL ON TABLE public.student_qr_tokens TO service_role;

-- Keep the student attendance-session policy authenticated-only.
DROP POLICY IF EXISTS "Students can view their attendance sessions" ON public.attendance_sessions;

CREATE POLICY "Students can view their attendance sessions"
  ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (
    class_id IN (
      SELECT ca.class_id
      FROM public.class_assignments ca
      JOIN public.students s ON s.id = ca.student_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Concurrency-safe daily scan-session helper.
CREATE OR REPLACE FUNCTION public.get_or_create_scan_session(p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_teacher() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id
  FROM public.attendance_sessions
  WHERE date = p_date
    AND status = 'scan'
    AND class_id IS NULL
    AND subject_id IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.attendance_sessions (date, status, teacher_id, period_number)
    VALUES (p_date, 'scan', auth.uid(), 0)
    ON CONFLICT (date)
      WHERE status = 'scan' AND class_id IS NULL AND subject_id IS NULL
      DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.attendance_sessions
      WHERE date = p_date
        AND status = 'scan'
        AND class_id IS NULL
        AND subject_id IS NULL
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Resolve live scan URLs, raw UUID tokens, and admission/registration numbers.
CREATE OR REPLACE FUNCTION public.record_scan_by_ref(p_ref text, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_uuid uuid;
  v_match text;
  v_info jsonb;
  v_session uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_teacher() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'invalid_direction';
  END IF;
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN
    RAISE EXCEPTION 'unknown_reference';
  END IF;

  v_match := (regexp_match(p_ref, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'))[1];
  IF v_match IS NOT NULL THEN
    v_uuid := v_match::uuid;
    SELECT student_id INTO v_student
    FROM public.student_qr_tokens
    WHERE token = v_uuid AND revoked_at IS NULL;

    IF v_student IS NULL
       AND EXISTS (SELECT 1 FROM public.student_qr_tokens WHERE token = v_uuid) THEN
      RAISE EXCEPTION 'token_revoked';
    END IF;
  END IF;

  IF v_student IS NULL THEN
    SELECT id INTO v_student
    FROM public.students
    WHERE lower(admission_number) = lower(btrim(p_ref));
  END IF;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'student_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_session := public.get_or_create_scan_session(CURRENT_DATE);

  INSERT INTO public.student_attendance (
    attendance_session_id, student_id, status, marked_at, marked_by,
    scanned_at, scan_direction, scanned_by
  )
  VALUES (
    v_session, v_student, 'present', now(), auth.uid(),
    now(), p_direction, auth.uid()
  )
  ON CONFLICT (attendance_session_id, student_id)
    WHERE attendance_session_id IS NOT NULL AND student_id IS NOT NULL
  DO UPDATE SET
    status = 'present',
    scan_direction = EXCLUDED.scan_direction,
    scanned_at = EXCLUDED.scanned_at,
    scanned_by = EXCLUDED.scanned_by;

  SELECT jsonb_build_object(
    'student_id', s.id,
    'user_id', s.user_id,
    'full_name', p.full_name,
    'admission_number', s.admission_number,
    'photo_url', s.photo_url,
    'class_id', c.id,
    'class_name', c.name,
    'status', s.status,
    'direction', p_direction,
    'scanned_at', now()
  ) INTO v_info
  FROM public.students s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE s.id = v_student
  ORDER BY c.name NULLS LAST
  LIMIT 1;

  RETURN v_info;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_scan(p_token uuid, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.record_scan_by_ref(p_token::text, p_direction);
END;
$$;

-- Resolve and record the scanned staff member, not the signed-in operator.
CREATE OR REPLACE FUNCTION public.record_staff_scan(p_ref text, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_teacher() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'invalid_direction';
  END IF;
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN
    RAISE EXCEPTION 'unknown_reference';
  END IF;

  SELECT sd.user_id, sd.employee_id, p.full_name, sd.designation, sd.department
  INTO v_staff
  FROM public.staff_details sd
  LEFT JOIN public.profiles p ON p.user_id = sd.user_id
  WHERE lower(sd.employee_id) = lower(btrim(p_ref))
     OR sd.user_id::text = btrim(p_ref)
  LIMIT 1;

  IF v_staff.user_id IS NULL THEN
    RAISE EXCEPTION 'staff_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.staff_attendance (
    staff_id, date, check_in, check_out, status, marked_by,
    scanned_at, scan_direction, scanned_by
  )
  VALUES (
    v_staff.user_id, CURRENT_DATE,
    CASE WHEN p_direction = 'in' THEN v_now::time ELSE NULL END,
    CASE WHEN p_direction = 'out' THEN v_now::time ELSE NULL END,
    'present', auth.uid(), v_now, p_direction, auth.uid()
  )
  ON CONFLICT (staff_id, date)
  DO UPDATE SET
    check_in = CASE
      WHEN p_direction = 'in' THEN COALESCE(public.staff_attendance.check_in, v_now::time)
      ELSE public.staff_attendance.check_in
    END,
    check_out = CASE
      WHEN p_direction = 'out' THEN v_now::time
      ELSE public.staff_attendance.check_out
    END,
    status = 'present',
    scanned_at = v_now,
    scan_direction = p_direction,
    scanned_by = auth.uid();

  RETURN jsonb_build_object(
    'user_id', v_staff.user_id,
    'employee_id', v_staff.employee_id,
    'full_name', v_staff.full_name,
    'designation', v_staff.designation,
    'department', v_staff.department,
    'direction', p_direction,
    'scanned_at', v_now
  );
END;
$$;

-- Private RPC surface: explicit authenticated/service-role execution only.
REVOKE ALL ON FUNCTION public.get_or_create_scan_session(date) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.record_scan_by_ref(text, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.record_student_scan(uuid, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.record_staff_scan(text, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.issue_student_qr(uuid) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.resolve_scan_token(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_scan_session(date) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.record_scan_by_ref(text, text) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.record_student_scan(uuid, text) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.record_staff_scan(text, text) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.issue_student_qr(uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.resolve_scan_token(uuid) TO authenticated, service_role;


-- ===== 20260722052251_83b357e3-b2b0-4ef5-9175-cf4f4351e9bf.sql =====

-- Ensure PostgREST anonymous reads work for public CMS tables
GRANT SELECT ON public.school_info TO anon, authenticated;

GRANT SELECT ON public.website_settings TO anon, authenticated;

GRANT SELECT ON public.news_articles TO anon, authenticated;

GRANT SELECT ON public.gallery TO anon, authenticated;

GRANT SELECT ON public.testimonials TO anon, authenticated;

GRANT SELECT ON public.website_pages TO anon, authenticated;

GRANT SELECT ON public.website_sections TO anon, authenticated;

GRANT ALL ON public.school_info TO service_role;

GRANT ALL ON public.website_settings TO service_role;

GRANT ALL ON public.news_articles TO service_role;

GRANT ALL ON public.gallery TO service_role;

GRANT ALL ON public.testimonials TO service_role;

GRANT ALL ON public.website_pages TO service_role;

GRANT ALL ON public.website_sections TO service_role;

-- Seed default school_info keys (do nothing on conflict)
INSERT INTO public.school_info (info_key, info_value, category, is_active) VALUES
  ('name', 'Al-Bari Group of Schools', 'general', true),
  ('motto', 'Building Tomorrow''s Leaders Today', 'general', true),
  ('address', 'Lagos, Nigeria', 'contact', true),
  ('contact_phone', '+234 813 418 7710', 'contact', true),
  ('contact_email', 'info@albari.com.ng', 'contact', true),
  ('whatsapp_number', '2348134187710', 'contact', true),
  ('facebook_url', '', 'social', true),
  ('twitter_url', '', 'social', true),
  ('instagram_url', '', 'social', true),
  ('youtube_url', '', 'social', true),
  ('tiktok_url', '', 'social', true),
  ('stat_students', '500+', 'statistics', true),
  ('stat_teachers', '40+', 'statistics', true),
  ('stat_years', '22+', 'statistics', true),
  ('stat_success_rate', '98%', 'statistics', true),
  ('logo_url', '/albari_logo.jpg', 'general', true)
ON CONFLICT (info_key) DO NOTHING;

-- Seed default website_settings keys
INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
  ('hero_badge', to_jsonb('Excellence in Education Since 2004'::text), 'Homepage hero badge text'),
  ('hero_title', to_jsonb('Building Tomorrow''s'::text), 'Homepage hero title'),
  ('hero_title_highlight', to_jsonb('Leaders Today'::text), 'Highlighted portion of hero title'),
  ('hero_subtitle', to_jsonb('At Al-Bari Group of Schools, we are committed to nurturing young minds and developing future leaders through innovative education, character building, and academic excellence.'::text), 'Homepage hero subtitle'),
  ('hero_cta_primary_label', to_jsonb('Apply Now'::text), 'Primary hero CTA label'),
  ('hero_cta_secondary_label', to_jsonb('Learn More'::text), 'Secondary hero CTA label'),
  ('hero_images', '["/albari-campus.png","/img1.png","/img2.png","/img3.png"]'::jsonb, 'Rotating hero background images'),
  ('principal_name', to_jsonb('Dr. Awe'::text), 'Principal display name'),
  ('principal_title', to_jsonb('Director of Studies'::text), 'Principal title'),
  ('principal_photo_url', to_jsonb('/awe.png'::text), 'Principal portrait URL'),
  ('principal_message', to_jsonb('For over two decades, Al-Bari Group of Schools has been a sanctuary where bright minds are nurtured into principled leaders. We believe that true education is the marriage of intellectual rigour and moral clarity, and every child who walks through our gates is treated as a future custodian of that vision.\n\nWelcome to a community that will challenge, support and celebrate your child.'::text), 'Principal welcome message'),
  ('accreditations', '[
    {"name":"WAEC","desc":"West African Examinations Council","icon":"Award"},
    {"name":"NECO","desc":"National Examinations Council","icon":"ShieldCheck"},
    {"name":"Cambridge","desc":"Cambridge Assessment","icon":"BookMarked"},
    {"name":"Ministry of Education","desc":"Federal Republic of Nigeria","icon":"Building2"},
    {"name":"NUC Recognised","desc":"Pathway Partner","icon":"GraduationCap"}
  ]'::jsonb, 'Accreditation bodies'),
  ('how_to_apply_steps', '[
    {"n":"01","icon":"FileText","title":"Submit Application","body":"Complete the online application with your child''s details and upload required documents."},
    {"n":"02","icon":"CreditCard","title":"Sit Entrance Assessment","body":"Pay the application fee and attend the scheduled entrance examination and interview."},
    {"n":"03","icon":"GraduationCap","title":"Accept Your Offer","body":"Receive your offer letter, pay acceptance fees and join the Al-Bari family."}
  ]'::jsonb, 'How to apply steps'),
  ('portals', '[
    {"title":"Student Portal","description":"Access exam schedules, results, assignments, and academic resources","icon":"GraduationCap","link":"/login?portal=true&role=student","features":["View Exam Results","Class Schedules","Assignments","Academic Calendar"],"enabled":true},
    {"title":"Parent Portal","description":"Monitor your child''s academic progress, attendance, and school activities","icon":"Users","link":"/login?portal=true&role=parent","features":["Child''s Progress","Fee Payment","Communication","Events Updates"],"enabled":true},
    {"title":"Teacher Portal","description":"Manage classes, create exams, track student performance and communicate with parents","icon":"UserCheck","link":"/login?portal=true&role=teacher","features":["Class Management","Exam Creation","Grade Reports","Student Records"],"enabled":true},
    {"title":"Admin Portal","description":"Comprehensive school management system for administrators and staff","icon":"Shield","link":"/login?portal=true&role=admin","features":["User Management","System Settings","Reports","School Analytics"],"enabled":true}
  ]'::jsonb, 'Portal cards for /portals page'),
  ('about_history', to_jsonb('Al-Bari Group of Schools was founded in 2004 with a vision to provide quality education that combines academic excellence with moral values. What started as a small institution with just 50 students has grown into one of Lagos'' most respected educational establishments.\n\nOver the years, we have consistently maintained our commitment to excellence, producing graduates who have gone on to achieve success in various fields including medicine, engineering, law, and business.\n\nOur journey has been marked by continuous innovation in teaching methodologies, infrastructure development, and the integration of modern technology into traditional learning approaches.'::text), 'About page history'),
  ('about_vision', to_jsonb('To be the leading educational institution in Nigeria, recognized for academic excellence, character development, and the production of well-rounded individuals who contribute positively to society.'::text), 'Vision statement'),
  ('about_mission', to_jsonb('To provide quality education that nurtures intellectual growth, moral development, and practical skills, preparing students to excel in their chosen careers while maintaining the highest ethical standards.'::text), 'Mission statement'),
  ('facilities_intro', to_jsonb('Modern infrastructure designed to support effective teaching, learning, and character development'::text), 'Facilities page intro'),
  ('facilities', '[
    {"title":"Modern Library","description":"Extensive collection of books, digital resources, and quiet study spaces for enhanced learning.","icon":"BookOpen"},
    {"title":"Science Laboratories","description":"Fully equipped labs for Biology, Chemistry, and Physics with modern equipment and safety measures.","icon":"Microscope"},
    {"title":"Computer Laboratory","description":"State-of-the-art computers with high-speed internet for digital literacy and research.","icon":"Monitor"},
    {"title":"Sports Complex","description":"Indoor and outdoor facilities including basketball court, football field, and athletics track.","icon":"Trophy"},
    {"title":"Cafeteria","description":"Hygienic food service providing nutritious meals and refreshments for students and staff.","icon":"Utensils"},
    {"title":"Transportation","description":"Safe and reliable school bus services covering major routes across Lagos.","icon":"Bus"}
  ]'::jsonb, 'Facilities list'),
  ('newsletter_enabled', to_jsonb(true), 'Show newsletter block on homepage')
ON CONFLICT (setting_key) DO NOTHING;


-- ===== 20260722054751_eb6d0ac5-1497-4496-86a2-5c1f5b2edbb7.sql =====

-- Extend fee_structures and fee_payments
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS notes text;

-- Per-student fee summary helper
CREATE OR REPLACE FUNCTION public.get_student_fee_summary(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_billed numeric := 0;
  v_paid numeric := 0;
  v_next_due date;
  v_next_amt numeric := 0;
BEGIN
  SELECT class_id INTO v_class_id FROM class_assignments WHERE student_id = _student_id LIMIT 1;

  SELECT COALESCE(SUM(amount), 0) INTO v_billed
  FROM fee_structures
  WHERE class_id IS NULL OR class_id = v_class_id;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_paid
  FROM fee_payments
  WHERE student_id = _student_id AND status = 'completed';

  SELECT fi.due_date, (fi.amount - COALESCE(fi.paid_amount,0))
    INTO v_next_due, v_next_amt
  FROM fee_installments fi
  JOIN fee_installment_plans p ON p.id = fi.plan_id
  WHERE p.student_id = _student_id
    AND fi.status IN ('pending','partial','overdue')
  ORDER BY fi.due_date ASC
  LIMIT 1;

  IF v_next_due IS NULL THEN
    SELECT due_date, amount INTO v_next_due, v_next_amt
    FROM fee_structures
    WHERE (class_id IS NULL OR class_id = v_class_id) AND due_date IS NOT NULL
    ORDER BY due_date ASC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'billed', v_billed,
    'paid', v_paid,
    'outstanding', GREATEST(0, v_billed - v_paid),
    'next_due_date', v_next_due,
    'next_due_amount', COALESCE(v_next_amt, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(uuid) TO authenticated;


-- ===== 20260722063631_084808e2-b773-4842-9ae2-7f7ec68fd532.sql =====

-- Parent-School messaging
CREATE TABLE IF NOT EXISTS public.parent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  student_id uuid,
  sender_role text NOT NULL CHECK (sender_role IN ('parent','admin','teacher')),
  sender_user_id uuid NOT NULL,
  subject text,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_thread ON public.parent_messages(thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pm_parent ON public.parent_messages(parent_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_messages TO authenticated;

GRANT ALL ON public.parent_messages TO service_role;

ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents read own messages" ON public.parent_messages
  FOR SELECT TO authenticated USING (parent_user_id = auth.uid() OR public.is_teacher());

CREATE POLICY "Parents send own messages" ON public.parent_messages
  FOR INSERT TO authenticated WITH CHECK (
    (sender_role = 'parent' AND sender_user_id = auth.uid() AND parent_user_id = auth.uid())
    OR (sender_role IN ('admin','teacher') AND public.is_teacher() AND sender_user_id = auth.uid())
  );

CREATE POLICY "Mark read own messages" ON public.parent_messages
  FOR UPDATE TO authenticated USING (parent_user_id = auth.uid() OR public.is_teacher())
  WITH CHECK (parent_user_id = auth.uid() OR public.is_teacher());

CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.parent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_messages;

-- Fees dashboard aggregation RPC
CREATE OR REPLACE FUNCTION public.get_fees_dashboard(p_class_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billed numeric := 0;
  v_collected numeric := 0;
  v_this_month numeric := 0;
  v_overdue int := 0;
  v_by_class jsonb;
  v_by_method jsonb;
  v_timeline jsonb;
  v_debtors jsonb;
  v_month_start date := date_trunc('month', now())::date;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Billed = sum per student of applicable fee_structures
  WITH student_class AS (
    SELECT s.id AS student_id, ca.class_id
    FROM students s LEFT JOIN class_assignments ca ON ca.student_id = s.id
    WHERE (p_class_id IS NULL OR ca.class_id = p_class_id)
  ),
  bills AS (
    SELECT sc.student_id, sc.class_id, COALESCE(SUM(fs.amount),0) AS bill
    FROM student_class sc
    LEFT JOIN fee_structures fs ON (fs.class_id IS NULL OR fs.class_id = sc.class_id)
    GROUP BY sc.student_id, sc.class_id
  ),
  paid AS (
    SELECT student_id, SUM(amount_paid) AS paid
    FROM fee_payments WHERE status = 'completed' GROUP BY student_id
  )
  SELECT COALESCE(SUM(b.bill),0) INTO v_billed FROM bills b;

  SELECT COALESCE(SUM(amount_paid),0) INTO v_collected FROM fee_payments WHERE status='completed';
  SELECT COALESCE(SUM(amount_paid),0) INTO v_this_month FROM fee_payments WHERE status='completed' AND payment_date >= v_month_start;
  SELECT COUNT(*) INTO v_overdue FROM fee_installments WHERE status='overdue';

  -- Collections by class
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_by_class FROM (
    SELECT c.name AS class_name, COALESCE(SUM(fp.amount_paid),0) AS collected
    FROM classes c
    LEFT JOIN class_assignments ca ON ca.class_id = c.id
    LEFT JOIN fee_payments fp ON fp.student_id = ca.student_id AND fp.status='completed'
    GROUP BY c.name ORDER BY collected DESC
  ) t;

  -- By payment method
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_by_method FROM (
    SELECT COALESCE(payment_method,'unknown') AS method, COALESCE(SUM(amount_paid),0) AS total, COUNT(*) AS count
    FROM fee_payments WHERE status='completed' GROUP BY payment_method
  ) t;

  -- Last 30 days timeline
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'day')), '[]'::jsonb) INTO v_timeline FROM (
    SELECT to_char(d::date,'YYYY-MM-DD') AS day,
           COALESCE(SUM(fp.amount_paid),0) AS collected
    FROM generate_series((now()-interval '29 days')::date, now()::date, '1 day') d
    LEFT JOIN fee_payments fp ON fp.status='completed' AND fp.payment_date::date = d::date
    GROUP BY d
  ) t;

  -- Top 10 debtors
  WITH student_class AS (
    SELECT s.id AS student_id, ca.class_id, s.admission_number, p.full_name
    FROM students s
    LEFT JOIN class_assignments ca ON ca.student_id = s.id
    LEFT JOIN profiles p ON p.user_id = s.user_id
  ),
  bills AS (
    SELECT sc.student_id, sc.admission_number, sc.full_name,
           COALESCE(SUM(fs.amount),0) AS bill
    FROM student_class sc
    LEFT JOIN fee_structures fs ON (fs.class_id IS NULL OR fs.class_id = sc.class_id)
    GROUP BY sc.student_id, sc.admission_number, sc.full_name
  ),
  paid AS (
    SELECT student_id, COALESCE(SUM(amount_paid),0) AS paid
    FROM fee_payments WHERE status='completed' GROUP BY student_id
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'outstanding')::numeric DESC), '[]'::jsonb) INTO v_debtors FROM (
    SELECT b.student_id, b.admission_number, b.full_name,
           b.bill AS billed, COALESCE(p.paid,0) AS paid,
           (b.bill - COALESCE(p.paid,0)) AS outstanding
    FROM bills b LEFT JOIN paid p ON p.student_id = b.student_id
    WHERE (b.bill - COALESCE(p.paid,0)) > 0
    ORDER BY outstanding DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'billed', v_billed,
    'collected', v_collected,
    'outstanding', GREATEST(0, v_billed - v_collected),
    'collection_rate', CASE WHEN v_billed>0 THEN round((v_collected/v_billed)*100, 1) ELSE 0 END,
    'this_month', v_this_month,
    'overdue', v_overdue,
    'by_class', v_by_class,
    'by_method', v_by_method,
    'timeline', v_timeline,
    'debtors', v_debtors
  );
END; $$;

-- Attendance summary RPC (per class, per date range)
CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_start date, p_end date, p_class_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'full_name')), '[]'::jsonb) INTO v_rows FROM (
    SELECT s.id AS student_id, p.full_name, s.admission_number, c.name AS class_name,
      COUNT(*) FILTER (WHERE sa.status='present') AS present,
      COUNT(*) FILTER (WHERE sa.status='absent') AS absent,
      COUNT(*) FILTER (WHERE sa.status='late') AS late,
      COUNT(*) AS total
    FROM students s
    LEFT JOIN profiles p ON p.user_id = s.user_id
    LEFT JOIN class_assignments ca ON ca.student_id = s.id
    LEFT JOIN classes c ON c.id = ca.class_id
    LEFT JOIN student_attendance sa ON sa.student_id = s.id
    LEFT JOIN attendance_sessions ses ON ses.id = sa.attendance_session_id AND ses.date BETWEEN p_start AND p_end
    WHERE (p_class_id IS NULL OR ca.class_id = p_class_id)
    GROUP BY s.id, p.full_name, s.admission_number, c.name
  ) t;
  RETURN jsonb_build_object('rows', v_rows, 'start', p_start, 'end', p_end);
END; $$;


-- ===== 20260722075242_a6355b9b-2c8f-4d51-a26f-311b0f7614da.sql =====

-- ================= ASSIGNMENTS =================
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  instructions text,
  attachment_url text,
  due_date timestamptz,
  max_score numeric(6,2),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;

GRANT ALL ON public.assignments TO service_role;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (public.is_teacher() AND (teacher_id = auth.uid() OR public.is_admin()))
  WITH CHECK (public.is_teacher() AND (teacher_id = auth.uid() OR public.is_admin()));

CREATE POLICY "Students read class assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.class_assignments ca
      JOIN public.students s ON s.id = ca.student_id
      WHERE ca.class_id = assignments.class_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Parents read children assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.class_assignments ca
      WHERE ca.class_id = assignments.class_id
        AND public.is_parent_of_student(ca.student_id)
    )
  );

CREATE TRIGGER trg_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= ASSIGNMENT SUBMISSIONS =================
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score numeric(6,2),
  feedback text,
  graded_by uuid,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;

GRANT ALL ON public.assignment_submissions TO service_role;

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own submissions" ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (public.is_my_student_record(student_id))
  WITH CHECK (public.is_my_student_record(student_id));

CREATE POLICY "Teachers view/grade submissions" ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (
    public.is_teacher() AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    public.is_teacher() AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Parents read children submissions" ON public.assignment_submissions
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

CREATE TRIGGER trg_submissions_updated
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= LESSON NOTES =================
CREATE TABLE public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  week_number int,
  term text,
  session_id uuid,
  content text,
  attachment_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;

GRANT ALL ON public.lesson_notes TO service_role;

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage lesson notes" ON public.lesson_notes
  FOR ALL TO authenticated
  USING (public.is_teacher() AND (teacher_id = auth.uid() OR public.is_admin()))
  WITH CHECK (public.is_teacher() AND (teacher_id = auth.uid() OR public.is_admin()));

CREATE POLICY "Students read class lesson notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.class_assignments ca
      JOIN public.students s ON s.id = ca.student_id
      WHERE ca.class_id = lesson_notes.class_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Parents read children lesson notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.class_assignments ca
      WHERE ca.class_id = lesson_notes.class_id
        AND public.is_parent_of_student(ca.student_id)
    )
  );

CREATE TRIGGER trg_lesson_notes_updated
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= GRADING SCALE HELPER =================
CREATE OR REPLACE FUNCTION public.get_grade_for_score(_score numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scale jsonb;
  v_item jsonb;
BEGIN
  SELECT scale_data INTO v_scale
  FROM public.grading_scales
  WHERE is_default = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_scale IS NULL THEN
    RETURN jsonb_build_object('grade', 'F', 'remark', 'No scale');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_scale)
  LOOP
    IF _score >= (v_item->>'min')::numeric AND _score <= (v_item->>'max')::numeric THEN
      RETURN jsonb_build_object(
        'grade', v_item->>'grade',
        'remark', v_item->>'remark'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('grade', 'F', 'remark', 'Fail');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_grade_for_score(numeric) TO authenticated, anon;

-- Allow authenticated users to read the grading scale for client-side use
GRANT SELECT ON public.grading_scales TO authenticated;

GRANT ALL ON public.grading_scales TO service_role;

DROP POLICY IF EXISTS "Anyone can read grading scales" ON public.grading_scales;

CREATE POLICY "Anyone can read grading scales" ON public.grading_scales
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage grading scales" ON public.grading_scales;

CREATE POLICY "Admins manage grading scales" ON public.grading_scales
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ===== 20260722075328_90c2abe2-88f8-4d02-a00f-7298e107dc42.sql =====

-- storage.objects policies for assignments bucket
DROP POLICY IF EXISTS "assignments read auth" ON storage.objects;

CREATE POLICY "assignments read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assignments');

DROP POLICY IF EXISTS "assignments insert auth" ON storage.objects;

CREATE POLICY "assignments insert auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignments');

DROP POLICY IF EXISTS "assignments update own" ON storage.objects;

CREATE POLICY "assignments update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assignments' AND (owner = auth.uid() OR public.is_admin() OR public.is_teacher()))
  WITH CHECK (bucket_id = 'assignments');

DROP POLICY IF EXISTS "assignments delete own" ON storage.objects;

CREATE POLICY "assignments delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assignments' AND (owner = auth.uid() OR public.is_admin() OR public.is_teacher()));


-- ===== 20260722080114_ad696d2e-a0ce-48cf-a0dd-6dba511726ec.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  table_name text,
  row_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;

CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;

CREATE POLICY "Authenticated can insert audit" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_sensitive_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_email text; v_row_id text;
BEGIN
  BEGIN SELECT email::text INTO v_email FROM auth.users WHERE id = v_actor;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
  v_row_id := COALESCE((CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)->>'id' ELSE row_to_json(NEW)->>'id' END), '');
  INSERT INTO public.audit_logs (actor_id, actor_email, action, table_name, row_id, before_data, after_data)
  VALUES (v_actor, v_email, TG_OP, TG_TABLE_NAME, v_row_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;

CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_writes();

DROP TRIGGER IF EXISTS trg_audit_fee_payments ON public.fee_payments;

CREATE TRIGGER trg_audit_fee_payments AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_writes();

DROP TRIGGER IF EXISTS trg_audit_admission_apps ON public.admission_applications;

CREATE TRIGGER trg_audit_admission_apps AFTER UPDATE OF status ON public.admission_applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_writes();

DROP TRIGGER IF EXISTS trg_audit_students ON public.students;

CREATE TRIGGER trg_audit_students AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_writes();

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_payments_reference
  ON public.fee_payments (payment_reference) WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_payments_reference
  ON public.admission_payments (payment_reference) WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_payments_transaction
  ON public.admission_payments (transaction_id) WHERE transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_fee_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_fee_payment ON public.fee_payments;

CREATE TRIGGER trg_validate_fee_payment BEFORE INSERT OR UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_fee_payment();

CREATE OR REPLACE FUNCTION public.expire_old_qr_tokens()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.student_qr_tokens SET revoked_at = now()
  WHERE revoked_at IS NULL AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.delete_user_profile(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.admin_link_parent_to_student(uuid, uuid, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.admin_unlink_parent(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.transition_admission_status(uuid, admission_status, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_assign_teacher_class()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role != 'teacher' THEN RETURN NEW; END IF;
  RETURN NEW;
END; $$;


-- ===== 20260722140754_61cc2359-d9aa-40a9-8972-5a504d638060.sql =====

-- 1. HR
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('annual','sick','maternity','paternity','casual','unpaid','other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;

GRANT ALL ON public.leave_requests TO service_role;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own leaves" ON public.leave_requests FOR SELECT TO authenticated USING (staff_id = auth.uid() OR public.is_admin());

CREATE POLICY "Staff insert own leaves" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff update own pending leaves" ON public.leave_requests FOR UPDATE TO authenticated
  USING ((staff_id = auth.uid() AND status = 'pending') OR public.is_admin())
  WITH CHECK ((staff_id = auth.uid() AND status IN ('pending','cancelled')) OR public.is_admin());

CREATE POLICY "Admin delete leaves" ON public.leave_requests FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','paid','closed')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated;

GRANT ALL ON public.payroll_periods TO service_role;

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage payroll periods" ON public.payroll_periods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Staff view periods" ON public.payroll_periods FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  allowances jsonb NOT NULL DEFAULT '{}'::jsonb,
  deductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, staff_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;

GRANT ALL ON public.payroll_items TO service_role;

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage payroll items" ON public.payroll_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Staff view own payslip" ON public.payroll_items FOR SELECT TO authenticated USING (staff_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_payroll_items_updated_at BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Transport
CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  driver_name text, driver_phone text, vehicle_reg text,
  capacity int NOT NULL DEFAULT 0,
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;

GRANT ALL ON public.transport_routes TO service_role;

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view routes" ON public.transport_routes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage routes" ON public.transport_routes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_transport_routes_updated_at BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  pickup_time time, dropoff_time time,
  stop_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_stops TO authenticated;

GRANT ALL ON public.transport_stops TO service_role;

ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view stops" ON public.transport_stops FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage stops" ON public.transport_stops FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_transport_stops_updated_at BEFORE UPDATE ON public.transport_stops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.student_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, route_id, started_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_transport TO authenticated;

GRANT ALL ON public.student_transport TO service_role;

ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage student transport" ON public.student_transport FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Student/parent view own transport" ON public.student_transport FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_teacher() OR public.is_my_student_record(student_id) OR public.is_parent_of_student(student_id)
);

CREATE TRIGGER trg_student_transport_updated_at BEFORE UPDATE ON public.student_transport FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Assets
CREATE TABLE public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_categories TO authenticated;

GRANT ALL ON public.asset_categories TO service_role;

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view asset categories" ON public.asset_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage asset categories" ON public.asset_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  location text,
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('new','good','fair','poor','damaged','retired')),
  purchased_on date, cost numeric(12,2),
  assigned_to_staff uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','retired','lost')),
  serial_number text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;

GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view assets" ON public.assets FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin manage assets" ON public.assets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.asset_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_location text, to_location text,
  from_staff uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_staff uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  note text
);

GRANT SELECT, INSERT ON public.asset_movements TO authenticated;

GRANT ALL ON public.asset_movements TO service_role;

ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view movements" ON public.asset_movements FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Staff log movements" ON public.asset_movements FOR INSERT TO authenticated WITH CHECK (public.is_teacher() AND moved_by = auth.uid());

-- 4. Cafeteria
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('daily','weekly','monthly','termly')),
  days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plans TO authenticated;

GRANT ALL ON public.meal_plans TO service_role;

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view meal plans" ON public.meal_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage meal plans" ON public.meal_plans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_meal_plans_updated_at BEFORE UPDATE ON public.meal_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE RESTRICT,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_subscriptions TO authenticated;

GRANT ALL ON public.meal_subscriptions TO service_role;

ALTER TABLE public.meal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage meal subs" ON public.meal_subscriptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Student/parent view own meal sub" ON public.meal_subscriptions FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_teacher() OR public.is_my_student_record(student_id) OR public.is_parent_of_student(student_id)
);

CREATE TRIGGER trg_meal_subs_updated_at BEFORE UPDATE ON public.meal_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Careers
CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, department text,
  employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','internship','volunteer')),
  location text, description text NOT NULL, requirements text,
  apply_email text NOT NULL, closes_on date,
  is_open boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_openings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;

GRANT ALL ON public.job_openings TO service_role;

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view open jobs" ON public.job_openings FOR SELECT USING (is_open = true OR public.is_admin());

CREATE POLICY "Admin manage jobs" ON public.job_openings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_job_openings_updated_at BEFORE UPDATE ON public.job_openings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Analytics views
CREATE OR REPLACE VIEW public.v_enrolment_by_class AS
  SELECT c.id AS class_id, c.name AS class_name, COUNT(DISTINCT ca.student_id) AS student_count
  FROM public.classes c LEFT JOIN public.class_assignments ca ON ca.class_id = c.id
  GROUP BY c.id, c.name ORDER BY c.name;

GRANT SELECT ON public.v_enrolment_by_class TO authenticated;

CREATE OR REPLACE VIEW public.v_fee_collections_daily AS
  SELECT payment_date::date AS day, COALESCE(SUM(amount_paid),0) AS collected, COUNT(*) AS payments
  FROM public.fee_payments WHERE status = 'completed' AND payment_date IS NOT NULL
  GROUP BY payment_date::date ORDER BY day;

GRANT SELECT ON public.v_fee_collections_daily TO authenticated;

CREATE OR REPLACE VIEW public.v_attendance_trend AS
  SELECT s.date AS day,
    COUNT(*) FILTER (WHERE sa.status='present') AS present,
    COUNT(*) FILTER (WHERE sa.status='absent') AS absent,
    COUNT(*) FILTER (WHERE sa.status='late') AS late,
    COUNT(*) AS total
  FROM public.attendance_sessions s
  LEFT JOIN public.student_attendance sa ON sa.attendance_session_id = s.id
  GROUP BY s.date ORDER BY s.date;

GRANT SELECT ON public.v_attendance_trend TO authenticated;

CREATE OR REPLACE VIEW public.v_admission_funnel AS
  SELECT status::text AS status, COUNT(*) AS count FROM public.admission_applications GROUP BY status;

GRANT SELECT ON public.v_admission_funnel TO authenticated;

CREATE OR REPLACE VIEW public.v_assignment_completion AS
  SELECT a.id AS assignment_id, a.title, a.class_id, c.name AS class_name,
    (SELECT COUNT(*) FROM public.class_assignments ca WHERE ca.class_id = a.class_id) AS total_students,
    COUNT(DISTINCT sub.student_id) AS submitted_count,
    COUNT(DISTINCT sub.student_id) FILTER (WHERE sub.score IS NOT NULL) AS graded_count
  FROM public.assignments a
  LEFT JOIN public.classes c ON c.id = a.class_id
  LEFT JOIN public.assignment_submissions sub ON sub.assignment_id = a.id
  GROUP BY a.id, a.title, a.class_id, c.name;

GRANT SELECT ON public.v_assignment_completion TO authenticated;

-- 7. Analytics KPI RPC
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_students int; v_total_staff int; v_active_parents int;
  v_term_revenue numeric := 0; v_outstanding numeric := 0;
  v_attendance_rate numeric := 0; v_apps_total int; v_apps_enrolled int;
  v_enrolment jsonb; v_collections jsonb; v_attendance jsonb; v_funnel jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT COUNT(*) INTO v_total_students FROM public.students WHERE status = 'active' OR status IS NULL;
  SELECT COUNT(*) INTO v_total_staff FROM public.staff_details;
  SELECT COUNT(DISTINCT user_id) INTO v_active_parents FROM public.parents WHERE user_id IS NOT NULL;

  SELECT COALESCE(SUM(amount_paid),0) INTO v_term_revenue
    FROM public.fee_payments WHERE status='completed'
    AND payment_date >= date_trunc('month', now()) - interval '3 months';

  WITH bills AS (
    SELECT s.id AS student_id, ca.class_id,
      (SELECT COALESCE(SUM(amount),0) FROM public.fee_structures fs WHERE fs.class_id IS NULL OR fs.class_id = ca.class_id) AS bill
    FROM public.students s LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
  ),
  paid AS (
    SELECT student_id, COALESCE(SUM(amount_paid),0) AS paid FROM public.fee_payments WHERE status='completed' GROUP BY student_id
  )
  SELECT COALESCE(SUM(GREATEST(0, b.bill - COALESCE(p.paid,0))),0) INTO v_outstanding
    FROM bills b LEFT JOIN paid p ON p.student_id = b.student_id;

  SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE sa.status='present') / NULLIF(COUNT(*),0),1),0) INTO v_attendance_rate
    FROM public.student_attendance sa
    JOIN public.attendance_sessions s ON s.id = sa.attendance_session_id
    WHERE s.date >= CURRENT_DATE - interval '30 days';

  SELECT COUNT(*) INTO v_apps_total FROM public.admission_applications;
  SELECT COUNT(*) INTO v_apps_enrolled FROM public.admission_applications WHERE status='enrolled';

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_enrolment FROM public.v_enrolment_by_class t;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'day')),'[]'::jsonb) INTO v_collections FROM (
    SELECT day, collected, payments FROM public.v_fee_collections_daily WHERE day >= CURRENT_DATE - interval '30 days'
  ) t;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'day')),'[]'::jsonb) INTO v_attendance FROM (
    SELECT day, present, absent, late, total FROM public.v_attendance_trend WHERE day >= CURRENT_DATE - interval '30 days'
  ) t;
  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_funnel FROM public.v_admission_funnel t;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'students', v_total_students, 'staff', v_total_staff, 'parents', v_active_parents,
      'term_revenue', v_term_revenue, 'outstanding', v_outstanding,
      'attendance_rate', v_attendance_rate,
      'apps_total', v_apps_total, 'apps_enrolled', v_apps_enrolled,
      'conversion_rate', CASE WHEN v_apps_total > 0 THEN ROUND(100.0 * v_apps_enrolled / v_apps_total, 1) ELSE 0 END
    ),
    'enrolment_by_class', v_enrolment,
    'collections_30d', v_collections,
    'attendance_30d', v_attendance,
    'admission_funnel', v_funnel
  );
END $$;

REVOKE ALL ON FUNCTION public.get_admin_analytics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated, service_role;

-- 8. Global search RPC
CREATE OR REPLACE FUNCTION public.global_search(q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_students jsonb; v_staff jsonb; v_parents jsonb; v_apps jsonb; v_qq text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_qq := '%' || lower(coalesce(q,'')) || '%';
  IF length(coalesce(q,'')) < 2 THEN
    RETURN jsonb_build_object('students','[]'::jsonb,'staff','[]'::jsonb,'parents','[]'::jsonb,'applications','[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_students FROM (
    SELECT s.id, p.full_name, s.admission_number, c.name AS class_name
    FROM public.students s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    LEFT JOIN public.class_assignments ca ON ca.student_id = s.id
    LEFT JOIN public.classes c ON c.id = ca.class_id
    WHERE lower(coalesce(p.full_name,'')) LIKE v_qq OR lower(coalesce(s.admission_number,'')) LIKE v_qq
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_staff FROM (
    SELECT sd.user_id, p.full_name, sd.employee_id, sd.designation, sd.department
    FROM public.staff_details sd
    LEFT JOIN public.profiles p ON p.user_id = sd.user_id
    WHERE lower(coalesce(p.full_name,'')) LIKE v_qq OR lower(coalesce(sd.employee_id,'')) LIKE v_qq
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_parents FROM (
    SELECT pa.id, pa.user_id, p.full_name, pa.phone_primary
    FROM public.parents pa
    LEFT JOIN public.profiles p ON p.user_id = pa.user_id
    WHERE lower(coalesce(p.full_name,'')) LIKE v_qq OR lower(coalesce(pa.phone_primary,'')) LIKE v_qq
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_apps FROM (
    SELECT a.id, a.application_number, a.first_name, a.last_name, a.email, a.status
    FROM public.admission_applications a
    WHERE lower(coalesce(a.application_number,'')) LIKE v_qq
       OR lower(coalesce(a.email,'')) LIKE v_qq
       OR lower(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')) LIKE v_qq
    LIMIT 10
  ) t;

  RETURN jsonb_build_object('students',v_students,'staff',v_staff,'parents',v_parents,'applications',v_apps);
END $$;

REVOKE ALL ON FUNCTION public.global_search(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.global_search(text) TO authenticated, service_role;


-- ===== 20260727105749_ff5ddb01-23dd-4371-92bc-7dd0ef737635.sql =====

CREATE OR REPLACE FUNCTION public.get_application_documents(p_application_id uuid)
RETURNS SETOF public.admission_documents
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admission_interviews ai
      JOIN public.interview_panels ip ON ip.interview_id = ai.id
      WHERE ai.application_id = p_application_id
        AND ip.interviewer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.admission_applications a
      WHERE a.id = p_application_id
        AND lower(a.email) = lower(public.get_user_email())
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.admission_documents
  WHERE application_id = p_application_id
  ORDER BY uploaded_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_application_documents(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_application_documents(uuid) TO authenticated;

DROP POLICY IF EXISTS "Panel members can view application documents" ON public.admission_documents;

CREATE POLICY "Panel members can view application documents"
ON public.admission_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admission_interviews ai
    JOIN public.interview_panels ip ON ip.interview_id = ai.id
    WHERE ai.application_id = admission_documents.application_id
      AND ip.interviewer_id = auth.uid()
  )
);


-- ===== 20260730070139_d3042d99-9a8e-4462-8e62-dc82fd9ea051.sql =====

ALTER TABLE public.admission_exam_assignments
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS max_score numeric,
  ADD COLUMN IF NOT EXISTS percentage numeric,
  ADD COLUMN IF NOT EXISTS result_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS result_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS resit_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_exam_assignments TO authenticated;

GRANT ALL ON public.admission_exam_assignments TO service_role;

DROP TRIGGER IF EXISTS trg_admission_exam_assignments_updated_at ON public.admission_exam_assignments;

CREATE TRIGGER trg_admission_exam_assignments_updated_at
BEFORE UPDATE ON public.admission_exam_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_entrance_exam_results(p_exam_id uuid)
RETURNS TABLE(
  assignment_id uuid,
  application_id uuid,
  application_number text,
  full_name text,
  email text,
  status text,
  score numeric,
  max_score numeric,
  percentage numeric,
  result_status text,
  comment text,
  source text,
  result_sent_at timestamptz,
  resit_sent_at timestamptz,
  online_score numeric,
  online_max_score numeric,
  online_percentage numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id,
    ap.id,
    ap.application_number,
    btrim(concat_ws(' ', ap.first_name, ap.middle_name, ap.last_name)),
    ap.email,
    ap.status::text,
    a.score,
    a.max_score,
    a.percentage,
    a.result_status,
    a.comment,
    a.source,
    a.result_sent_at,
    a.resit_sent_at,
    es.total_score::numeric,
    es.max_score::numeric,
    es.percentage
  FROM public.admission_exam_assignments a
  JOIN public.admission_applications ap ON ap.id = a.application_id
  LEFT JOIN public.students st ON st.id = ap.student_id
  LEFT JOIN LATERAL (
    SELECT s.total_score, s.max_score, s.percentage
    FROM public.exam_sessions s
    WHERE s.exam_id = a.exam_id
      AND st.user_id IS NOT NULL
      AND s.student_id = st.user_id
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1
  ) es ON true
  WHERE a.exam_id = p_exam_id
    AND public.is_teacher()
  ORDER BY ap.application_number;
$$;

REVOKE EXECUTE ON FUNCTION public.get_entrance_exam_results(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_entrance_exam_results(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_entrance_exam_result(
  p_assignment_id uuid,
  p_score numeric,
  p_max_score numeric,
  p_result_status text,
  p_comment text,
  p_source text DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_result_status, 'pending') NOT IN ('pending','pass','fail','resit') THEN
    RAISE EXCEPTION 'Invalid result status';
  END IF;

  UPDATE public.admission_exam_assignments
  SET score = p_score,
      max_score = p_max_score,
      percentage = CASE WHEN COALESCE(p_max_score,0) > 0
                        THEN ROUND((p_score / p_max_score) * 100, 2) ELSE NULL END,
      result_status = COALESCE(p_result_status, 'pending'),
      comment = p_comment,
      source = COALESCE(p_source, 'manual'),
      recorded_by = auth.uid()
  WHERE id = p_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_entrance_exam_result(uuid, numeric, numeric, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_entrance_exam_result(uuid, numeric, numeric, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_entrance_result_sent(p_assignment_id uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'result' THEN
    UPDATE public.admission_exam_assignments SET result_sent_at = now() WHERE id = p_assignment_id;
  ELSIF p_kind = 'resit' THEN
    UPDATE public.admission_exam_assignments SET resit_sent_at = now() WHERE id = p_assignment_id;
  ELSE
    RAISE EXCEPTION 'Invalid kind';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_entrance_result_sent(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_entrance_result_sent(uuid, text) TO authenticated;


-- ===== 20260730070953_1da99d6e-440e-41ff-b9be-684a8468e06f.sql =====

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS exam_mode text NOT NULL DEFAULT 'cbt',
  ADD COLUMN IF NOT EXISTS paper_subjects jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.admission_exam_assignments
  ADD COLUMN IF NOT EXISTS subject_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resit_date timestamptz,
  ADD COLUMN IF NOT EXISTS resit_venue text;

CREATE OR REPLACE FUNCTION public.save_entrance_exam_result(
  p_assignment_id uuid,
  p_score numeric,
  p_max_score numeric,
  p_result_status text,
  p_comment text,
  p_source text DEFAULT 'manual'::text,
  p_subject_scores jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_score numeric := p_score;
  v_max numeric := p_max_score;
  v_subjects jsonb := COALESCE(p_subject_scores, '[]'::jsonb);
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_result_status, 'pending') NOT IN ('pending','pass','fail','resit') THEN
    RAISE EXCEPTION 'Invalid result status';
  END IF;

  IF jsonb_array_length(v_subjects) > 0 THEN
    SELECT SUM(NULLIF(e->>'score','')::numeric), SUM(NULLIF(e->>'max','')::numeric)
      INTO v_score, v_max
    FROM jsonb_array_elements(v_subjects) e;
  END IF;

  UPDATE public.admission_exam_assignments
  SET score = v_score,
      max_score = v_max,
      percentage = CASE WHEN COALESCE(v_max,0) > 0
                        THEN ROUND((v_score / v_max) * 100, 2) ELSE NULL END,
      result_status = COALESCE(p_result_status, 'pending'),
      comment = p_comment,
      source = COALESCE(p_source, 'manual'),
      subject_scores = v_subjects,
      recorded_by = auth.uid(),
      updated_at = now()
  WHERE id = p_assignment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_entrance_resit_details(
  p_assignment_id uuid,
  p_resit_date timestamptz,
  p_resit_venue text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admission_exam_assignments
  SET resit_date = p_resit_date, resit_venue = p_resit_venue, updated_at = now()
  WHERE id = p_assignment_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_entrance_exam_results(uuid);

CREATE OR REPLACE FUNCTION public.get_entrance_exam_results(p_exam_id uuid)
RETURNS TABLE(
  assignment_id uuid, application_id uuid, application_number text, full_name text, email text,
  status text, score numeric, max_score numeric, percentage numeric, result_status text,
  comment text, source text, subject_scores jsonb, resit_date timestamptz, resit_venue text,
  result_sent_at timestamptz, resit_sent_at timestamptz,
  online_score numeric, online_max_score numeric, online_percentage numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    a.id, ap.id, ap.application_number,
    btrim(concat_ws(' ', ap.first_name, ap.middle_name, ap.last_name)),
    ap.email, ap.status::text,
    a.score, a.max_score, a.percentage, a.result_status, a.comment, a.source,
    a.subject_scores, a.resit_date, a.resit_venue,
    a.result_sent_at, a.resit_sent_at,
    es.total_score::numeric, es.max_score::numeric, es.percentage
  FROM public.admission_exam_assignments a
  JOIN public.admission_applications ap ON ap.id = a.application_id
  LEFT JOIN public.students st ON st.id = ap.student_id
  LEFT JOIN LATERAL (
    SELECT s.total_score, s.max_score, s.percentage
    FROM public.exam_sessions s
    WHERE s.exam_id = a.exam_id
      AND st.user_id IS NOT NULL
      AND s.student_id = st.user_id
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1
  ) es ON true
  WHERE a.exam_id = p_exam_id
    AND public.is_teacher()
  ORDER BY ap.application_number;
$function$;

CREATE OR REPLACE FUNCTION public.get_application_exam_results(p_application_id uuid)
RETURNS TABLE(
  assignment_id uuid, exam_id uuid, exam_title text, exam_mode text, paper_subjects jsonb,
  score numeric, max_score numeric, percentage numeric, result_status text, comment text,
  subject_scores jsonb, resit_date timestamptz, resit_venue text,
  result_sent_at timestamptz, resit_sent_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.id, e.id, e.title, e.exam_mode, e.paper_subjects,
         a.score, a.max_score, a.percentage, a.result_status, a.comment,
         a.subject_scores, a.resit_date, a.resit_venue,
         a.result_sent_at, a.resit_sent_at
  FROM public.admission_exam_assignments a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.application_id = p_application_id
    AND public.is_teacher()
  ORDER BY a.assigned_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.attach_application_to_exam(p_application_id uuid, p_exam_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_id FROM public.admission_exam_assignments
   WHERE application_id = p_application_id AND exam_id = p_exam_id LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.admission_exam_assignments (application_id, exam_id, assigned_by)
    VALUES (p_application_id, p_exam_id, auth.uid())
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$function$;


-- ===== 20260730112334_aef7fec1-95b1-4fd1-bf3f-e12830c94728.sql =====

CREATE OR REPLACE FUNCTION public.get_offer_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'application_id', o.application_id,
    'acceptance_deadline', o.acceptance_deadline,
    'status', o.status,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'application', jsonb_build_object(
      'id', a.id,
      'application_number', a.application_number,
      'first_name', a.first_name,
      'last_name', a.last_name,
      'email', a.email,
      'admitted_to_class_id', a.admitted_to_class_id,
      'class_name', COALESCE(c.name, 'N/A')
    )
  ) INTO v
  FROM public.admission_offers o
  JOIN public.admission_applications a ON a.id = o.application_id
  LEFT JOIN public.classes c ON c.id = a.admitted_to_class_id
  WHERE o.acceptance_token::text = p_token;

  IF v IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired offer link' USING ERRCODE = 'P0002';
  END IF;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon, authenticated;


-- ===== 20260730113443_463c2ba5-42ec-4003-88da-a5c89f399749.sql =====

CREATE OR REPLACE FUNCTION public.accept_offer_by_token(
  p_acceptance_token text,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.admission_offers%ROWTYPE;
  v_processed_at timestamptz := now();
BEGIN
  IF p_acceptance_token IS NULL OR btrim(p_acceptance_token) = '' THEN
    RETURN jsonb_build_object('error', 'Invalid offer token');
  END IF;

  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object('error', 'Invalid decision');
  END IF;

  SELECT *
  INTO v_offer
  FROM public.admission_offers
  WHERE acceptance_token = btrim(p_acceptance_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid offer link');
  END IF;

  IF v_offer.status IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object(
      'error', format('This offer has already been %s', v_offer.status),
      'status', v_offer.status
    );
  END IF;

  IF v_offer.status NOT IN ('sent', 'pending') THEN
    RETURN jsonb_build_object('error', 'This offer is not available for a decision');
  END IF;

  IF v_offer.acceptance_deadline < current_date THEN
    RETURN jsonb_build_object('error', 'This offer has expired');
  END IF;

  UPDATE public.admission_offers
  SET status = p_decision,
      accepted_at = CASE WHEN p_decision = 'accepted' THEN v_processed_at ELSE NULL END,
      declined_at = CASE WHEN p_decision = 'declined' THEN v_processed_at ELSE NULL END,
      updated_at = v_processed_at
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'offer_id', v_offer.id,
    'application_id', v_offer.application_id,
    'status', p_decision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_offer_by_token(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_offer_by_token(text, text) TO service_role;


-- ===== 20260730113542_9c5a192b-5445-4751-933e-ab44de181f39.sql =====

CREATE OR REPLACE FUNCTION public.get_offer_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invalid offer link' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'application_id', o.application_id,
    'acceptance_deadline', o.acceptance_deadline,
    'status', o.status,
    'is_expired', o.acceptance_deadline < current_date,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'application', jsonb_build_object(
      'id', a.id,
      'application_number', a.application_number,
      'first_name', a.first_name,
      'last_name', a.last_name,
      'email', a.email,
      'admitted_to_class_id', a.admitted_to_class_id,
      'class_name', COALESCE(c.name, 'N/A')
    )
  ) INTO v
  FROM public.admission_offers o
  JOIN public.admission_applications a ON a.id = o.application_id
  LEFT JOIN public.classes c ON c.id = a.admitted_to_class_id
  WHERE o.acceptance_token = btrim(p_token);

  IF v IS NULL THEN
    RAISE EXCEPTION 'Invalid offer link' USING ERRCODE = 'P0002';
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_offer_by_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon, authenticated, service_role;


-- ===== 20260730113641_19692e5b-672c-492a-9996-2a99ff518b8a.sql =====

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO postgres;

GRANT EXECUTE ON FUNCTION public.accept_offer_by_token(text, text) TO postgres;


-- ===== 20260730113722_0099e051-3002-4e42-beec-d91afd5a6911.sql =====

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO supabase_admin;

GRANT EXECUTE ON FUNCTION public.accept_offer_by_token(text, text) TO supabase_admin;


-- ===== 20260730113833_7afbafc0-c1de-4ae3-97aa-e12dfecbcb9f.sql =====

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO supabase_read_only_user;


-- ===== 20260730114921_68376273-296e-4676-8250-a1ac55feeb40.sql =====

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('acceptance_fee_amount', to_jsonb(50000)),
  ('acceptance_fee_note', to_jsonb('This acceptance fee will be deducted from your child''s school fees.'::text))
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_offer_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  v_note text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invalid offer link' USING ERRCODE = 'P0002';
  END IF;

  SELECT (setting_value #>> '{}') INTO v_note
  FROM public.app_settings WHERE setting_key = 'acceptance_fee_note';

  SELECT jsonb_build_object(
    'id', o.id,
    'application_id', o.application_id,
    'acceptance_deadline', o.acceptance_deadline,
    'status', o.status,
    'is_expired', o.acceptance_deadline < current_date,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'acceptance_fee', o.acceptance_fee,
    'acceptance_fee_note', COALESCE(v_note, 'This acceptance fee will be deducted from your child''s school fees.'),
    'application', jsonb_build_object(
      'id', a.id,
      'application_number', a.application_number,
      'first_name', a.first_name,
      'last_name', a.last_name,
      'email', a.email,
      'admitted_to_class_id', a.admitted_to_class_id,
      'class_name', COALESCE(c.name, 'N/A')
    )
  ) INTO v
  FROM public.admission_offers o
  JOIN public.admission_applications a ON a.id = o.application_id
  LEFT JOIN public.classes c ON c.id = a.admitted_to_class_id
  WHERE o.acceptance_token = btrim(p_token);

  IF v IS NULL THEN
    RAISE EXCEPTION 'Invalid offer link' USING ERRCODE = 'P0002';
  END IF;

  RETURN v;
END;
$function$;


-- ===== 20260730123844_b1703d3b-8b18-4662-8690-125f2dc77541.sql =====

CREATE OR REPLACE FUNCTION public.guard_enrolled_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'enrolled'::admission_status
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'withdrawn'::admission_status THEN
    RAISE EXCEPTION 'Application % is already enrolled and cannot be moved back to %', OLD.application_number, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_enrolled_status ON public.admission_applications;

CREATE TRIGGER trg_guard_enrolled_status
BEFORE UPDATE OF status ON public.admission_applications
FOR EACH ROW EXECUTE FUNCTION public.guard_enrolled_status();


-- ===== 20260730124310_d87ad1ad-ee8d-48a3-bddf-b683dd69e080.sql =====

CREATE POLICY "Students can view their own record"
ON public.students FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Students can update their own record"
ON public.students FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_student_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR public.is_teacher() THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id = auth.uid() THEN
    NEW.admission_number := OLD.admission_number;
    NEW.status := OLD.status;
    NEW.admission_date := OLD.admission_date;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_student_self_update ON public.students;

CREATE TRIGGER trg_protect_student_self_update
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.protect_student_self_update();


-- ===== 20260730135408_44a94b83-bd76-4dbd-897d-a07af405d15b.sql =====

GRANT SELECT ON public.class_assignments TO authenticated;

DROP POLICY IF EXISTS "Students can view their own class assignment" ON public.class_assignments;

CREATE POLICY "Students can view their own class assignment"
ON public.class_assignments FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  OR public.is_teacher()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Students can view their class timetable" ON public.class_timetables;

CREATE POLICY "Students can view their class timetable"
ON public.class_timetables FOR SELECT
USING (
  class_id IN (
    SELECT ca.class_id FROM public.class_assignments ca
    WHERE ca.student_id = auth.uid()
       OR ca.student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  )
  OR teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Student passport photo uploads: students/<auth uid>/...
DROP POLICY IF EXISTS "Students manage their own photo" ON storage.objects;

CREATE POLICY "Students manage their own photo"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'admission-documents'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] = auth.uid()::text
);


-- ===== 20260730140040_8177e100-6e2d-4ecc-8ce4-1c958b3231b9.sql =====

ALTER TABLE public.admission_applications ADD COLUMN IF NOT EXISTS login_email text;

CREATE UNIQUE INDEX IF NOT EXISTS admission_applications_login_email_uidx ON public.admission_applications (lower(login_email)) WHERE login_email IS NOT NULL;

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('student_login_domain', '"students.albari.com.ng"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;


-- ===== 20260730182325_7d69ffda-6ada-49e6-bf39-53b57841a006.sql =====

CREATE OR REPLACE FUNCTION public.next_admission_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_next int;
  v_candidate text;
BEGIN
  FOR i IN 1..50 LOOP
    SELECT COALESCE(MAX((regexp_replace(admission_number, '^ALB/' || v_year || '/', ''))::int), 0) + 1
      INTO v_next
      FROM public.students
     WHERE admission_number ~ ('^ALB/' || v_year || '/[0-9]+$');

    v_candidate := 'ALB/' || v_year || '/' || lpad(v_next::text, 4, '0');

    IF NOT EXISTS (SELECT 1 FROM public.students WHERE admission_number = v_candidate) THEN
      RETURN v_candidate;
    END IF;
  END LOOP;

  RETURN 'ALB/' || v_year || '/' || lpad((v_next + floor(random() * 1000)::int)::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_admission_number() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_admission_number() TO service_role;

GRANT EXECUTE ON FUNCTION public.next_admission_number() TO authenticated;


-- ===== 20260730200050_d92d08de-498b-412d-9704-82a9b4423e9e.sql =====

CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_start date, p_end date, p_class_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb) INTO v_rows FROM (
    SELECT s.id AS student_id, p.full_name, s.admission_number, c.name AS class_name,
      COUNT(*) FILTER (WHERE sa.status='present') AS present,
      COUNT(*) FILTER (WHERE sa.status='absent') AS absent,
      COUNT(*) FILTER (WHERE sa.status='late') AS late,
      COUNT(sa.id) AS total
    FROM students s
    LEFT JOIN profiles p ON p.user_id = s.user_id
    LEFT JOIN class_assignments ca ON ca.student_id = s.id
    LEFT JOIN classes c ON c.id = ca.class_id
    LEFT JOIN attendance_sessions ses ON ses.date BETWEEN p_start AND p_end
    LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.attendance_session_id = ses.id
    WHERE (p_class_id IS NULL OR ca.class_id = p_class_id)
    GROUP BY s.id, p.full_name, s.admission_number, c.name
  ) t;
  RETURN jsonb_build_object('rows', v_rows, 'start', p_start, 'end', p_end);
END; $function$;


-- ===== 20260730203656_44723a66-528b-4bc7-817f-28b68b571867.sql =====

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;

GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expense categories" ON public.expense_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  payee text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'manual',
  recorded_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

CREATE TABLE public.revenue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_categories TO authenticated;

GRANT ALL ON public.revenue_categories TO service_role;

ALTER TABLE public.revenue_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage revenue categories" ON public.revenue_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.other_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.revenue_categories(id) ON DELETE SET NULL,
  source text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_revenue TO authenticated;

GRANT ALL ON public.other_revenue TO service_role;

ALTER TABLE public.other_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage other revenue" ON public.other_revenue FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_other_revenue_date ON public.other_revenue(revenue_date);

CREATE TABLE public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'allowance',
  amount numeric NOT NULL DEFAULT 0,
  is_percentage boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_components TO authenticated;

GRANT ALL ON public.salary_components TO service_role;

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary components" ON public.salary_components FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Staff view own salary components" ON public.salary_components FOR SELECT TO authenticated USING (staff_id = auth.uid());

CREATE INDEX idx_salary_components_staff ON public.salary_components(staff_id);

ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS basic_salary numeric NOT NULL DEFAULT 0;

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_other_revenue_updated BEFORE UPDATE ON public.other_revenue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_revenue_categories_updated BEFORE UPDATE ON public.revenue_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_salary_components_updated BEFORE UPDATE ON public.salary_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.expense_categories (name, description) VALUES
  ('Salaries & Wages','Staff payroll'),
  ('Utilities','Electricity, water, internet'),
  ('Maintenance & Repairs','Buildings, equipment'),
  ('Teaching Supplies','Books, stationery, lab materials'),
  ('Transport & Fuel','Buses, fuel, logistics'),
  ('Administrative','Office and general admin costs')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.revenue_categories (name, description) VALUES
  ('Uniforms','Uniform sales'),
  ('Books & Stationery','Book sales'),
  ('Events','Events and excursions'),
  ('Donations','Donations and grants'),
  ('Facility Rental','Hall and facility hire'),
  ('Other','Miscellaneous income')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_finance_summary(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fees numeric := 0;
  v_other numeric := 0;
  v_exp numeric := 0;
  v_by_month jsonb;
  v_exp_cat jsonb;
  v_rev_cat jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(SUM(amount_paid),0) INTO v_fees
  FROM public.fee_payments
  WHERE status = 'completed'
    AND COALESCE(payment_date::date, created_at::date) BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(amount),0) INTO v_other
  FROM public.other_revenue WHERE revenue_date BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(amount),0) INTO v_exp
  FROM public.expenses WHERE status <> 'rejected' AND expense_date BETWEEN p_start AND p_end;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.month), '[]'::jsonb) INTO v_by_month FROM (
    SELECT m.month::text AS month,
      COALESCE((SELECT SUM(amount_paid) FROM public.fee_payments fp WHERE fp.status='completed'
        AND date_trunc('month', COALESCE(fp.payment_date::date, fp.created_at::date)) = m.month),0)
      + COALESCE((SELECT SUM(amount) FROM public.other_revenue orv WHERE date_trunc('month', orv.revenue_date) = m.month),0) AS income,
      COALESCE((SELECT SUM(amount) FROM public.expenses e WHERE e.status <> 'rejected' AND date_trunc('month', e.expense_date) = m.month),0) AS expenses
    FROM (SELECT generate_series(date_trunc('month', p_start), date_trunc('month', p_end), interval '1 month') AS month) m
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_exp_cat FROM (
    SELECT COALESCE(c.name,'Uncategorised') AS name, SUM(e.amount) AS amount
    FROM public.expenses e LEFT JOIN public.expense_categories c ON c.id = e.category_id
    WHERE e.status <> 'rejected' AND e.expense_date BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY 2 DESC
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_rev_cat FROM (
    SELECT COALESCE(c.name,'Uncategorised') AS name, SUM(r.amount) AS amount
    FROM public.other_revenue r LEFT JOIN public.revenue_categories c ON c.id = r.category_id
    WHERE r.revenue_date BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY 2 DESC
  ) t;

  RETURN jsonb_build_object(
    'fee_income', v_fees,
    'other_income', v_other,
    'total_income', v_fees + v_other,
    'total_expenses', v_exp,
    'surplus', (v_fees + v_other) - v_exp,
    'by_month', v_by_month,
    'expenses_by_category', v_exp_cat,
    'revenue_by_category', v_rev_cat
  );
END;
$$;


-- ===== 20260730204939_912218d9-9145-492f-9ff1-82525bb8b8c4.sql =====

CREATE POLICY "Staff can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_teacher());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requested text;
  v_role app_role;
BEGIN
  v_requested := lower(coalesce(NEW.raw_user_meta_data ->> 'role', 'student'));

  -- Self-service signup may only create students or parents. Teacher/admin
  -- accounts are provisioned server-side (edge functions / admin tools).
  IF v_requested = 'parent' THEN
    v_role := 'parent'::app_role;
  ELSE
    v_role := 'student'::app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (NEW.id, v_role, NEW.id)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'parent' THEN
    INSERT INTO public.parents (user_id, phone_primary)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;


-- ===== 20260730210952_00e10ec8-4957-49bd-8abe-de99b6b9f89f.sql =====

-- 1. Parent children: match class assignment on student id OR auth user id
CREATE OR REPLACE FUNCTION public.get_parent_children()
 RETURNS TABLE(student_id uuid, full_name text, admission_number text, gender text, date_of_birth date, status text, class_id uuid, class_name text, relationship_id uuid, can_view_grades boolean, can_view_attendance boolean, can_view_fees boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (s.id)
         s.id, pr.full_name, s.admission_number, s.gender, s.date_of_birth, s.status,
         c.id, c.name, spr.id,
         spr.can_view_grades, spr.can_view_attendance, spr.can_view_fees
  FROM public.parents p
  JOIN public.student_parent_relationships spr ON spr.parent_id = p.id
  JOIN public.students s ON s.id = spr.student_id
  LEFT JOIN public.profiles pr ON pr.user_id = s.user_id
  LEFT JOIN public.class_assignments ca
    ON ca.student_id = s.id OR ca.student_id = s.user_id
  LEFT JOIN public.classes c ON c.id = ca.class_id
  WHERE p.user_id = auth.uid()
  ORDER BY s.id, c.name NULLS LAST;
$function$;

-- 2. Staff self-service fields
ALTER TABLE public.staff_details
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS next_of_kin jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_details TO authenticated;

GRANT ALL ON public.staff_details TO service_role;

DROP POLICY IF EXISTS "Staff view own details" ON public.staff_details;

CREATE POLICY "Staff view own details" ON public.staff_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Staff update own details" ON public.staff_details;

CREATE POLICY "Staff update own details" ON public.staff_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- staff may not change their own pay or identity fields
CREATE OR REPLACE FUNCTION public.protect_staff_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id = auth.uid() THEN
    NEW.salary := OLD.salary;
    NEW.employee_id := OLD.employee_id;
    NEW.designation := OLD.designation;
    NEW.department := OLD.department;
    NEW.employment_type := OLD.employment_type;
    NEW.status := OLD.status;
    NEW.join_date := OLD.join_date;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_staff_self_update ON public.staff_details;

CREATE TRIGGER trg_protect_staff_self_update
  BEFORE UPDATE ON public.staff_details
  FOR EACH ROW EXECUTE FUNCTION public.protect_staff_self_update();

-- 3. Payroll lifecycle fields
ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS pay_date date,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- 4. Next employee id helper
CREATE OR REPLACE FUNCTION public.next_employee_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_next int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_id, '^.*/', ''), '')::int), 0) + 1
    INTO v_next
  FROM public.staff_details
  WHERE employee_id LIKE 'ALB/STF/%'
    AND regexp_replace(employee_id, '^.*/', '') ~ '^[0-9]+$';
  RETURN 'ALB/STF/' || LPAD(v_next::text, 4, '0');
END;
$$;


-- ===== 20260730213010_364435a5-ae86-446b-8b62-b21b7c19797a.sql =====

-- 1. Sequence-backed employee IDs
CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START 1;

CREATE OR REPLACE FUNCTION public.next_employee_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  LOOP
    v_id := 'ALB/STF/' || LPAD(nextval('public.employee_id_seq')::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.staff_details WHERE employee_id = v_id);
  END LOOP;
  RETURN v_id;
END;
$$;

-- Re-issue unique IDs to existing rows
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.staff_details
)
UPDATE public.staff_details s
SET employee_id = 'ALB/STF/' || LPAD(o.rn::text, 4, '0')
FROM ordered o
WHERE s.id = o.id;

SELECT setval('public.employee_id_seq', GREATEST((SELECT COUNT(*) FROM public.staff_details), 1));

CREATE UNIQUE INDEX IF NOT EXISTS staff_details_employee_id_key
  ON public.staff_details (employee_id) WHERE employee_id IS NOT NULL;

-- Auto-assign employee_id when missing
CREATE OR REPLACE FUNCTION public.set_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR btrim(NEW.employee_id) = '' THEN
    NEW.employee_id := public.next_employee_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_employee_id ON public.staff_details;

CREATE TRIGGER trg_set_employee_id
BEFORE INSERT ON public.staff_details
FOR EACH ROW EXECUTE FUNCTION public.set_employee_id();

-- 2. One attendance row per staff per day
DELETE FROM public.staff_attendance a
USING public.staff_attendance b
WHERE a.staff_id = b.staff_id AND a.date = b.date AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS staff_attendance_staff_date_key
  ON public.staff_attendance (staff_id, date);

-- 3. Attach unallocated acceptance-fee credits to the student's tuition structure
UPDATE public.fee_payments fp
SET fee_structure_id = fs.id
FROM public.class_assignments ca
JOIN public.fee_structures fs
  ON fs.class_id = ca.class_id AND fs.is_mandatory = true
WHERE fp.student_id = ca.student_id
  AND fp.fee_structure_id IS NULL
  AND fp.status = 'completed'
  AND fs.id = (
    SELECT f2.id FROM public.fee_structures f2
    WHERE f2.class_id = ca.class_id AND f2.is_mandatory = true
    ORDER BY f2.created_at DESC LIMIT 1
  );


-- ===== 20260731074848_240b7b16-8604-402c-b2ee-6e65e8d0a8cf.sql =====

CREATE UNIQUE INDEX IF NOT EXISTS gradebook_entries_unique_term_score
  ON public.gradebook_entries (student_id, subject_id, class_id, session_id, term);


-- ===== 20260731183411_11957234-20f6-40e0-a017-d2a68bca9ed3.sql =====

-- 1. Application / student flags
ALTER TABLE public.admission_applications ADD COLUMN IF NOT EXISTS boarding_interest boolean NOT NULL DEFAULT false;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_boarder boolean NOT NULL DEFAULT false;

-- 2. Hostels
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL DEFAULT 'mixed',
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostels TO authenticated;

GRANT ALL ON public.hostels TO service_role;

ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type text NOT NULL DEFAULT 'dormitory',
  capacity int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, room_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_rooms TO authenticated;

GRANT ALL ON public.hostel_rooms TO service_role;

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hostel_wardens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'warden',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_wardens TO authenticated;

GRANT ALL ON public.hostel_wardens TO service_role;

ALTER TABLE public.hostel_wardens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  bed_label text,
  status text NOT NULL DEFAULT 'active',
  allocated_on date NOT NULL DEFAULT CURRENT_DATE,
  checked_out_on date,
  reason text,
  allocated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_allocations TO authenticated;

GRANT ALL ON public.hostel_allocations TO service_role;

ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS hostel_allocations_one_active
  ON public.hostel_allocations (student_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.hostel_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.hostel_rooms(id) ON DELETE SET NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_id uuid,
  cleanliness_score int,
  discipline_score int,
  notes text,
  follow_up_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_inspections TO authenticated;

GRANT ALL ON public.hostel_inspections TO service_role;

ALTER TABLE public.hostel_inspections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hostel_exeat_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hostel_id uuid REFERENCES public.hostels(id) ON DELETE SET NULL,
  pass_type text NOT NULL DEFAULT 'exeat',
  out_at timestamptz NOT NULL,
  expected_back_at timestamptz NOT NULL,
  returned_at timestamptz,
  destination text,
  guardian_contact text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_exeat_passes TO authenticated;

GRANT ALL ON public.hostel_exeat_passes TO service_role;

ALTER TABLE public.hostel_exeat_passes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hostel_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  roll_date date NOT NULL DEFAULT CURRENT_DATE,
  roll_session text NOT NULL DEFAULT 'night',
  status text NOT NULL DEFAULT 'present',
  notes text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, student_id, roll_date, roll_session)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hostel_attendance TO authenticated;

GRANT ALL ON public.hostel_attendance TO service_role;

ALTER TABLE public.hostel_attendance ENABLE ROW LEVEL SECURITY;

-- 3. Helpers
CREATE OR REPLACE FUNCTION public.is_hostel_warden(_hostel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hostel_wardens w WHERE w.hostel_id = _hostel_id AND w.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.hostel_of_room(_room_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hostel_id FROM public.hostel_rooms WHERE id = _room_id
$$;

-- 4. Policies
CREATE POLICY "hostels_read" ON public.hostels FOR SELECT TO authenticated USING (true);

CREATE POLICY "hostels_write" ON public.hostels FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "hostel_rooms_read" ON public.hostel_rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "hostel_rooms_write" ON public.hostel_rooms FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "hostel_wardens_read" ON public.hostel_wardens FOR SELECT TO authenticated USING (true);

CREATE POLICY "hostel_wardens_write" ON public.hostel_wardens FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "hostel_allocations_read" ON public.hostel_allocations FOR SELECT TO authenticated
  USING (
    public.is_teacher()
    OR public.is_my_student_record(student_id)
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "hostel_allocations_write" ON public.hostel_allocations FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_hostel_warden(public.hostel_of_room(room_id)))
  WITH CHECK (public.is_admin() OR public.is_hostel_warden(public.hostel_of_room(room_id)));

CREATE POLICY "hostel_inspections_read" ON public.hostel_inspections FOR SELECT TO authenticated
  USING (public.is_teacher());

CREATE POLICY "hostel_inspections_write" ON public.hostel_inspections FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_hostel_warden(hostel_id))
  WITH CHECK (public.is_admin() OR public.is_hostel_warden(hostel_id));

CREATE POLICY "hostel_passes_read" ON public.hostel_exeat_passes FOR SELECT TO authenticated
  USING (
    public.is_teacher()
    OR public.is_my_student_record(student_id)
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "hostel_passes_write" ON public.hostel_exeat_passes FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_hostel_warden(hostel_id))
  WITH CHECK (public.is_admin() OR public.is_hostel_warden(hostel_id));

CREATE POLICY "hostel_attendance_read" ON public.hostel_attendance FOR SELECT TO authenticated
  USING (
    public.is_teacher()
    OR public.is_my_student_record(student_id)
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "hostel_attendance_write" ON public.hostel_attendance FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_hostel_warden(hostel_id))
  WITH CHECK (public.is_admin() OR public.is_hostel_warden(hostel_id));

-- 5. Validation trigger: capacity + gender
CREATE OR REPLACE FUNCTION public.validate_hostel_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity int;
  v_used int;
  v_hostel_gender text;
  v_student_gender text;
  v_hostel_id uuid;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  SELECT r.capacity, r.hostel_id, h.gender
    INTO v_capacity, v_hostel_id, v_hostel_gender
  FROM public.hostel_rooms r JOIN public.hostels h ON h.id = r.hostel_id
  WHERE r.id = NEW.room_id;

  SELECT COUNT(*) INTO v_used
  FROM public.hostel_allocations a
  WHERE a.room_id = NEW.room_id AND a.status = 'active' AND a.id <> COALESCE(NEW.id, gen_random_uuid());

  IF v_used >= COALESCE(v_capacity, 0) THEN
    RAISE EXCEPTION 'This room is full (capacity %)', v_capacity;
  END IF;

  SELECT lower(gender) INTO v_student_gender FROM public.students WHERE id = NEW.student_id;
  IF v_hostel_gender IN ('male','female') AND v_student_gender IS NOT NULL
     AND v_student_gender <> v_hostel_gender THEN
    RAISE EXCEPTION 'This hostel is % only', v_hostel_gender;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_hostel_allocation ON public.hostel_allocations;

CREATE TRIGGER trg_validate_hostel_allocation
  BEFORE INSERT OR UPDATE ON public.hostel_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_hostel_allocation();

-- 6. updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hostels','hostel_rooms','hostel_wardens','hostel_allocations','hostel_inspections','hostel_exeat_passes','hostel_attendance']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- 7. Occupancy RPC
CREATE OR REPLACE FUNCTION public.get_hostel_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'name'), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'id', h.id, 'name', h.name, 'gender', h.gender, 'is_active', h.is_active,
      'rooms', (SELECT COUNT(*) FROM public.hostel_rooms r WHERE r.hostel_id = h.id),
      'capacity', COALESCE((SELECT SUM(r.capacity) FROM public.hostel_rooms r WHERE r.hostel_id = h.id), 0),
      'occupied', COALESCE((SELECT COUNT(*) FROM public.hostel_allocations a
          JOIN public.hostel_rooms r ON r.id = a.room_id
          WHERE r.hostel_id = h.id AND a.status = 'active'), 0)
    ) AS t
    FROM public.hostels h
  ) x;
  RETURN v;
END; $$;

-- 8. Application submission accepts boarding interest
CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class_id uuid; v_new_id uuid; v_app_no text;
BEGIN
  v_class_id := NULLIF(payload->>'applying_for_class_id','')::uuid;
  INSERT INTO public.admission_applications (
    application_number, status, first_name, middle_name, last_name,
    date_of_birth, gender, blood_group, state_of_origin, lga, nationality, religion,
    email, phone, address, previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs, boarding_interest
  ) VALUES (
    NULL, 'submitted', payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date, payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga', COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion', payload->>'email', payload->>'phone',
    COALESCE(payload->'address','{}'::jsonb), payload->>'previous_school', payload->>'previous_class',
    v_class_id, COALESCE(payload->'parent_guardian_info','{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs',
    COALESCE((payload->>'boarding_interest')::boolean, false)
  ) RETURNING id, application_number INTO v_new_id, v_app_no;
  RETURN jsonb_build_object('id', v_new_id, 'application_number', v_app_no);
END $$;

-- ============================================================
-- Data API grants (required: Supabase does not grant these by default)
-- ============================================================
DO $grants$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE c.relkind IN ('r','v') AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END;
$grants$;

-- Public website / applicant-facing reads
DO $anon$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'website_pages','website_sections','website_settings','school_info',
    'news_articles','gallery','testimonials','job_openings',
    'academic_calendar','classes','subjects','admission_sessions','app_settings'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    END IF;
  END LOOP;
END;
$anon$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
