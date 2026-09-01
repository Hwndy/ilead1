import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tags, Loader2 } from 'lucide-react';

interface ExamRow {
  id: string;
  title: string;
  subject_name?: string;
  class_name?: string;
  session_id?: string | null;
  term?: string | null;
  assessment_category?: string | null;
}

interface SessionRow {
  id: string;
  session_name: string;
  academic_year: string;
  is_current: boolean;
}

interface Props {
  trigger?: React.ReactNode;
  onTagged?: () => void;
}

const TERMS = [
  { value: 'first', label: 'First Term' },
  { value: 'second', label: 'Second Term' },
  { value: 'third', label: 'Third Term' },
];

const CATEGORIES = [
  { value: 'test1', label: 'Test 1 (20 marks)' },
  { value: 'test2', label: 'Test 2 (20 marks)' },
  { value: 'exam', label: 'Exam (60 marks)' },
  { value: 'ca', label: 'Continuous Assessment' },
  { value: 'mock', label: 'Mock' },
  { value: 'other', label: 'Other' },
];

export const TagExamsDialog: React.FC<Props> = ({ trigger, onTagged }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showOnlyUntagged, setShowOnlyUntagged] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [term, setTerm] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) load();
  }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const [examsRes, sessionsRes] = await Promise.all([
        
          supabase
            .from('exams')
            .select('id, title, session_id, term, assessment_category, subjects(name), classes(name)')
            .neq('exam_category', 'entrance')
            .order('created_at', { ascending: false })
        ,
        
          supabase
            .from('admission_sessions')
            .select('id, session_name, academic_year, is_current')
            .order('start_date', { ascending: false })
        ,
      ]);

      const list: ExamRow[] = (examsRes.data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        subject_name: e.subjects?.name,
        class_name: e.classes?.name,
        session_id: e.session_id,
        term: e.term,
        assessment_category: e.assessment_category,
      }));
      setExams(list);

      const sList = (sessionsRes.data || []) as SessionRow[];
      setSessions(sList);
      const current = sList.find(s => s.is_current) || sList[0];
      if (current && !sessionId) setSessionId(current.id);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load exams', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const visible = showOnlyUntagged
    ? exams.filter(e => !e.session_id || !e.term || !e.assessment_category)
    : exams;

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map(v => v.id)));
  };

  const apply = async () => {
    if (!sessionId || !term || !category || selected.size === 0) {
      toast({
        title: 'Pick session, term, category and at least one exam',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('exams')
        .update({ session_id: sessionId, term, assessment_category: category })
        .in('id', Array.from(selected));
      if (error) throw error;
      toast({
        title: 'Tagged',
        description: `${selected.size} exam(s) updated. Their results will now appear on report cards.`,
      });
      setSelected(new Set());
      await load();
      onTagged?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Tags className="h-4 w-4 mr-2" /> Tag exams
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tag exams for report cards</DialogTitle>
          <DialogDescription>
            Assign a session, term, and category to existing exams so their scores feed into report cards.
            Test 1 contributes 20%, Test 2 contributes 20%, Exam contributes 60%.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.session_name}{s.is_current ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>
                {TERMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showOnlyUntagged}
              onCheckedChange={(v) => setShowOnlyUntagged(!!v)}
            />
            Show only untagged exams
          </label>
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={visible.length === 0}>
            {selected.size === visible.length && visible.length > 0 ? 'Clear' : 'Select all'}
          </Button>
        </div>

        <ScrollArea className="h-72 border rounded-md">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {showOnlyUntagged ? 'All exams are already tagged.' : 'No exams found.'}
            </div>
          ) : (
            <div className="divide-y">
              {visible.map(e => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 p-3 hover:bg-accent/30 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.subject_name || ''} • {e.class_name || ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {e.term && <Badge variant="secondary" className="text-xs">{e.term}</Badge>}
                    {e.assessment_category && (
                      <Badge variant="secondary" className="text-xs">{e.assessment_category}</Badge>
                    )}
                    {!e.session_id && (
                      <Badge variant="outline" className="text-xs">untagged</Badge>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={apply} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply to {selected.size} exam{selected.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};