import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MediaPicker } from './MediaPicker';
import type { SiteField, ItemField } from '@/config/siteSchema';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

interface Props {
  field: SiteField;
  value: any;
  onChange: (value: any) => void;
}

const ItemInput: React.FC<{ item: ItemField; value: any; onChange: (v: any) => void }> = ({ item, value, onChange }) => {
  if (item.type === 'textarea') {
    return <Textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={item.label} />;
  }
  if (item.type === 'image') {
    return <MediaPicker value={value ?? ''} onChange={onChange} />;
  }
  return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={item.label} />;
};

export const FieldEditor: React.FC<Props> = ({ field, value, onChange }) => {
  const id = `f-${field.key}`;

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor={id}>{field.label}</Label>
        <Switch id={id} checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.type === 'image') {
    return <MediaPicker label={field.label} value={value ?? ''} onChange={onChange} />;
  }

  if (field.type === 'list') {
    const itemFields = field.itemFields ?? [{ key: '', label: 'Item', type: 'text' as const }];
    const simple = itemFields.length === 1 && itemFields[0].key === '';
    const items: any[] = Array.isArray(value) ? value : [];

    const update = (next: any[]) => onChange(next);
    const setItem = (index: number, v: any) => update(items.map((it, i) => (i === index ? v : it)));
    const move = (index: number, dir: -1 | 1) => {
      const next = [...items];
      const target = index + dir;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      update(next);
    };

    return (
      <div className="space-y-3">
        <Label>{field.label}</Label>
        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Item {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(index, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(index, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => update(items.filter((_, i) => i !== index))}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {simple ? (
                <ItemInput item={itemFields[0]} value={item} onChange={(v) => setItem(index, v)} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {itemFields.map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
                      <Label className="text-xs">{f.label}</Label>
                      <ItemInput
                        item={f}
                        value={item?.[f.key]}
                        onChange={(v) => setItem(index, { ...(item || {}), [f.key]: v })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update([...items, simple ? '' : {}])}
        >
          <Plus className="mr-2 h-4 w-4" /> Add item
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === 'textarea' ? (
        <Textarea id={id} rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
};
