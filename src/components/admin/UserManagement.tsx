import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Search, Download } from 'lucide-react';
import { User, Profile, Class, Subject } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserEditModal } from './UserEditModal';
import { fetchPlacementMap } from '@/lib/student-placement';
import { logAuditEvent } from '@/lib/audit';
import { invokeFunction } from '@/lib/functions';

export const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; admission_number: string | null; full_name: string }>>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Add User Form State
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'student' as 'admin' | 'teacher' | 'student' | 'parent',
    classId: '',
    classIds: [] as string[],
    subjectIds: [] as string[],
    phone: '',
    studentId: '',
    relationshipType: 'parent',
    canViewGrades: true,
    canViewAttendance: true,
    canViewFees: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch user roles for the filtered profiles
      const profileUserIds = profilesData?.map(p => p.user_id) || [];
      const { data: rolesData } = profileUserIds.length > 0
        ? await supabase.from('user_roles').select('user_id, role').in('user_id', profileUserIds)
        : await Promise.resolve({ data: [] });

      // Combine profiles with roles
      const profilesWithRoles = profilesData?.map(profile => {
        const roleEntry = rolesData?.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: roleEntry?.role || 'student'
        };
      }) || [];

      // Fetch classes and subjects filtered by school using withSchoolFilter
      const { data: classesData } = await 
        supabase.from('classes').select('*').order('name')
      ;

      const { data: subjectsData } = await 
        supabase.from('subjects').select('*').order('name')
      ;

      const { data: studentRows } = await supabase.from('students').select('id,user_id,admission_number').order('admission_number');
      const studentUserIds = (studentRows || []).map((student) => student.user_id).filter(Boolean);
      const { data: studentProfiles } = studentUserIds.length
        ? await supabase.from('profiles').select('user_id,full_name').in('user_id', studentUserIds)
        : { data: [] as Array<{ user_id: string; full_name: string }> };

      setProfiles(profilesWithRoles);
      if (classesData) setClasses(classesData);
      if (subjectsData) setSubjects(subjectsData);
      setStudents((studentRows || []).map((student) => ({
        id: student.id,
        admission_number: student.admission_number,
        full_name: studentProfiles?.find((profile) => profile.user_id === student.user_id)?.full_name || student.admission_number || 'Student',
      })));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate role-specific requirements
    if (userForm.role === 'student' && !userForm.classId) {
      toast({
        title: 'Error',
        description: 'Please select a class for the student',
        variant: 'destructive',
      });
      return;
    }

    if (userForm.role === 'teacher' && userForm.subjectIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one subject for the teacher',
        variant: 'destructive',
      });
      return;
    }

    if (userForm.role === 'teacher' && userForm.classIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one class for the teacher',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      if (userForm.role === 'parent') {
        if (!/^[+\d][\d\s()-]{6,19}$/.test(userForm.phone.trim())) {
          throw new Error('Enter a valid parent phone number');
        }
        const { data } = await invokeFunction<any>('create-parent-account', {
          fullName: userForm.fullName.trim(),
          email: userForm.email.trim().toLowerCase(),
          phone: userForm.phone.trim(),
          studentId: userForm.studentId || undefined,
          relationshipType: userForm.relationshipType,
          canViewGrades: userForm.canViewGrades,
          canViewAttendance: userForm.canViewAttendance,
          canViewFees: userForm.canViewFees,
        });
        if (!data?.success) throw new Error('Failed to create parent');
        await fetchData();
        setIsAddingUser(false);
        resetUserForm();
        toast({
          title: 'Parent invited',
          description: `${userForm.fullName} can set a password from the invitation email.${data.childLinked ? ' The child is linked.' : ''}`,
        });
        return;
      }

      // Accounts are always created on the server so the role is granted
      // server-side (a browser sign-up is forced to "student" by the database
      // and would also replace the administrator's own session).
      let newUserId: string | null = null;

      if (userForm.role === 'student') {
        const { data } = await invokeFunction<any>('create-student', {
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          fullName: userForm.fullName.trim(),
          classId: userForm.classId || undefined,
        });
        newUserId = data?.user?.id ?? data?.user_id ?? null;
      } else {
        const { data } = await invokeFunction<any>('create-staff-user', {
          fullName: userForm.fullName.trim(),
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          role: userForm.role,
          phone: userForm.phone.trim() || undefined,
        });
        newUserId = data?.user_id ?? null;
      }

      if (userForm.role === 'teacher' && newUserId) {
        // Create subject assignments for EACH combination of subject and class
        if (userForm.subjectIds.length > 0 && userForm.classIds.length > 0) {
          const subjectAssignments = [];
          for (const classId of userForm.classIds) {
            for (const subjectId of userForm.subjectIds) {
              subjectAssignments.push({
                user_id: newUserId,
                subject_id: subjectId,
                class_id: classId,
              });
            }
          }
          await supabase.from('subject_assignments').insert(subjectAssignments);
        }

        if (userForm.classIds.length > 0) {
          const { error: classAssignError } = await supabase
            .rpc('create_teacher_class_assignments', {
              p_teacher_id: newUserId,
              p_class_ids: userForm.classIds,
            });
          if (classAssignError) throw classAssignError;
        }
      }

      await logAuditEvent('user_created', {
        tableName: 'user_roles',
        rowId: newUserId,
        metadata: { email: userForm.email.trim().toLowerCase(), role: userForm.role, full_name: userForm.fullName.trim() },
      });

      // If successful, refresh the profiles list
      await fetchData();

      const createdRole = userForm.role;
      const createdName = userForm.fullName;
      setIsAddingUser(false);
      resetUserForm();

      toast({
        title: 'Account created',
        description: `${createdName} was added as ${createdRole === 'admin' ? 'an administrator' : `a ${createdRole}`} and can sign in now.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.fullName,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      await fetchData();
      setEditingUser(null);
      resetUserForm();
      
      toast({
        title: 'User Updated',
        description: 'User information has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;

    try {
      // Use the delete_user_profile function
      const { data, error } = await supabase.rpc('delete_user_profile', {
        user_id_param: userId
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(data.error as string);
      }

      await fetchData();
      
      toast({
        title: 'User Deleted',
        description: `${userName} has been deleted successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const resetUserForm = () => {
    setUserForm({
      fullName: '',
      email: '',
      password: '',
      role: 'student',
      classId: '',
      classIds: [],
      subjectIds: [],
      phone: '',
      studentId: '',
      relationshipType: 'parent',
      canViewGrades: true,
      canViewAttendance: true,
      canViewFees: true,
    });
  };

  const startEditing = (profile: Profile) => {
    setEditingUser(profile);
    setUserForm({
      fullName: profile.full_name,
      email: '',
      password: '',
      role: profile.role as 'admin' | 'teacher' | 'student' | 'parent',
      classId: '',
      classIds: [],
      subjectIds: [],
      phone: '',
      studentId: '',
      relationshipType: 'parent',
      canViewGrades: true,
      canViewAttendance: true,
      canViewFees: true,
    });
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || profile.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleStats = () => {
    return {
      total: profiles.length,
      students: profiles.filter(p => p.role === 'student').length,
      teachers: profiles.filter(p => p.role === 'teacher').length,
      admins: profiles.filter(p => p.role === 'admin').length,
      parents: profiles.filter(p => p.role === 'parent').length,
    };
  };

  const stats = getRoleStats();

  // Export every user to CSV. Uses the server export (it can read emails);
  // falls back to a paginated in-app export when that is unavailable.
  const exportToCSV = async () => {
    const PAGE = 1000;

    const fetchLocally = async () => {
      const profiles: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, created_at')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        profiles.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      const roleMap = new Map<string, string>();
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const r of (data as any[]) || []) if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
        if (!data || data.length < PAGE) break;
      }

      return profiles.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: '',
        role: roleMap.get(p.user_id) || 'student',
        school: 'iVintage College',
        class_name: '',
        created_at: p.created_at,
      }));
    };

    // Campus, arm and class for each pupil, keyed by their sign-in id.
    const placementByUser = async () => {
      const byUser = new Map<string, { campus: string; arm: string; className: string }>();
      try {
        const [{ data: students }, placements] = await Promise.all([
          supabase.from('students').select('id, user_id').is('archived_at', null),
          fetchPlacementMap(),
        ]);
        ((students || []) as any[]).forEach((s) => {
          if (!s.user_id) return;
          const pl = placements.get(s.id);
          byUser.set(s.user_id, {
            campus: pl?.campus_name || '',
            arm: pl?.arm_name || '',
            className: pl?.class_name || '',
          });
        });
      } catch { /* structure not available */ }
      return byUser;
    };

    try {
      setExporting(true);

      let users: any[] = [];
      let partial = false;
      try {
        const { data, error } = await supabase.functions.invoke('export-users');
        if (error) throw error;
        users = data?.users || [];
      } catch {
        users = await fetchLocally();
        partial = true;
      }

      const places = await placementByUser();

      const headers = ['Full Name', 'Email', 'Role', 'School', 'Campus', 'Class', 'Arm', 'Created Date'];
      const rows = users.map((user: any) => {
        const pl = places.get(user.user_id) || { campus: '', arm: '', className: '' };
        return [
          user.full_name,
          user.email,
          user.role,
          user.school,
          user.campus_name || pl.campus,
          pl.className || user.class_name,
          user.arm_name || pl.arm,
          new Date(user.created_at).toLocaleDateString(),
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: string[]) => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: partial
          ? `Exported ${rows.length} people. Email addresses are left blank until the server tools are switched on.`
          : `Exported ${rows.length} people to CSV`,
      });
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export users',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.parents}</div>
            <div className="text-sm text-muted-foreground">Parents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.students}</div>
            <div className="text-sm text-muted-foreground">Students</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.teachers}</div>
            <div className="text-sm text-muted-foreground">Teachers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.admins}</div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="parent">Parents</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          
          <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>
              {userForm.role !== 'parent' && <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required
                />
              </div>}
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value: 'admin' | 'teacher' | 'student' | 'parent') =>
                    setUserForm({ ...userForm, role: value, classId: '', classIds: [], subjectIds: [], studentId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="parent">Parent / Guardian</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userForm.role === 'student' && (
                <div className="space-y-2">
                  <Label htmlFor="class">Class</Label>
                  <Select 
                    value={userForm.classId} 
                    onValueChange={(value) => setUserForm({ ...userForm, classId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {classes.length > 0 ? (
                        classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-classes" disabled>No classes available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {userForm.role === 'parent' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="parent-phone">Phone number</Label>
                    <Input id="parent-phone" type="tel" maxLength={20} required value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Link a child (optional)</Label>
                    <Select value={userForm.studentId || 'none'} onValueChange={(value) => setUserForm({ ...userForm, studentId: value === 'none' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="none">Link later</SelectItem>
                        {students.map((student) => <SelectItem key={student.id} value={student.id}>{student.full_name} · {student.admission_number || 'No admission number'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {userForm.studentId && <>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Select value={userForm.relationshipType} onValueChange={(value) => setUserForm({ ...userForm, relationshipType: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">Parent</SelectItem><SelectItem value="mother">Mother</SelectItem><SelectItem value="father">Father</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {([['canViewGrades', 'Results and report cards'], ['canViewAttendance', 'Attendance'], ['canViewFees', 'Fees and payments']] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox id={key} checked={userForm[key]} onCheckedChange={(checked) => setUserForm({ ...userForm, [key]: checked === true })} />
                        <Label htmlFor={key}>{label}</Label>
                      </div>
                    ))}
                  </>}
                  <p className="text-sm text-muted-foreground">An invitation email will let the parent set a private password.</p>
                </div>
              )}

              {userForm.role === 'teacher' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="classes">Classes</Label>
                    <div className="border border-input rounded-md p-3 max-h-40 overflow-y-auto bg-background">
                      {classes.length > 0 ? (
                        classes.map((cls) => (
                          <div key={cls.id} className="flex items-center space-x-2 py-1">
                            <input
                              type="checkbox"
                              id={`add-class-${cls.id}`}
                              checked={userForm.classIds.includes(cls.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserForm({ 
                                    ...userForm, 
                                    classIds: [...userForm.classIds, cls.id] 
                                  });
                                } else {
                                  setUserForm({ 
                                    ...userForm, 
                                    classIds: userForm.classIds.filter(id => id !== cls.id) 
                                  });
                                }
                              }}
                              className="rounded border-input"
                            />
                            <label htmlFor={`add-class-${cls.id}`} className="text-sm text-foreground cursor-pointer">{cls.name}</label>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground py-2">No classes available</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subjects">Subjects *</Label>
                    <div className="border border-input rounded-md p-3 max-h-40 overflow-y-auto bg-background">
                      {subjects.length > 0 ? (
                        subjects.map((subject) => (
                          <div key={subject.id} className="flex items-center space-x-2 py-1">
                            <input
                              type="checkbox"
                              id={`add-subject-${subject.id}`}
                              checked={userForm.subjectIds.includes(subject.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserForm({ 
                                    ...userForm, 
                                    subjectIds: [...userForm.subjectIds, subject.id] 
                                  });
                                } else {
                                  setUserForm({ 
                                    ...userForm, 
                                    subjectIds: userForm.subjectIds.filter(id => id !== subject.id) 
                                  });
                                }
                              }}
                              className="rounded border-input"
                            />
                            <label htmlFor={`add-subject-${subject.id}`} className="text-sm text-foreground cursor-pointer">{subject.name}</label>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground py-2">No subjects available</div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div className="flex space-x-2">
                <Button type="submit">Add User</Button>
                <Button type="button" variant="outline" onClick={() => setIsAddingUser(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredProfiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">{profile.full_name}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        profile.role === 'admin'
                          ? 'destructive'
                          : profile.role === 'teacher'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {profile.role}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Created: {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(profile)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(profile.user_id, profile.full_name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <UserEditModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onUserUpdated={fetchData}
      />
    </div>
  );
};