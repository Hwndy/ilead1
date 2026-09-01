import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format } from 'date-fns';

type Row = {
  id: string; staff_id: string; leave_type: string; start_date: string; end_date: string;
  reason: string | null; status: string; decision_notes: string | null; created_at: string;
  staff_name?: string | null;
};

export const LeaveManagement: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
    else {
      const ids = Array.from(new Set((data || []).map((r) => r.staff_id))).filter(Boolean);
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
        : { data: [] as any[] };
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      setRows((data || []).map((r) => ({ ...r, staff_name: map.get(r.staff_id) || 'Unknown' })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const notes = window.prompt(`Optional note for ${status}:`) || null;
    const { error } = await supabase
      .from('leave_requests')
      .update({ status, approver_id: user?.id, decided_at: new Date().toISOString(), decision_notes: notes })
      .eq('id', id);
    if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    else { toast({ title: `Request ${status}` }); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Leave Requests</h2>
        <p className="text-muted-foreground">Approve or reject staff leave.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All Requests</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead><TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead><TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.staff_name}</TableCell>
                      <TableCell className="capitalize">{r.leave_type}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={r.reason || ''}>{r.reason || ''}</TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === 'approved' ? 'default'
                          : r.status === 'rejected' ? 'destructive'
                          : 'secondary'
                        }>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {isAdmin && r.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => decide(r.id, 'approved')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => decide(r.id, 'rejected')}>Reject</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveManagement;