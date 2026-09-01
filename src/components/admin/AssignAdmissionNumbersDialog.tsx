import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Hash, Loader2 } from 'lucide-react';

interface Candidate {
  user_id: string;
  full_name: string;
  class_name: string;
  current?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optional: restrict to a single student (used by row action) */
  singleStudent?: Candidate;
  onDone: () => void;
}

export const AssignAdmissionNumbersDialog: React.FC<Props> = ({
  open, onOpenChange, singleStudent, onDone,
}) => {
  const { toast } = useToast();
  const [prefix, setPrefix] = useState('ALB');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pad, setPad] = useState(4);
  const [startFrom, setStartFrom] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (singleStudent) {
      setCandidates([singleStudent]);
      setSelected(new Set([singleStudent.user_id]));
      // Compute next number for single
      void computeNextStart();
      return;
    }
    void loadCandidates();
    // eslint-disable-next-line
  }, [open, singleStudent]);

  const computeNextStart = async () => {
    try {
      const { data } = await 
        supabase.from('students').select('admission_number').not('admission_number', 'is', null)
      ;
      const re = new RegExp(`^${escapeRe(prefix)}/${escapeRe(year)}/(\\d+)$`);
      let max = 0;
      (data ?? []).forEach((r: any) => {
        const m = re.exec(r.admission_number || '');
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      setStartFrom(max + 1);
    } catch { /* ignore */ }
  };

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const { data: cls } = await 
        supabase.from('classes').select('id, name')
      ;
      const classMap = new Map<string, string>(
        (cls ?? []).map((c: any) => [c.id as string, c.name as string])
      );
      const classIds: string[] = Array.from(classMap.keys());
      if (classIds.length === 0) { setCandidates([]); return; }

      const { data: assigns } = await supabase
        .from('class_assignments')
        .select('student_id, class_id')
        .in('class_id', classIds);
      const userIds = Array.from(new Set((assigns ?? []).map((a: any) => a.student_id)));
      if (userIds.length === 0) { setCandidates([]); return; }

      const [{ data: profiles }, { data: students }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('students')
          .select('user_id, admission_number').in('user_id', userIds),
      ]);
      const pMap = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.user_id as string, p.full_name as string])
      );
      const sMap = new Map<string, string | null>(
        (students ?? []).map((s: any) => [s.user_id as string, s.admission_number ?? null])
      );

      const list: Candidate[] = ((assigns ?? []) as any[])
        .map((a: any) => ({
          user_id: a.student_id,
          full_name: pMap.get(a.student_id) || 'Unknown',
          class_name: (classMap.get(a.class_id) as string) || '',
          current: sMap.get(a.student_id) ?? null,
        }))
        .filter(c => !c.current)
        .sort((a, b) => a.class_name.localeCompare(b.class_name) || a.full_name.localeCompare(b.full_name));

      setCandidates(list);
      setSelected(new Set(list.map(c => c.user_id)));
      await computeNextStart();
    } catch (e: any) {
      toast({ title: 'Failed to load students', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map(c => c.user_id)));
  };

  const format = (n: number) =>
    `${prefix}/${year}/${String(n).padStart(pad, '0')}`;

  const sample = useMemo(() => format(startFrom), [prefix, year, pad, startFrom]);

  const apply = async () => {
    if (selected.size === 0) {
      toast({ title: 'Select at least one student', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const ordered = candidates.filter(c => selected.has(c.user_id));
      let n = startFrom;
      let success = 0;
      for (const c of ordered) {
        const adm = format(n);
        const { error } = await supabase
          .from('students')
          .update({ admission_number: adm })
          .eq('user_id', c.user_id);
        if (!error) { success++; n++; }
        else console.error('Assign error', c.user_id, error);
      }
      toast({
        title: 'Admission numbers assigned',
        description: `${success} of ${ids.length} updated`,
      });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" /> Assign Admission Numbers
          </DialogTitle>
          <DialogDescription>
            Generate sequential admission numbers for students who don't have one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Prefix</Label>
            <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Year</Label>
            <Input value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div>
            <Label>Pad</Label>
            <Input type="number" min={3} max={6} value={pad}
              onChange={e => setPad(parseInt(e.target.value) || 4)} />
          </div>
          <div>
            <Label>Start From</Label>
            <Input type="number" min={1} value={startFrom}
              onChange={e => setStartFrom(parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Example: <span className="font-mono font-semibold">{sample}</span>
        </p>

        {!singleStudent && (
          <div className="border rounded-md">
            <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
              <Checkbox checked={selected.size === candidates.length && candidates.length > 0}
                onCheckedChange={toggleAll} />
              <span className="text-sm font-medium">
                {selected.size} / {candidates.length} selected
              </span>
            </div>
            <ScrollArea className="h-64">
              {loading ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  All students already have admission numbers.
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map(c => (
                    <li key={c.user_id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggle(c.user_id)}>
                      <Checkbox checked={selected.has(c.user_id)} />
                      <span className="flex-1 text-sm">{c.full_name}</span>
                      <span className="text-xs text-muted-foreground">{c.class_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={saving || selected.size === 0}>
            {saving ? 'Assigning…' : `Assign ${selected.size} number${selected.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export default AssignAdmissionNumbersDialog;