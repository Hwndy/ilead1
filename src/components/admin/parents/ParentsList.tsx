import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Eye, KeyRound, Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { AddParentDialog } from './AddParentDialog';

interface ParentRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  child_count: number;
  created_at: string | null;
}

interface Props { onView: (userId: string) => void; }

export const ParentsList: React.FC<Props> = ({ onView }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id,created_at').eq('role', 'parent');
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) { setRows([]); return; }
      const [{ data: profs }, { data: parents }] = await Promise.all([
        supabase.from('profiles').select('user_id,full_name').in('user_id', ids),
        supabase.from('parents').select('id,user_id,phone_primary').in('user_id', ids),
      ]);
      const parentIds = (parents || []).map(p => p.id);
      const { data: rels } = parentIds.length
        ? await supabase.from('student_parent_relationships').select('parent_id').in('parent_id', parentIds)
        : { data: [] as any };
      const countByParent: Record<string, number> = {};
      (rels || []).forEach((r: any) => { countByParent[r.parent_id] = (countByParent[r.parent_id] || 0) + 1; });

      // Emails via export-users edge (contains all users). Cheap fallback: leave email null if unavailable.
      let emailMap: Record<string, string> = {};
      try {
        const { data: exp } = await supabase.functions.invoke('export-users');
        (exp?.users || []).forEach((u: any) => { emailMap[u.user_id || u.id] = u.email; });
      } catch { /* ignore */ }

      const built: ParentRow[] = ids.map(uid => {
        const parent = parents?.find(p => p.user_id === uid);
        return {
          user_id: uid,
          full_name: profs?.find(p => p.user_id === uid)?.full_name || '',
          email: emailMap[uid] || null,
          phone: parent?.phone_primary || null,
          child_count: parent ? (countByParent[parent.id] || 0) : 0,
          created_at: roles?.find(r => r.user_id === uid)?.created_at || null,
        };
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));
      setRows(built);
    } catch (e: any) {
      toast({ title: 'Failed to load parents', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(r => {
      const matchQ = !t || r.full_name.toLowerCase().includes(t) || (r.email || '').toLowerCase().includes(t) || (r.phone || '').includes(t);
      const matchF = filter === 'all' || (filter === 'linked' ? r.child_count > 0 : r.child_count === 0);
      return matchQ && matchF;
    });
  }, [rows, q, filter]);

  const resetPassword = async (row: ParentRow) => {
    if (!row.email) { toast({ title: 'No email on file', variant: 'destructive' }); return; }
    const pwd = prompt(`Set a temporary password for ${row.full_name}:`);
    if (!pwd || pwd.length < 8) return;
    setBusyId(row.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { userId: row.user_id, newPassword: pwd },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: 'Password updated' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const deleteParent = async (row: ParentRow) => {
    if (!confirm(`Delete parent account for ${row.full_name}? This unlinks all children.`)) return;
    setBusyId(row.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-parent-account', {
        body: { parentUserId: row.user_id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: 'Parent deleted' });
      load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Children', 'Created'];
    const lines = [header.join(',')].concat(filtered.map(r => [
      r.full_name, r.email || '', r.phone || '', r.child_count, r.created_at || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `parents_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <Input placeholder="Search name, email, phone…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parents</SelectItem>
              <SelectItem value="linked">With children</SelectItem>
              <SelectItem value="unlinked">No children</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Add Parent</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Children</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No parents found</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email || ''}</TableCell>
                    <TableCell>{r.phone || ''}</TableCell>
                    <TableCell><Badge variant={r.child_count > 0 ? 'default' : 'secondary'}>{r.child_count}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onView(r.user_id)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busyId === r.user_id} onClick={() => resetPassword(r)}><KeyRound className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busyId === r.user_id} onClick={() => deleteParent(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddParentDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  );
};