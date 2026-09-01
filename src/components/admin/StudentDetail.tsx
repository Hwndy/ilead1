import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Mail, Phone, Calendar, MapPin, User, GraduationCap, Receipt, Users as UsersIcon } from 'lucide-react';
import { Pencil, KeyRound, Loader2 } from 'lucide-react';
import { EditStudentDialog } from './EditStudentDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const makeTempPassword = () => {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (src: string, n: number) =>
    Array.from({ length: n }, () => src[Math.floor(Math.random() * src.length)]).join('');
  return `Alb${pick(letters, 5)}${pick(digits, 3)}`;
};

const initials = (n?: string) =>
  (n || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const computeAge = (dob?: string | null): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
};

export const StudentDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = new URLSearchParams(location.search);
  const userId = params.get('id');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [application, setApplication] = useState<any>(null);

  const resetLoginPassword = async () => {
    if (!userId) return;
    setResetting(true);
    const password = makeTempPassword();
    const { data, error } = await supabase.functions.invoke('update-user-password', {
      body: { userId, newPassword: password },
    });
    setResetting(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Could not reset password',
        description: (data as any)?.error || error?.message || 'Please try again.',
        variant: 'destructive',
      });
      return;
    }
    setNewPassword(password);
  };

  useEffect(() => { if (userId) load(); }, [userId]); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prof }, { data: stu }, { data: assign }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('students').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('class_assignments').select('class_id').eq('student_id', userId).maybeSingle(),
      ]);
      setProfile(prof);
      setStudent(stu);

      if (stu?.id) {
        const { data: app } = await supabase
          .from('admission_applications')
          .select('id, application_number, email, login_email')
          .eq('student_id', stu.id)
          .maybeSingle();
        setApplication(app ?? null);
      }

      if (assign?.class_id) {
        const { data: cls } = await supabase.from('classes').select('name').eq('id', assign.class_id).maybeSingle();
        setClassName(cls?.name ?? null);
      }

      const [{ data: examSessions }, { data: att }, { data: pays }, { data: rels }] = await Promise.all([
        supabase.from('exam_sessions')
          .select('id, total_score, max_score, percentage, passed, status, created_at, exam_id')
          .eq('student_id', userId).order('created_at', { ascending: false }).limit(10),
        // attendance_summary.student_id and fee_payments.student_id reference students.id, not auth user_id
        stu?.id
          ? supabase.from('attendance_summary').select('*').eq('student_id', stu.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        stu?.id
          ? supabase.from('fee_payments').select('*').eq('student_id', stu.id).order('payment_date', { ascending: false }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
        stu?.id
          ? supabase.from('student_parent_relationships').select('*').eq('student_id', stu.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Resolve exam titles
      const examIds = Array.from(new Set((examSessions ?? []).map((e: any) => e.exam_id).filter(Boolean)));
      let titleMap = new Map<string, string>();
      if (examIds.length) {
        const { data: ex } = await supabase.from('exams').select('id, title').in('id', examIds);
        titleMap = new Map((ex ?? []).map((e: any) => [e.id as string, e.title as string]));
      }
      setExams((examSessions ?? []).map((s: any) => ({ ...s, title: titleMap.get(s.exam_id) || 'Exam' })));
      setAttendance(att);
      setPayments(pays ?? []);

      // Resolve parents (via parent.user_id -> profiles)
      const parentIds = Array.from(new Set(((rels ?? []) as any[]).map(r => r.parent_id).filter(Boolean)));
      if (parentIds.length) {
        const { data: parentRows } = await supabase.from('parents').select('*').in('id', parentIds);
        const userIds = (parentRows ?? []).map((p: any) => p.user_id).filter(Boolean);
        const { data: parentProfiles } = userIds.length
          ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [] as any[] };
        const profMap = new Map((parentProfiles ?? []).map((p: any) => [p.user_id as string, p.full_name as string]));
        const pMap = new Map((parentRows ?? []).map((p: any) => [p.id as string, {
          ...p,
          full_name: profMap.get(p.user_id) || 'Parent',
          phone: p.phone_primary,
          email: null,
        }]));
        setParents(((rels ?? []) as any[]).map(r => ({
          ...r,
          relationship: r.relationship_type,
          parent: pMap.get(r.parent_id),
        })));
      } else setParents([]);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Failed to load student', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (!userId) {
    return <div className="p-8 text-center text-muted-foreground">No student selected.</div>;
  }
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Student not found.</div>;
  }

  const addr = student?.address as any;
  const addressLine = addr
    ? [addr.street, addr.city, addr.state].filter(Boolean).join(', ')
    : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/dashboard?tab=academic&subtab=students')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Students
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={student?.photo_url ?? undefined} />
            <AvatarFallback className="text-2xl">{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{profile.full_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {className && <Badge variant="secondary"><GraduationCap className="h-3 w-3 mr-1" />{className}</Badge>}
              <Badge>{student?.status || 'active'}</Badge>
              {student?.admission_number && (
                <Badge variant="outline">Adm: {student.admission_number}</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={resetLoginPassword} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Reset login password
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Student
            </Button>
          </div>

          <Dialog open={!!newPassword} onOpenChange={(o) => !o && setNewPassword(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New login password</DialogTitle>
                <DialogDescription>
                  Share this with {profile.full_name}. It replaces any temporary password sent earlier.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted p-4 text-center font-mono text-lg tracking-wider break-all">
                {newPassword}
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(newPassword ?? '');
                  toast({ title: 'Copied', description: 'Password copied to clipboard.' });
                }}
              >
                Copy password
              </Button>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />Personal</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Gender" value={student?.gender} />
            <Row label="Date of Birth" value={student?.date_of_birth} icon={<Calendar className="h-3 w-3" />} />
            <Row label="Age" value={computeAge(student?.date_of_birth) ?? student?.age} />
            <Row label="Blood Group" value={student?.blood_group} />
            <Row label="Address" value={addressLine} icon={<MapPin className="h-3 w-3" />} />
          </CardContent>
        </Card>

        {/* Academic */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4" />Academic</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Class" value={className} />
            <Row label="Section" value={student?.section} />
            <Row label="Admission Date" value={student?.admission_date} />
            <Row label="Registration #" value={student?.registration_number || student?.admission_number} />
          </CardContent>
        </Card>

        {/* Login & contact */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Login &amp; Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Student Login ID" value={application?.login_email} />
            <Row label="Contact email (parent)" value={application?.email} />
            <Row label="Application #" value={application?.application_number} />
            <p className="text-xs text-muted-foreground pt-2 border-t">
              The login ID is issued by the school and is unique per student. The contact email may be
              shared by siblings  all school mail goes there.
            </p>
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {attendance ? (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Present" value={attendance.days_present ?? 0} />
                <Stat label="Absent" value={attendance.days_absent ?? 0} />
                <Stat label="Opened" value={attendance.days_school_opened ?? 0} />
              </div>
            ) : <p className="text-muted-foreground">No attendance data.</p>}
          </CardContent>
        </Card>

        {/* Parents */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="h-4 w-4" />Parents / Guardians</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {parents.length === 0 ? (
              <p className="text-muted-foreground">No parents linked.</p>
            ) : (
              <ul className="space-y-3">
                {parents.map((r: any) => (
                  <li key={r.id} className="border-b pb-2 last:border-0">
                    <p className="font-medium">{r.parent?.full_name || 'Parent'} <span className="text-xs text-muted-foreground">({r.relationship || 'guardian'})</span></p>
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      {r.parent?.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.parent.phone}</div>}
                      {r.parent?.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.parent.email}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exams */}
      <Card>
        <CardHeader><CardTitle>Recent Exam Results</CardTitle></CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exam attempts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead><TableHead>Score</TableHead>
                  <TableHead>%</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>{e.total_score ?? 0} / {e.max_score ?? 0}</TableCell>
                    <TableCell>{e.percentage != null ? `${Number(e.percentage).toFixed(1)}%` : ''}</TableCell>
                    <TableCell>
                      <Badge variant={e.passed ? 'default' : 'secondary'}>
                        {e.passed ? 'Passed' : e.status || ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />Recent Payments</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead><TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead><TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">₦{Number(p.amount_paid ?? 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === 'success' ? 'default' : 'secondary'}>{p.status || ''}</Badge></TableCell>
                    <TableCell className="text-xs">{p.receipt_number || p.transaction_id || ''}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {userId && (
        <EditStudentDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          userId={userId}
          onSaved={load}
        />
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: any; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground flex items-center gap-1">{icon}{label}</span>
    <span className="font-medium text-right">{value || ''}</span>
  </div>
);
const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="text-center p-2 rounded-md bg-muted/50">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default StudentDetail;