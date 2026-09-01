import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InterviewPanelManager } from '@/components/admin/InterviewPanelManager';
import { InterviewFeedbackForm } from '@/components/admin/InterviewFeedbackForm';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

interface InterviewRow {
  id: string;
  scheduled_date: string;
  status: string;
  interview_type: string | null;
  location: string | null;
  admission_applications: {
    id: string;
    first_name: string;
    last_name: string;
    application_number: string;
  } | null;
}

/**
 * Lists every interview scheduled for the admin's school and exposes the
 * panel-management and feedback dialogs inline. Replaces the previously
 * standalone `InterviewScheduler` / `InterviewPanelManager` admin entries.
 */
export const InterviewsTab: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_interviews')
      .select(`
        id, scheduled_date, status, interview_type, location,
        admission_applications:application_id (
          id, first_name, last_name, application_number
        )
      `)
      .order('scheduled_date', { ascending: false });

    if (error) {
      toast({ title: 'Failed to load interviews', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as unknown as InterviewRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Scheduled Interviews
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No interviews scheduled yet. Schedule one from an application in the Applications tab.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">
                      {row.admission_applications
                        ? `${row.admission_applications.first_name} ${row.admission_applications.last_name}`
                        : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.admission_applications?.application_number}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(row.scheduled_date), 'PPp')}</TableCell>
                  <TableCell className="capitalize">{row.interview_type ?? ''}</TableCell>
                  <TableCell>
                    {row.location ? (
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" /> {row.location}
                      </span>
                    ) : (
                      ''
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'completed' ? 'default' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <InterviewPanelManager
                        interviewId={row.id}
                        onUpdate={load}
                        trigger={
                          <Button size="sm" variant="outline">
                            <Users className="h-3 w-3 mr-1" /> Panel
                          </Button>
                        }
                      />
                      <InterviewFeedbackForm
                        interviewId={row.id}
                        onSubmit={load}
                      />
                    </div>
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

export default InterviewsTab;