import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const PastStudents: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: studs } = await 
      supabase.from('students').select('id,user_id,registration_number,archived_at,archived_reason').not('archived_at', 'is', null)
    ;
    const uids = (studs || []).map((s: any) => s.user_id);
    const nameMap = new Map<string, string>();
    if (uids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id,full_name').in('user_id', uids);
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name));
    }
    setRows((studs || []).map((s: any) => ({ ...s, name: nameMap.get(s.user_id) || '' })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    await supabase.from('students').update({ archived_at: null, archived_reason: null }).eq('id', id);
    toast({ title: 'Restored', description: 'Student moved back to active list.' });
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Past Students / Archive</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : rows.length === 0 ? <div className="py-12 text-center text-muted-foreground">No archived students yet.</div>
        : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Reg. No</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.registration_number || ''}</TableCell>
                  <TableCell>{r.archived_reason || ''}</TableCell>
                  <TableCell>{new Date(r.archived_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => restore(r.id)}>
                      <RotateCcw className="h-4 w-4 mr-2" />Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PastStudents;