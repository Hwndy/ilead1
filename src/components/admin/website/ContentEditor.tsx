import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SITE_PAGES, SITE_DEFAULTS, type SitePage } from '@/config/siteSchema';
import { FieldEditor } from './FieldEditor';
import { CMS_PREVIEW_PARAM, sendDraft } from '@/lib/cms-preview';
import { Eye, RotateCcw, Save, ExternalLink } from 'lucide-react';

const HIDDEN_KEY = 'sections_hidden';

export const ContentEditor: React.FC = () => {
  const [pageKey, setPageKey] = useState<string>(SITE_PAGES[1]?.key ?? SITE_PAGES[0].key);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: saved = {} } = useQuery({
    queryKey: ['website-settings-raw'],
    queryFn: async () => {
      const { data, error } = await supabase.from('website_settings').select('setting_key, setting_value');
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((row: any) => { map[row.setting_key] = row.setting_value; });
      return map;
    },
  });

  const page: SitePage = useMemo(
    () => SITE_PAGES.find((p) => p.key === pageKey) ?? SITE_PAGES[0],
    [pageKey],
  );

  const valueOf = (key: string) => {
    if (key in drafts) return drafts[key];
    const s = saved?.[key];
    return s != null && s !== '' ? s : SITE_DEFAULTS[key];
  };

  const hidden: string[] = valueOf(HIDDEN_KEY) ?? [];

  const setValue = (key: string, value: any) => setDrafts((d) => ({ ...d, [key]: value }));

  const toggleSection = (sectionKey: string, visible: boolean) => {
    const id = `${page.key}.${sectionKey}`;
    const next = visible ? hidden.filter((h) => h !== id) : Array.from(new Set([...hidden, id]));
    setValue(HIDDEN_KEY, next);
  };

  // Stream unsaved changes into the live preview.
  useEffect(() => {
    const t = setTimeout(() => {
      if (frameRef.current) sendDraft(frameRef.current, drafts);
    }, 250);
    return () => clearTimeout(t);
  }, [drafts]);

  const save = async () => {
    const entries = Object.entries(drafts);
    if (!entries.length) {
      toast({ title: 'Nothing to save' });
      return;
    }
    setSaving(true);
    try {
      const rows = entries.map(([setting_key, setting_value]) => ({ setting_key, setting_value }));
      const { error } = await supabase.from('website_settings').upsert(rows, { onConflict: 'setting_key' });
      if (error) throw error;
      setDrafts({});
      queryClient.invalidateQueries({ queryKey: ['website-settings-raw'] });
      queryClient.invalidateQueries({ queryKey: ['cms', 'website_settings'] });
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
      toast({ title: 'Website updated', description: 'Your changes are now live.' });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetSection = (fieldKeys: string[]) => {
    setDrafts((d) => {
      const next = { ...d };
      fieldKeys.forEach((k) => { next[k] = SITE_DEFAULTS[k]; });
      return next;
    });
  };

  const dirty = Object.keys(drafts).length;
  const previewSrc = `${page.path}?${CMS_PREVIEW_PARAM}=1`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SITE_PAGES.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={p.key === pageKey ? 'default' : 'outline'}
              onClick={() => setPageKey(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <Badge variant="secondary">{dirty} unsaved change{dirty > 1 ? 's' : ''}</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="mr-2 h-4 w-4" /> {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={page.path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Open page
            </a>
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className={showPreview ? 'grid gap-4 xl:grid-cols-2' : ''}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{page.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {page.sections.map((section) => {
                const isVisible = !hidden.includes(`${page.key}.${section.key}`);
                return (
                  <AccordionItem key={section.key} value={section.key}>
                    <AccordionTrigger className="text-left">
                      <span className="flex items-center gap-2">
                        {section.label}
                        {!isVisible ? <Badge variant="outline">Hidden</Badge> : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pt-2">
                      <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                        <Label htmlFor={`vis-${section.key}`} className="text-sm">Show this section on the page</Label>
                        <Switch
                          id={`vis-${section.key}`}
                          checked={isVisible}
                          onCheckedChange={(v) => toggleSection(section.key, v)}
                        />
                      </div>
                      {section.fields.map((field) => (
                        <FieldEditor
                          key={field.key}
                          field={field}
                          value={valueOf(field.key)}
                          onChange={(v) => setValue(field.key, v)}
                        />
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => resetSection(section.fields.map((f) => f.key))}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset section to default text
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {showPreview ? (
          <Card className="hidden xl:block">
            <CardHeader>
              <CardTitle className="text-base">Live preview</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                ref={frameRef}
                title="Website preview"
                src={previewSrc}
                className="h-[70vh] w-full rounded-lg border"
                onLoad={() => frameRef.current && sendDraft(frameRef.current, drafts)}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};
