import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ReportCardData,
  ReportCardSchoolInfo,
  ReportCardAutomation,
  DEFAULT_REPORT_CARD_AUTOMATION,
  generateReportCardHTML,
  getReportCardGrade,
  openReportCardPrintWindow,
} from '@/lib/report-card-html';
import { fetchSchoolBranding } from '@/lib/school-branding';

const TERM_VALUES: Record<string, 'first' | 'second' | 'third'> = {
  'First Term': 'first',
  'Second Term': 'second',
  'Third Term': 'third',
};

interface Args {
  studentId: string;
  classId: string;
  sessionId: string;
  term: string; // "First Term" | "Second Term" | "Third Term"
}

/**
 * Rebuilds the printable report card for a single student.
 * Uses the same scoring source (v_student_term_scores) as the admin generator so
 * parents/students see the exact same numbers.
 */
export function useReportCardBuilder() {
  const buildHtml = useCallback(async ({ studentId, classId, sessionId, term }: Args): Promise<{ html: string; filename: string; studentName: string; admissionNumber: string; }> => {
    // Fetch context in parallel
    const termValue = TERM_VALUES[term] || 'first';
    const [sessionRes, classRes, branding] = await Promise.all([
      supabase.from('admission_sessions').select('id, session_name, academic_year').eq('id', sessionId).maybeSingle(),
      supabase.from('classes').select('id, name').eq('id', classId).maybeSingle(),
      fetchSchoolBranding(),
    ]);

    const academicYear = sessionRes.data?.academic_year || '';
    const className = classRes.data?.name || '';

    // Student profile + academic details
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, user_id, admission_number, age, gender, weight, height, section, photo_url')
      .eq('id', studentId)
      .maybeSingle();
    if (!studentRow) throw new Error('Student not found');
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', studentRow.user_id)
      .maybeSingle();

    // Class-wide scores for positioning
    const { data: classAssignments } = await supabase
      .from('class_assignments')
      .select('student_id')
      .eq('class_id', classId);
    const classStudentUserIds = (classAssignments || []).map((c: any) => c.student_id);
    let classStudentIds: string[] = [];
    if (classStudentUserIds.length) {
      const { data: classStudents } = await supabase
        .from('students')
        .select('id, user_id')
        .in('user_id', classStudentUserIds);
      classStudentIds = (classStudents || []).map((s: any) => s.id);
    }
    if (!classStudentIds.includes(studentId)) classStudentIds.push(studentId);

    const [scoresRes, subjectsRes, commentsRes, attendanceRes] = await Promise.all([
      supabase
        .from('v_student_term_scores')
        .select('*')
        .in('student_id', classStudentIds)
        .eq('class_id', classId)
        .eq('session_id', sessionId)
        .eq('term', termValue),
      supabase.from('subjects').select('id, name'),
      supabase
        .from('report_card_comments')
        .select('*')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('term', term)
        .eq('academic_year', academicYear)
        .maybeSingle(),
      supabase
        .from('attendance_summary')
        .select('*')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('term', term)
        .eq('academic_year', academicYear)
        .maybeSingle(),
    ]);

    const scores = scoresRes.data || [];
    const subjectMap = new Map<string, string>(
      (subjectsRes.data || []).map((s: any) => [s.id, s.name as string]),
    );

    // Per-subject stats
    const subjectStats: Record<string, { scores: number[]; highest: number; lowest: number; average: number }> = {};
    for (const r of scores) {
      const total =
        (Number((r as any).test1) || 0) +
        (Number((r as any).test2) || 0) +
        (Number((r as any).exam_score) || 0);
      const sid = (r as any).subject_id as string;
      if (!subjectStats[sid]) subjectStats[sid] = { scores: [], highest: 0, lowest: 100, average: 0 };
      subjectStats[sid].scores.push(total);
    }
    for (const k of Object.keys(subjectStats)) {
      const s = subjectStats[k];
      s.highest = Math.max(...s.scores);
      s.lowest = Math.min(...s.scores);
      s.average = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
    }

    // Averages -> positions
    const perStudent = new Map<string, { total: number; max: number }>();
    for (const r of scores) {
      const sid = (r as any).student_id as string;
      const t =
        (Number((r as any).test1) || 0) +
        (Number((r as any).test2) || 0) +
        (Number((r as any).exam_score) || 0);
      const entry = perStudent.get(sid) || { total: 0, max: 0 };
      entry.total += t;
      entry.max += 100;
      perStudent.set(sid, entry);
    }
    const averages = Array.from(perStudent.entries()).map(([id, v]) => ({
      id,
      average: v.max > 0 ? (v.total / v.max) * 100 : 0,
    }));
    averages.sort((a, b) => b.average - a.average);
    const positionMap = new Map(averages.map((s, i) => [s.id, i + 1]));

    const allAverages = averages.map(a => a.average);
    const classAverage = allAverages.length ? allAverages.reduce((a, b) => a + b, 0) / allAverages.length : 0;
    const highestAverage = allAverages.length ? Math.max(...allAverages) : 0;
    const lowestAverage = allAverages.length ? Math.min(...allAverages) : 0;

    // This student's grades
    const myScores = scores.filter((r: any) => r.student_id === studentId);
    const grades = myScores.map((r: any) => {
      const t = (Number(r.test1) || 0) + (Number(r.test2) || 0) + (Number(r.exam_score) || 0);
      const stats = subjectStats[r.subject_id];
      const sorted = (stats?.scores || []).slice().sort((a, b) => b - a);
      const subjectPosition = sorted.indexOf(t) + 1;
      const { grade, remark } = getReportCardGrade(t);
      return {
        subject_name: subjectMap.get(r.subject_id) || 'Unknown',
        test1_score: Number(r.test1) || 0,
        test2_score: Number(r.test2) || 0,
        exam_score: Number(r.exam_score) || 0,
        total: t,
        grade,
        subject_position: subjectPosition || 1,
        class_average: Math.round((stats?.average || 0) * 10) / 10,
        highest_in_class: stats?.highest || 0,
        lowest_in_class: stats?.lowest || 0,
        remark,
      };
    });

    const totalObtained = grades.reduce((s, g) => s + g.total, 0);
    const totalMax = grades.length * 100;
    const average = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const overallGrade = getReportCardGrade(average).grade;

    const card: ReportCardData = {
      student_name: prof?.full_name || '',
      registration_number: studentRow.admission_number || 'N/A',
      class_name: className,
      section: (studentRow as any).section || '',
      term,
      academic_year: academicYear,
      age: (studentRow as any).age ?? null,
      gender: (studentRow as any).gender || 'N/A',
      weight: (studentRow as any).weight ?? null,
      height: (studentRow as any).height ?? null,
      photo_url: (studentRow as any).photo_url ?? null,
      grades,
      total_obtained: totalObtained,
      total_max: totalMax,
      average: Math.round(average * 10) / 10,
      position: positionMap.get(studentId) || 1,
      total_students: Math.max(classStudentIds.length, averages.length || 1),
      overall_grade: overallGrade,
      attendance: {
        days_school_opened: (attendanceRes.data as any)?.days_school_opened || 0,
        days_present: (attendanceRes.data as any)?.days_present || 0,
        days_absent: (attendanceRes.data as any)?.days_absent || 0,
      },
      comments: {
        class_teacher_comment: (commentsRes.data as any)?.class_teacher_comment || '',
        head_teacher_comment: (commentsRes.data as any)?.head_teacher_comment || '',
        principal_comment: (commentsRes.data as any)?.principal_comment || '',
      },
      class_average: Math.round(classAverage * 10) / 10,
      highest_average: Math.round(highestAverage * 10) / 10,
      lowest_average: Math.round(lowestAverage * 10) / 10,
    };

    const school: ReportCardSchoolInfo = { ...branding };
    const automation: ReportCardAutomation = DEFAULT_REPORT_CARD_AUTOMATION;

    const html = generateReportCardHTML(card, school, automation);
    const safeName = (prof?.full_name || 'student').replace(/[^a-z0-9]+/gi, '_');
    const filename = `${(studentRow as any).admission_number || studentId}_${safeName}.pdf`;
    return { html, filename, studentName: prof?.full_name || '', admissionNumber: (studentRow as any).admission_number || '' };
  }, []);

  const buildAndPrint = useCallback(async (args: Args) => {
    const { html } = await buildHtml(args);
    openReportCardPrintWindow(html);
  }, [buildHtml]);

  return { buildAndPrint, buildHtml };
}