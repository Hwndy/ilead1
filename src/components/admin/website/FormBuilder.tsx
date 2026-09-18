import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { Plus, Save, Trash2 } from 'lucide-react';

const FORM_KEY = 'admission_application';

const TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choice list' },
  { value: 'checkbox', label: 'Tick box' },
  { value: 'file', label: 'File upload' },
];

interface Row {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  help_text: string | null;
  is_required: boolean;
  step: number;
  display_order: number;
  is_active: boolean;
}

export const FormBuilder: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);

  const { data = [] } = useQuery({
    queryKey: ['cms-admin', 'form_fields', FORM_KEY],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.formFields)
        .select('id,field_key,label,field_type,options,help_text,is_required,step,display_order,is_active')
        .eq('form_key', FORM_KEY)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const items = rows ?? data;
  const update = (id: string, patch: Partial<Row>) =>
    setRows(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const invalidate = () => {
    setRows(null);
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'form_fields', FORM_KEY] });
    queryClient.invalidateQueries({ queryKey: ['cms', 'form_fields', FORM_KEY] });
  };

  const add = async () => {
    const order = items.length + 1;
    const { error } = await cmsDb.from(CMS_TABLES.formFields).insert({
      form_key: FORM_KEY,
      field_key: `extra_question_${Date.now()}`,
      label: 'New question',
      field_type: 'text',
      is_required: false,
      step: 1,
      display_order: order,
      is_active: true,
    });
    if (error) return toast({ title: 'Could not add question', description: error.message, variant: 'destructive' });
    invalidate();
  };

  const remove = async (id: string) => {
    await cmsDb.from(CMS_TABLES.formFields).delete().eq('id', id);
    invalidate();
  };

  const save = async () => {
    for (const row of items) {
      const { error } = await cmsDb
        .from(CMS_TABLES.formFields)
        .update({
          label: row.label,
          field_type: row.field_type,
          options: row.options ?? [],
          help_text: row.help_text,
          is_required: row.is_required,
          step: row.step,
          display_order: row.display_order,
          is_active: row.is_active,
        })
        .eq('id', row.id);
      if (error) {
        toast({ title: 'Could not save questions', description: error.message, variant: 'destructive' });
        return;
      }
    }
    invalidate();
    toast({ title: 'Application form updated' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Extra application questions</CardTitle>
          <p className="text-sm text-muted-foreground">
            These appear on the online admission form in addition to the standard details.
          </p>
        </div>
        <Button size="sm" onClick={save}><Save className="mr-2 h-4 w-4" /> Save</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((row) => (
          <div key={row.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_110px_110px]">
              <div className="space-y-1">
                <Label className="text-xs">Question</Label>
                <Input value={row.label} onChange={(e) => update(row.id, { label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Answer type</Label>
                <Select value={row.field_type} onValueChange={(v) => update(row.id, { field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Step</Label>
                <Input type="number" value={row.step} onChange={(e) => update(row.id, { step: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order</Label>
                <Input
                  type="number"
                  value={row.display_order}
                  onChange={(e) => update(row.id, { display_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Help text</Label>
                <Input value={row.help_text ?? ''} onChange={(e) => update(row.id, { help_text: e.target.value })} />
              </div>
              {row.field_type === 'select' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Choices (comma separated)</Label>
                  <Input
                    value={(row.options ?? []).join(', ')}
                    onChange={(e) =>
                      update(row.id, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })
                    }
                  />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={row.is_required} onCheckedChange={(v) => update(row.id, { is_required: v })} />
                <span className="text-sm">Required</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={row.is_active} onCheckedChange={(v) => update(row.id, { is_active: v })} />
                <span className="text-sm">Shown on the form</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(row.id)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remove
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No extra questions yet.</p>
        ) : null}
        <Button variant="outline" size="sm" onClick={add}><Plus className="mr-2 h-4 w-4" /> Add question</Button>
      </CardContent>
    </Card>
  );
};
