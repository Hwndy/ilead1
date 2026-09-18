import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';

interface Submission {
  id: string;
  form_key: string;
  payload: Record<string, any>;
  created_at: string;
}

export const SubmissionsInbox: React.FC = () => {
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['cms-admin', 'submissions'],
    queryFn: async (): Promise<Submission[]> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.submissions)
        .select('id,form_key,payload,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as Submission[]) || [];
    },
  });

  const remove = async (id: string) => {
    await cmsDb.from(CMS_TABLES.submissions).delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'submissions'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Messages from the website</CardTitle>
        <p className="text-sm text-muted-foreground">Contact and newsletter forms submitted by visitors.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!isLoading && data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No messages yet.</p>
        ) : null}
        {data.map((s) => (
          <div key={s.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.form_key} · {format(new Date(s.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  {Object.entries(s.payload || {}).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="font-medium capitalize">{k.replace(/_/g, ' ')}:</dt>
                      <dd className="text-muted-foreground">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)} aria-label="Delete message">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
