import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MoreVertical, UserPlus, Download, Search, Eye, Camera,
  IdCard, Pencil, Trash2, Printer, GraduationCap, Hash, FileText,
} from 'lucide-react';
import { UserEditModal } from './UserEditModal';
import { StudentIDCard } from './StudentIDCard';
import { AssignAdmissionNumbersDialog } from './AssignAdmissionNumbersDialog';
import html2canvas from 'html2canvas';
import { printNode } from '@/lib/print-node';
import { fetchSchoolBranding as loadSchoolBranding } from '@/lib/school-branding';

interface ClassRow { id: string; name: string; description?: string | null; }
interface StudentRow {
  user_id: string;
  class_id: string;
  student_id: string | null;
  full_name: string;
  admission_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  status: string | null;
  photo_url: string | null;
  email?: string | null;
}

const initials = (n?: string) =>
  (n || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export const StudentsByClass: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, StudentRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openClass, setOpenClass] = useState<string | undefined>();
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; address?: string; logo_url?: string | null }>({ name: 'School' });

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addClassId, setAddClassId] = useState<string>('');
  const [addForm, setAddForm] = useState({ fullName: '', email: '', password: '', admissionNumber: '' });
  const [creating, setCreating] = useState(false);

  const [viewStudent, setViewStudent] = useState<StudentRow | null>(null);
  const [photoStudent, setPhotoStudent] = useState<StudentRow | null>(null);
  const [idCardStudent, setIdCardStudent] = useState<StudentRow | null>(null);
  const [editProfile, setEditProfile] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [singleAssign, setSingleAssign] = useState<StudentRow | null>(null);

  useEffect(() => {
    void fetchAll();
    void fetchSchoolBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchSchoolBranding = async () => {
    try {
      const b = await loadSchoolBranding();
      setSchoolInfo({ name: b.name, address: b.address, logo_url: b.logo_url });
    } catch { /* ignore */ }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: cls, error: clsErr } = await 
        supabase.from('classes').select('id, name, description').order('name')
      ;
      if (clsErr) throw clsErr;
      const classRows = (cls ?? []) as ClassRow[];
      setClasses(classRows);

      if (classRows.length === 0) { setStudentsByClass({}); return; }
      const classIds = classRows.map(c => c.id);

      // class assignments (student_id == auth user_id)
      const { data: assigns, error: aErr } = await supabase
        .from('class_assignments')
        .select('student_id, class_id')
        .in('class_id', classIds);
      if (aErr) throw aErr;

      const userIds = Array.from(new Set((assigns ?? []).map(a => a.student_id)));
      if (userIds.length === 0) {
        setStudentsByClass(Object.fromEntries(classIds.map(id => [id, []])));
        return;
      }

      const [{ data: profiles }, { data: students }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('students')
          .select('user_id, id, admission_number, gender, date_of_birth, status, photo_url')
          .in('user_id', userIds),
      ]);

      const pMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
      const sMap = new Map((students ?? []).map(s => [s.user_id, s]));

      const grouped: Record<string, StudentRow[]> = Object.fromEntries(classIds.map(id => [id, []]));
      (assigns ?? []).forEach(a => {
        const p = pMap.get(a.student_id);
        const s = sMap.get(a.student_id);
        grouped[a.class_id].push({
          user_id: a.student_id,
          class_id: a.class_id,
          student_id: s?.id ?? null,
          full_name: p?.full_name ?? 'Unknown',
          admission_number: s?.admission_number ?? null,
          gender: s?.gender ?? null,
          date_of_birth: s?.date_of_birth ?? null,
          status: s?.status ?? 'active',
          photo_url: s?.photo_url ?? null,
        });
      });
      Object.values(grouped).forEach(arr => arr.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setStudentsByClass(grouped);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load students', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const filteredStudents = (classId: string): StudentRow[] => {
    const arr = studentsByClass[classId] ?? [];
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      (s.admission_number ?? '').toLowerCase().includes(q)
    );
  };

  const totalStudents = useMemo(
    () => Object.values(studentsByClass).reduce((n, a) => n + a.length, 0),
    [studentsByClass]
  );

  /* -------- Add Student -------- */
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.fullName || !addForm.email || !addForm.password || !addClassId) {
      toast({ title: 'Missing info', description: 'Fill all fields and pick a class', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke('create-student', {
        body: {
          fullName: addForm.fullName,
          email: addForm.email,
          password: addForm.password,
          classId: addClassId,
          admissionNumber: addForm.admissionNumber || undefined,
        },
      });
      if (error) throw error;
      toast({ title: 'Student created', description: addForm.fullName });
      setAddOpen(false);
      setAddForm({ fullName: '', email: '', password: '', admissionNumber: '' });
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message || 'Try again', variant: 'destructive' });
    } finally { setCreating(false); }
  };

  /* -------- Export CSV -------- */
  const exportClass = (cls: ClassRow) => {
    const rows = filteredStudents(cls.id);
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No students in this class' });
      return;
    }
    const header = ['S/N', 'Admission #', 'Full Name', 'Class', 'Gender', 'Date of Birth', 'Status'];
    const csv = [header, ...rows.map((r, i) => [
      String(i + 1),
      r.admission_number ?? '',
      r.full_name,
      cls.name,
      r.gender ?? '',
      r.date_of_birth ?? '',
      r.status ?? '',
    ])].map(line => line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cls.name.replace(/\s+/g, '-')}-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* -------- Update Photo -------- */
  const handlePhotoUpload = async (file: File) => {
    if (!photoStudent) return;
    setBusy(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `students/${photoStudent.user_id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('admission-documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('admission-documents').getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase.from('students')
        .update({ photo_url: url }).eq('user_id', photoStudent.user_id);
      if (updErr) throw updErr;
      toast({ title: 'Photo updated' });
      setPhotoStudent(null);
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  /* -------- Delete -------- */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('delete-student', {
        body: { studentUserId: deleteTarget.user_id },
      });
      if (error) throw error;
      toast({ title: 'Student deleted' });
      setDeleteTarget(null);
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  /* -------- Edit Profile -------- */
  const openEdit = async (s: StudentRow) => {
    const { data } = await supabase.from('profiles')
      .select('id, user_id, full_name, created_at, updated_at')
      .eq('user_id', s.user_id).maybeSingle();
    if (data) setEditProfile({ ...data, role: 'student' });
    else toast({ title: 'Could not load profile', variant: 'destructive' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">
            {classes.length} classes · {totalStudents} students
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkAssignOpen(true)}>
            <Hash className="h-4 w-4 mr-2" /> Generate Admission #
          </Button>
          <Button onClick={() => { setAddClassId(openClass || classes[0]?.id || ''); setAddOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or admission #"
          className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : classes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No classes yet. Create classes first under Academic › Classes.
        </CardContent></Card>
      ) : (
        <Accordion type="single" collapsible value={openClass} onValueChange={setOpenClass}>
          {classes.map(cls => {
            const rows = filteredStudents(cls.id);
            return (
              <AccordionItem key={cls.id} value={cls.id} className="border rounded-lg mb-2 px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-3">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{cls.name}</span>
                    </div>
                    <Badge variant="secondary">{rows.length} students</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex justify-end gap-2 mb-2">
                    <Button size="sm" variant="outline" onClick={() => exportClass(cls)}>
                      <Download className="h-4 w-4 mr-1" /> Export CSV
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => { setAddClassId(cls.id); setAddOpen(true); }}>
                      <UserPlus className="h-4 w-4 mr-1" /> Add to {cls.name}
                    </Button>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">No students in this class.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Photo</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Admission #</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(s => (
                          <TableRow key={s.user_id}>
                            <TableCell>
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={s.photo_url ?? undefined} />
                                <AvatarFallback>{initials(s.full_name)}</AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">
                              <button
                                className="hover:underline text-left"
                                onClick={() => navigate(`/dashboard?tab=academic&subtab=student-detail&id=${s.user_id}`)}>
                                {s.full_name}
                              </button>
                            </TableCell>
                            <TableCell>{s.admission_number || ''}</TableCell>
                            <TableCell className="capitalize">{s.gender || ''}</TableCell>
                            <TableCell>
                              <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
                                {s.status || 'active'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-popover">
                                  <DropdownMenuItem onClick={() => navigate(`/dashboard?tab=academic&subtab=student-detail&id=${s.user_id}`)}>
                                    <FileText className="h-4 w-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setViewStudent(s)}>
                                    <Eye className="h-4 w-4 mr-2" /> View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setPhotoStudent(s)}>
                                    <Camera className="h-4 w-4 mr-2" /> Update Photo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setSingleAssign(s)}>
                                    <Hash className="h-4 w-4 mr-2" /> Assign Admission #
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setIdCardStudent(s)}>
                                    <IdCard className="h-4 w-4 mr-2" /> View ID Card
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(s)}>
                                    <Pencil className="h-4 w-4 mr-2" /> Edit Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(s)}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Student
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Add Student */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
          <form onSubmit={handleAddStudent} className="space-y-3">
            <div><Label>Full Name</Label>
              <Input value={addForm.fullName} required
                onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} /></div>
            <div><Label>Email</Label>
              <Input type="email" value={addForm.email} required
                onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
            <div><Label>Password</Label>
              <Input type="text" value={addForm.password} required minLength={6}
                onChange={e => setAddForm({ ...addForm, password: e.target.value })} /></div>
            <div><Label>Admission # <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input value={addForm.admissionNumber}
                placeholder="Leave blank to assign later"
                onChange={e => setAddForm({ ...addForm, admissionNumber: e.target.value })} /></div>
            <div><Label>Class</Label>
              <Select value={addClassId} onValueChange={setAddClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create Student'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Profile */}
      <Dialog open={!!viewStudent} onOpenChange={o => !o && setViewStudent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Student Profile</DialogTitle></DialogHeader>
          {viewStudent && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={viewStudent.photo_url ?? undefined} />
                  <AvatarFallback>{initials(viewStudent.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{viewStudent.full_name}</p>
                  <p className="text-sm text-muted-foreground">{viewStudent.admission_number || 'No admission #'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Gender: </span>{viewStudent.gender || ''}</div>
                <div><span className="text-muted-foreground">DOB: </span>{viewStudent.date_of_birth || ''}</div>
                <div><span className="text-muted-foreground">Status: </span>{viewStudent.status || ''}</div>
                <div><span className="text-muted-foreground">Class: </span>
                  {classes.find(c => c.id === viewStudent.class_id)?.name || ''}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Photo */}
      <Dialog open={!!photoStudent} onOpenChange={o => !o && setPhotoStudent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Photo</DialogTitle>
            <DialogDescription>{photoStudent?.full_name}</DialogDescription></DialogHeader>
          <Input type="file" accept="image/*" disabled={busy}
            onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
        </DialogContent>
      </Dialog>

      {/* View ID Card */}
      <Dialog open={!!idCardStudent} onOpenChange={o => !o && setIdCardStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Student ID Card</DialogTitle></DialogHeader>
          {idCardStudent && (
            <div className="space-y-4">
              <div className="print-area">
                <StudentIDCard
                  student={{
                    user_id: idCardStudent.user_id,
                    full_name: idCardStudent.full_name,
                    admission_number: idCardStudent.admission_number,
                    photo_url: idCardStudent.photo_url,
                    class_name: classes.find(c => c.id === idCardStudent.class_id)?.name,
                  }}
                  school={schoolInfo}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const node = document.getElementById('student-id-card');
                    if (!node) return;
                    try {
                      const canvas = await html2canvas(node, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
                      const link = document.createElement('a');
                      link.download = `ID_${(idCardStudent.full_name || 'student').replace(/\s+/g, '_')}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    } catch (err: any) {
                      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
                    }
                  }}>
                  <Download className="h-4 w-4 mr-2" /> Download PNG
                </Button>
                <Button
                  onClick={() =>
                    printNode(document.getElementById('student-id-card'), {
                      title: `ID Card  ${idCardStudent.full_name}`,
                      pageSize: '95.3mm 160mm',
                      pageMargin: '0',
                    })
                  }
                >
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile */}
      <UserEditModal
        isOpen={!!editProfile}
        onClose={() => setEditProfile(null)}
        user={editProfile}
        onUserUpdated={() => { setEditProfile(null); fetchAll(); }}
      />

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the student account, class assignment, and profile.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk admission numbers */}
      <AssignAdmissionNumbersDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        onDone={fetchAll}
      />

      {/* Single admission number */}
      <AssignAdmissionNumbersDialog
        open={!!singleAssign}
        onOpenChange={(o) => !o && setSingleAssign(null)}
        singleStudent={singleAssign ? {
          user_id: singleAssign.user_id,
          full_name: singleAssign.full_name,
          class_name: classes.find(c => c.id === singleAssign.class_id)?.name || '',
          current: singleAssign.admission_number,
        } : undefined}
        onDone={fetchAll}
      />
    </div>
  );
};

export default StudentsByClass;