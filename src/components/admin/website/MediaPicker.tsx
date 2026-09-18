import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSiteMedia } from '@/hooks/useCms';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

/** Image field with upload, media-library picking and plain link pasting. */
export const MediaPicker: React.FC<Props> = ({ value, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: media = [] } = useSiteMedia();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cms', 'site_media'] });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-')}`;
      const { error } = await cmsDb.storage.from('site-media').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = cmsDb.storage.from('site-media').getPublicUrl(path);
      const url = data.publicUrl;
      await cmsDb.from(CMS_TABLES.media).insert({ url, title: file.name });
      refresh();
      onChange(url);
      setOpen(false);
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    await cmsDb.from(CMS_TABLES.media).delete().eq('id', id);
    refresh();
  };

  return (
    <div className="space-y-2">
      {label ? <p className="text-sm font-medium">{label}</p> : null}
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-14 w-20 rounded-md border object-cover" />
        ) : (
          <div className="flex h-14 w-20 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <Input
          value={value || ''}
          placeholder="Paste an image link or choose from the library"
          onChange={(e) => onChange(e.target.value)}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">Library</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Image library</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = '';
                }}
              />
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload image'}
              </Button>
            </div>
            <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {media.map((m) => (
                <div key={m.id} className="group relative overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      onChange(m.url);
                      setOpen(false);
                    }}
                  >
                    <img src={m.url} alt={m.alt_text || ''} className="h-24 w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="absolute right-1 top-1 rounded bg-background/90 p-1 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              {media.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No images yet. Upload one to get started.
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
