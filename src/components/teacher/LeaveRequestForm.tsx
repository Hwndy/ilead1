import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const TYPES = ['annual', 'sick', 'maternity', 'paternity', 'casual', 'unpaid', 'other'];

export const LeaveRequestForm: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState('annual');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('leave_requests').select('*')
      .eq('staff_id', user.id).order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !start || !end) return;
    setSubmitting(true);
    const { error } = await supabase.from('leave_requests').insert({
      staff_id: user.id, leave_type: type, start_date: start, end_date: end, reason,
    });
    setSubmitting(false);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Leave submitted' }); setReason(''); setStart(''); setEnd(''); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Leave Requests</h2>
        <p className="text-muted-foreground">Submit and track your leave.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Request</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />
            <div><Label>Start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            <div><Label>End</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
            <div className="md:col-span-2">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My Requests</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead>Note</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="capitalize">{r.leave_type}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell><Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>{r.status}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{r.decision_notes || ''}</TableCell>
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

export default LeaveRequestForm;