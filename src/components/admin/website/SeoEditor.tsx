import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { SITE_PAGES } from '@/config/siteSchema';
import { MediaPicker } from './MediaPicker';
import { Save } from 'lucide-react';

interface SeoRow { page_key: string; title: string; description: string; og_image: string }

export const SeoEditor: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, Partial<SeoRow>>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ['cms-admin', 'page_seo'],
    queryFn: async (): Promise<SeoRow[]> => {
      const { data, error } = await cmsDb.from(CMS_TABLES.seo).select('page_key,title,description,og_image');
      if (error) throw error;
      return (data as SeoRow[]) || [];
    },
  });

  const valueOf = (pageKey: string, key: keyof SeoRow) => {
    const edit = edits[pageKey]?.[key];
    if (edit !== undefined) return edit as string;
    return (rows.find((r) => r.page_key === pageKey)?.[key] as string) ?? '';
  };

  const setValue = (pageKey: string, key: keyof SeoRow, value: string) =>
    setEdits((e) => ({ ...e, [pageKey]: { ...(e[pageKey] || {}), [key]: value } }));

  const save = async () => {
    const payload = Object.entries(edits).map(([page_key, patch]) => ({
      page_key,
      title: patch.title ?? valueOf(page_key, 'title'),
      description: patch.description ?? valueOf(page_key, 'description'),
      og_image: patch.og_image ?? valueOf(page_key, 'og_image'),
    }));
    if (!payload.length) return toast({ title: 'Nothing to save' });
    const { error } = await cmsDb.from(CMS_TABLES.seo).upsert(payload, { onConflict: 'page_key' });
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    setEdits({});
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'page_seo'] });
    queryClient.invalidateQueries({ queryKey: ['cms', 'page_seo'] });
    toast({ title: 'Search settings updated' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={save}><Save className="mr-2 h-4 w-4" /> Save search settings</Button>
      </div>
      {SITE_PAGES.filter((p) => p.key !== 'global').map((page) => (
        <Card key={page.key}>
          <CardHeader>
            <CardTitle className="text-base">{page.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{page.path}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Page title (shown in Google results and the browser tab)</Label>
              <Input value={valueOf(page.key, 'title')} onChange={(e) => setValue(page.key, 'title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={valueOf(page.key, 'description')}
                onChange={(e) => setValue(page.key, 'description', e.target.value)}
              />
            </div>
            <MediaPicker
              label="Share image"
              value={valueOf(page.key, 'og_image')}
              onChange={(v) => setValue(page.key, 'og_image', v)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
