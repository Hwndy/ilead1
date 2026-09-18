import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Trash2, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_published: boolean;
  target_audience: string[];
  publish_date: string | null;
  expire_date: string | null;
  created_at: string;
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'parent', label: 'Parents' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
];

export const AnnouncementsComposer: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    audiences: ['all'] as string[],
    expiry_date: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('id,title,content,priority,is_published,target_audience,publish_date,expire_date,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleAudience = (v: string) => {
    setForm(f => {
      const has = f.audiences.includes(v);
      const next = has ? f.audiences.filter(a => a !== v) : [...f.audiences, v];
      return { ...f, audiences: next.length ? next : ['all'] };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        target_audience: form.audiences as any,
        is_published: true,
        publish_date: new Date().toISOString(),
        expire_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast({ title: 'Announcement published' });
      setForm({ title: '', content: '', priority: 'normal', audiences: ['all'], expiry_date: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else load();
  };

  const togglePublish = async (a: Announcement) => {
    const { error } = await supabase.from('announcements').update({ is_published: !a.is_published }).eq('id', a.id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Compose announcement</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-2"><Label>Title</Label><Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Message</Label><Textarea required rows={6} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} /></div>
            <div className="grid gap-2">
              <Label>Audience (select one or more)</Label>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCE_OPTIONS.map(o => (
                  <label key={o.value} className="flex items-center gap-2 border rounded-md p-2 cursor-pointer hover:bg-accent">
                    <Checkbox checked={form.audiences.includes(o.value)} onCheckedChange={() => toggleAudience(o.value)} />
                    <span className="text-sm">{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Expires on (optional)</Label>
                <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Publish
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent announcements</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-auto">
              {items.map(a => (
                <div key={a.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {a.title}
                        {!a.is_published && <Badge variant="outline">Draft</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{a.priority}</Badge>
                      <Badge variant="secondary">{(a.target_audience || []).join(', ')}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => togglePublish(a)} title={a.is_published ? 'Unpublish' : 'Publish'}>
                        {a.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{a.content}</p>
                  {a.expire_date && (
                    <p className="text-xs text-muted-foreground mt-1">Expires {new Date(a.expire_date).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementsComposer;