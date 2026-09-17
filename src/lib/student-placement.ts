import { supabase } from '@/integrations/supabase/client';
import { fetchStudentClassMap } from '@/lib/class-roster';

const db = supabase as any;

export interface Placement {
  campus_id: string | null;
  campus_name: string;
  arm_id: string | null;
  arm_name: string;
  class_id: string | null;
  class_name: string;
  /** "JSS 1 A — Ebutte" style label for lists and cards. */
  label: string;
}

export const EMPTY_PLACEMENT: Placement = {
  campus_id: null, campus_name: '', arm_id: null, arm_name: '',
  class_id: null, class_name: '', label: '',
};

export interface CampusOption { id: string; name: string; code: string | null }
export interface ArmOption { id: string; name: string; class_id: string; campus_id: string }

const makeLabel = (className: string, armName: string, campusName: string) => {
  const cls = [className, armName].filter(Boolean).join(' ');
  return [cls, campusName].filter(Boolean).join(' — ');
};

/** Campuses and arms for filters and pickers. Empty when structure is unavailable. */
export async function fetchStructureOptions(): Promise<{ campuses: CampusOption[]; arms: ArmOption[] }> {
  try {
    const [{ data: campuses }, { data: arms }] = await Promise.all([
      db.from('campuses').select('id, name, code').eq('is_active', true).order('name'),
      db.from('class_arms').select('id, name, class_id, campus_id').eq('is_active', true).order('name'),
    ]);
    return {
      campuses: ((campuses || []) as any[]).map(c => ({ id: c.id, name: c.name, code: c.code ?? null })),
      arms: ((arms || []) as any[]).map(a => ({ id: a.id, name: a.name, class_id: a.class_id, campus_id: a.campus_id })),
    };
  } catch {
    return { campuses: [], arms: [] };
  }
}

/**
 * Campus, arm and class for every current student, keyed by `students.id`.
 * Class falls back to the legacy class assignment so pupils placed before the
 * campus/arm structure existed still show a class.
 */
export async function fetchPlacementMap(): Promise<Map<string, Placement>> {
  const map = new Map<string, Placement>();
  const classMap = await fetchStudentClassMap().catch(() => new Map());

  let students: any[] = [];
  let campusById = new Map<string, any>();
  let armById = new Map<string, any>();
  try {
    const [stRes, cRes, aRes] = await Promise.all([
      db.from('students').select('id, campus_id, arm_id').is('archived_at', null),
      db.from('campuses').select('id, name'),
      db.from('class_arms').select('id, name, class_id, campus_id'),
    ]);
    students = (stRes.data || []) as any[];
    campusById = new Map(((cRes.data || []) as any[]).map(c => [c.id, c]));
    armById = new Map(((aRes.data || []) as any[]).map(a => [a.id, a]));
  } catch {
    students = [];
  }

  // Classes (for arms whose class is not in the legacy assignment).
  let classNameById = new Map<string, string>();
  try {
    const { data } = await supabase.from('classes').select('id, name');
    classNameById = new Map(((data || []) as any[]).map(c => [c.id, c.name]));
  } catch { /* ignore */ }

  const build = (studentId: string, campusId: string | null, armId: string | null) => {
    const arm = armId ? armById.get(armId) : null;
    const campus = campusId ? campusById.get(campusId) : arm ? campusById.get(arm.campus_id) : null;
    const legacy = (classMap as Map<string, any>).get(studentId);
    const classId = arm?.class_id || legacy?.class_id || null;
    const className = (classId && classNameById.get(classId)) || legacy?.class_name || '';
    const placement: Placement = {
      campus_id: campus?.id ?? campusId ?? null,
      campus_name: campus?.name || '',
      arm_id: arm?.id ?? null,
      arm_name: arm?.name || '',
      class_id: classId,
      class_name: className,
      label: makeLabel(className, arm?.name || '', campus?.name || ''),
    };
    map.set(studentId, placement);
  };

  students.forEach(s => build(s.id, s.campus_id ?? null, s.arm_id ?? null));
  // Students missing from the structure query still get their legacy class.
  (classMap as Map<string, any>).forEach((v, k) => {
    if (!map.has(k)) {
      map.set(k, {
        ...EMPTY_PLACEMENT,
        class_id: v.class_id ?? null,
        class_name: v.class_name || '',
        label: v.class_name || '',
      });
    }
  });
  return map;
}

/** Placement for a single student. */
export async function fetchPlacement(studentId: string): Promise<Placement> {
  if (!studentId) return EMPTY_PLACEMENT;
  try {
    const { data: s } = await db
      .from('students').select('id, campus_id, arm_id').eq('id', studentId).maybeSingle();
    const campusId = s?.campus_id ?? null;
    const armId = s?.arm_id ?? null;

    const [campusRes, armRes] = await Promise.all([
      campusId ? db.from('campuses').select('id, name').eq('id', campusId).maybeSingle() : Promise.resolve({ data: null }),
      armId ? db.from('class_arms').select('id, name, class_id, campus_id').eq('id', armId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const arm = armRes?.data || null;
    let campus = campusRes?.data || null;
    if (!campus && arm?.campus_id) {
      const { data } = await db.from('campuses').select('id, name').eq('id', arm.campus_id).maybeSingle();
      campus = data;
    }

    let className = '';
    let classId: string | null = arm?.class_id ?? null;
    if (!classId) {
      const { data: assign } = await supabase
        .from('class_assignments').select('class_id').eq('student_id', studentId).maybeSingle();
      classId = assign?.class_id ?? null;
    }
    if (classId) {
      const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).maybeSingle();
      className = cls?.name || '';
    }

    return {
      campus_id: campus?.id ?? null,
      campus_name: campus?.name || '',
      arm_id: arm?.id ?? null,
      arm_name: arm?.name || '',
      class_id: classId,
      class_name: className,
      label: makeLabel(className, arm?.name || '', campus?.name || ''),
    };
  } catch {
    return EMPTY_PLACEMENT;
  }
}
