import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { Plus, Save, Trash2 } from 'lucide-react';

type Location = 'primary' | 'more' | 'footer';

interface Row {
  id: string;
  location: Location;
  label: string;
  href: string;
  display_order: number;
  is_visible: boolean;
}

const LOCATIONS: { key: Location; label: string; help: string }[] = [
  { key: 'primary', label: 'Main menu', help: 'Links shown across the top of the website.' },
  { key: 'more', label: '“More” menu', help: 'Extra links tucked under the More dropdown.' },
  { key: 'footer', label: 'Footer links', help: 'Links listed in the footer.' },
];

export const MenuEditor: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);

  const { data = [] } = useQuery({
    queryKey: ['cms-admin', 'menu'],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.menu)
        .select('id,location,label,href,display_order,is_visible')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const items = rows ?? data;
  const update = (id: string, patch: Partial<Row>) =>
    setRows(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const add = async (location: Location) => {
    const order = items.filter((i) => i.location === location).length + 1;
    const { error } = await cmsDb
      .from(CMS_TABLES.menu)
      .insert({ location, label: 'New link', href: '/website', display_order: order, is_visible: true });
    if (error) return toast({ title: 'Could not add link', description: error.message, variant: 'destructive' });
    setRows(null);
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'menu'] });
    queryClient.invalidateQueries({ queryKey: ['cms', 'site_menu_items'] });
  };

  const remove = async (id: string) => {
    await cmsDb.from(CMS_TABLES.menu).delete().eq('id', id);
    setRows(null);
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'menu'] });
    queryClient.invalidateQueries({ queryKey: ['cms', 'site_menu_items'] });
  };

  const save = async () => {
    for (const row of items) {
      const { error } = await cmsDb
        .from(CMS_TABLES.menu)
        .update({
          label: row.label,
          href: row.href,
          display_order: row.display_order,
          is_visible: row.is_visible,
        })
        .eq('id', row.id);
      if (error) {
        toast({ title: 'Could not save menu', description: error.message, variant: 'destructive' });
        return;
      }
    }
    setRows(null);
    queryClient.invalidateQueries({ queryKey: ['cms-admin', 'menu'] });
    queryClient.invalidateQueries({ queryKey: ['cms', 'site_menu_items'] });
    toast({ title: 'Menu updated' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={save}><Save className="mr-2 h-4 w-4" /> Save menu</Button>
      </div>
      {LOCATIONS.map((loc) => (
        <Card key={loc.key}>
          <CardHeader>
            <CardTitle className="text-base">{loc.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{loc.help}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.filter((i) => i.location === loc.key).map((row) => (
              <div key={row.id} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_90px_auto_auto]">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={row.label} onChange={(e) => update(row.id, { label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Link</Label>
                  <Input value={row.href} onChange={(e) => update(row.id, { href: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Order</Label>
                  <Input
                    type="number"
                    value={row.display_order}
                    onChange={(e) => update(row.id, { display_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={row.is_visible} onCheckedChange={(v) => update(row.id, { is_visible: v })} />
                  <span className="text-xs text-muted-foreground">Visible</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(row.id)} aria-label="Remove link">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => add(loc.key)}>
              <Plus className="mr-2 h-4 w-4" /> Add link
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
