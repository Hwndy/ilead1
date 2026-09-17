import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Plus, Loader2, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;

type Campus = { id: string; name: string; code: string | null; address: string | null; phone: string | null; is_active: boolean };
type Arm = { id: string; campus_id: string; class_id: string; name: string; capacity: number | null; is_active: boolean };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; full_name: string | null; admission_number: string | null; class_id: string | null; campus_id: string | null; arm_id: string | null };

const SETUP_HINT = 'The school structure tables are not in the database yet. Run db/phase3-structure.sql in your database SQL editor.';

export const SchoolStructure: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [campusOpen, setCampusOpen] = useState(false);
  const [campusForm, setCampusForm] = useState({ name: '', code: '', address: '', phone: '' });
  const [armOpen, setArmOpen] = useState(false);
  const [armForm, setArmForm] = useState({ campus_id: '', class_id: '', name: '', capacity: '' });
  const [saving, setSaving] = useState(false);

  const [filterCampus, setFilterCampus] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: campusData, error: campusError }, { data: armData }, { data: classData }, { data: studentData }] = await Promise.all([
        db.from('campuses').select('*').order('name'),
        db.from('class_arms').select('*').order('name'),
        db.from('classes').select('id, name').order('name'),
        db.from('students').select('id, full_name, admission_number, class_id, campus_id, arm_id').is('archived_at', null).order('full_name'),
      ]);
      if (campusError) { setSetupNeeded(true); setLoading(false); return; }
      setSetupNeeded(false);
      setCampuses(campusData || []);
      setArms(armData || []);
      setClasses(classData || []);
      setStudents(studentData || []);
    } catch {
      setSetupNeeded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const className = (id: string | null) => classes.find(c => c.id === id)?.name || '—';
  const campusName = (id: string | null) => campuses.find(c => c.id === id)?.name || '—';
  const armLabel = (id: string | null) => {
    const arm = arms.find(a => a.id === id);
    return arm ? `${className(arm.class_id)} ${arm.name}` : '—';
  };

  const saveCampus = async () => {
    if (!campusForm.name.trim()) return;
    setSaving(true);
    const { error } = await db.from('campuses').insert({
      name: campusForm.name.trim(),
      code: campusForm.code.trim() || null,
      address: campusForm.address.trim() || null,
      phone: campusForm.phone.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save campus', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Campus added' });
    setCampusOpen(false);
    setCampusForm({ name: '', code: '', address: '', phone: '' });
    load();
  };

  const saveArm = async () => {
    if (!armForm.campus_id || !armForm.class_id || !armForm.name.trim()) {
      toast({ title: 'Choose a campus, a class and an arm name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await db.from('class_arms').insert({
      campus_id: armForm.campus_id,
      class_id: armForm.class_id,
      name: armForm.name.trim().toUpperCase(),
      capacity: armForm.capacity ? Number(armForm.capacity) : null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save arm', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Arm added' });
    setArmOpen(false);
    setArmForm({ campus_id: '', class_id: '', name: '', capacity: '' });
    load();
  };

  const toggleArm = async (arm: Arm) => {
    const { error } = await db.from('class_arms').update({ is_active: !arm.is_active }).eq('id', arm.id);
    if (error) { toast({ title: 'Could not update arm', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const placeStudent = async (student: StudentRow, field: 'campus_id' | 'arm_id', value: string) => {
    const next: Record<string, string | null> = { [field]: value === 'none' ? null : value };
    if (field === 'arm_id' && value !== 'none') {
      const arm = arms.find(a => a.id === value);
      if (arm) { next.campus_id = arm.campus_id; next.class_id = arm.class_id; }
    }
    const { error } = await db.from('students').update(next).eq('id', student.id);
    if (error) { toast({ title: 'Could not move student', description: error.message, variant: 'destructive' }); return; }
    setStudents(prev => prev.map(s => (s.id === student.id ? { ...s, ...next } as StudentRow : s)));
    toast({ title: 'Student placement updated' });
  };

  const visibleStudents = useMemo(() => students.filter(s => {
    if (filterCampus !== 'all' && s.campus_id !== (filterCampus === 'none' ? null : filterCampus)) return false;
    if (filterClass !== 'all' && s.class_id !== filterClass) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (s.full_name || '').toLowerCase().includes(q) || (s.admission_number || '').toLowerCase().includes(q);
    }
    return true;
  }), [students, filterCampus, filterClass, search]);

  const armCounts = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(s => { if (s.arm_id) map[s.arm_id] = (map[s.arm_id] || 0) + 1; });
    return map;
  }, [students]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (setupNeeded) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{SETUP_HINT}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" /> School structure</h2>
          <p className="text-sm text-muted-foreground">Campuses, class arms and where each student sits.</p>
        </div>
      </div>

      <Tabs defaultValue="campuses">
        <TabsList>
          <TabsTrigger value="campuses">Campuses</TabsTrigger>
          <TabsTrigger value="arms">Class arms</TabsTrigger>
          <TabsTrigger value="placement">Student placement</TabsTrigger>
        </TabsList>

        <TabsContent value="campuses" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCampusOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add campus</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {campuses.map(c => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{c.name}</span>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Closed'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {c.address && <p>{c.address}</p>}
                  {c.phone && <p>{c.phone}</p>}
                  <p className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {students.filter(s => s.campus_id === c.id).length} students · {arms.filter(a => a.campus_id === c.id).length} arms</p>
                </CardContent>
              </Card>
            ))}
            {campuses.length === 0 && <p className="text-sm text-muted-foreground">No campuses yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="arms" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setArmOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add arm</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {arms.map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{className(a.class_id)} {a.name}</span>
                    <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{campusName(a.campus_id)}</p>
                  <p className="text-sm text-muted-foreground">
                    {armCounts[a.id] || 0} students{a.capacity ? ` of ${a.capacity}` : ''}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => toggleArm(a)}>
                    {a.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {arms.length === 0 && <p className="text-sm text-muted-foreground">No arms yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="placement" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name or admission number" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={filterCampus} onValueChange={setFilterCampus}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Campus" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campuses</SelectItem>
                <SelectItem value="none">Not placed</SelectItem>
                {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {visibleStudents.slice(0, 200).map(s => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium">{s.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{s.admission_number || 'No admission number'} · {className(s.class_id)}</p>
                  </div>
                  <Select value={s.campus_id || 'none'} onValueChange={v => placeStudent(s, 'campus_id', v)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Campus" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No campus</SelectItem>
                      {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={s.arm_id || 'none'} onValueChange={v => placeStudent(s, 'arm_id', v)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Arm" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No arm</SelectItem>
                      {arms
                        .filter(a => a.is_active && (!s.campus_id || a.campus_id === s.campus_id) && (!s.class_id || a.class_id === s.class_id))
                        .map(a => <SelectItem key={a.id} value={a.id}>{className(a.class_id)} {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground w-40">{armLabel(s.arm_id)}</span>
                </div>
              ))}
              {visibleStudents.length === 0 && <p className="p-6 text-sm text-muted-foreground">No students match these filters.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={campusOpen} onOpenChange={setCampusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add campus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={campusForm.name} onChange={e => setCampusForm({ ...campusForm, name: e.target.value })} /></div>
            <div><Label>Short code</Label><Input value={campusForm.code} onChange={e => setCampusForm({ ...campusForm, code: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={campusForm.address} onChange={e => setCampusForm({ ...campusForm, address: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={campusForm.phone} onChange={e => setCampusForm({ ...campusForm, phone: e.target.value })} /></div>
            <Button onClick={saveCampus} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save campus'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={armOpen} onOpenChange={setArmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add class arm</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campus</Label>
              <Select value={armForm.campus_id} onValueChange={v => setArmForm({ ...armForm, campus_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose campus" /></SelectTrigger>
                <SelectContent>{campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={armForm.class_id} onValueChange={v => setArmForm({ ...armForm, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Arm name (A, B, Gold…)</Label><Input value={armForm.name} onChange={e => setArmForm({ ...armForm, name: e.target.value })} /></div>
            <div><Label>Capacity (optional)</Label><Input type="number" value={armForm.capacity} onChange={e => setArmForm({ ...armForm, capacity: e.target.value })} /></div>
            <Button onClick={saveArm} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save arm'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolStructure;
