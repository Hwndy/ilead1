import { supabase } from '@/integrations/supabase/client';

export interface RosterStudent {
  student_id: string;
  user_id: string | null;
  full_name: string;
  admission_number: string | null;
  status: string | null;
  photo_url: string | null;
}

/**
 * Loads every student in a class.
 *
 * `class_assignments.student_id` historically holds either the student's
 * record id or their auth user id, so both are resolved. Names come from
 * `profiles` when available and fall back to the admission number, so a
 * missing profile never removes a student from the roster.
 */
export async function fetchClassRoster(classId: string): Promise<RosterStudent[]> {
  if (!classId) return [];

  const { data: assigns, error } = await supabase
    .from('class_assignments')
    .select('student_id')
    .eq('class_id', classId);
  if (error) throw error;

  const refs = Array.from(new Set((assigns || []).map((a: any) => a.student_id).filter(Boolean)));
  if (refs.length === 0) return [];

  const [byId, byUser] = await Promise.all([
    supabase.from('students').select('id, user_id, admission_number, status, photo_url').in('id', refs),
    supabase.from('students').select('id, user_id, admission_number, status, photo_url').in('user_id', refs),
  ]);

  const students = new Map<string, any>();
  [...(byId.data || []), ...(byUser.data || [])].forEach(s => students.set(s.id, s));
  if (students.size === 0) return [];

  const userIds = Array.from(students.values()).map(s => s.user_id).filter(Boolean);
  const nameByUser = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    (profs || []).forEach((p: any) => nameByUser.set(p.user_id, p.full_name));
  }

  return Array.from(students.values())
    .map(s => ({
      student_id: s.id,
      user_id: s.user_id ?? null,
      full_name: (s.user_id && nameByUser.get(s.user_id)) || s.admission_number || 'Unnamed student',
      admission_number: s.admission_number ?? null,
      status: s.status ?? null,
      photo_url: s.photo_url ?? null,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export interface StudentClass {
  class_id: string | null;
  class_name: string;
}

/**
 * Resolves every student's class in one pass.
 *
 * `class_assignments.student_id` holds either the student's auth/profile user
 * id or the `students.id`, so both are matched. Keyed by `students.id`.
 */
export async function fetchStudentClassMap(): Promise<Map<string, StudentClass>> {
  const [assignsRes, studentsRes, classesRes] = await Promise.all([
    supabase.from('class_assignments').select('student_id, class_id'),
    supabase.from('students').select('id, user_id'),
    supabase.from('classes').select('id, name'),
  ]);
  if (assignsRes.error) throw assignsRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (classesRes.error) throw classesRes.error;

  const className = new Map<string, string>((classesRes.data || []).map((c: any) => [c.id, c.name]));
  const byRef = new Map<string, string>(); // assignment ref -> class_id
  (assignsRes.data || []).forEach((a: any) => {
    if (a.student_id && a.class_id && !byRef.has(a.student_id)) byRef.set(a.student_id, a.class_id);
  });

  const out = new Map<string, StudentClass>();
  (studentsRes.data || []).forEach((s: any) => {
    const classId = byRef.get(s.id) || (s.user_id ? byRef.get(s.user_id) : undefined) || null;
    out.set(s.id, { class_id: classId, class_name: classId ? className.get(classId) || '' : '' });
  });
  return out;
}

/** Resolves a single student's class, matching on both id shapes. */
export async function fetchStudentClass(studentId: string): Promise<StudentClass> {
  const { data: student } = await supabase
    .from('students')
    .select('id, user_id')
    .eq('id', studentId)
    .maybeSingle();

  const refs = [studentId, (student as any)?.user_id].filter(Boolean) as string[];
  const { data } = await supabase
    .from('class_assignments')
    .select('class_id, classes(id, name)')
    .in('student_id', refs)
    .limit(1);

  const row: any = (data || [])[0];
  return { class_id: row?.class_id ?? null, class_name: row?.classes?.name ?? '' };
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
