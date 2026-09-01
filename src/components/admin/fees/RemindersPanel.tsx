import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const RemindersPanel: React.FC = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('fee_reminder_logs')
      .select('*, students(id, user_id, admission_number)')
      .order('sent_at', { ascending: false }).limit(50);
    const rows = (data || []) as any[];
    const userIds = [...new Set(rows.map(r => r.students?.user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    }
    setLogs(rows.map(r => ({
      ...r,
      students: r.students ? { ...r.students, profiles: { full_name: nameMap.get(r.students.user_id) || 'Unknown' } } : null,
    })));
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-fee-reminders', { body: { reminder_days: [7, 3, 1] } });
      if (error) throw error;
      toast({ title: 'Reminders processed', description: `${data?.reminders_count || 0} reminders (${data?.overdue_count || 0} overdue, ${data?.upcoming_count || 0} upcoming)` });
      load();
    } catch (e: any) {
      toast({ title: 'Reminder run failed', description: e.message, variant: 'destructive' });
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Fee Reminders</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Send reminders for overdue installments and installments due within 1, 3, or 7 days.</p>
          <Button onClick={run} disabled={running}>{running ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : <Bell className="h-4 w-4 mr-1"/>}Run Reminder Job</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent Reminder Activity</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Sent</TableHead><TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{l.sent_at ? format(new Date(l.sent_at), 'PPp') : ''}</TableCell>
                  <TableCell>{l.students?.profiles?.full_name || ''} <span className="text-xs text-muted-foreground">{l.students?.admission_number}</span></TableCell>
                  <TableCell className="capitalize">{l.reminder_type}</TableCell>
                  <TableCell><Badge variant={l.status === 'sent' ? 'default' : 'outline'}>{l.status || 'pending'}</Badge></TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No reminder logs yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};