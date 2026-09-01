import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateUpload, IMAGE_MIME } from '@/lib/file-upload-guards';
import { Upload, X, Loader2, User } from 'lucide-react';

interface PhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  /** storage prefix, e.g. `students/<user id>` */
  folder: string;
  label?: string;
  id?: string;
}

const BUCKET = 'media';

/** Passport photo picker with preview. Uploads to public storage and returns the URL. */
export const PhotoUpload = ({ value, onChange, folder, label = 'Passport Photo', id }: PhotoUploadProps) => {
  const inputId = id || 'photo-upload';
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const err = validateUpload(file, { allow: IMAGE_MIME });
    if (err) {
      toast({ title: 'Upload rejected', description: err, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(pub.publicUrl);
      toast({ title: 'Photo uploaded', description: 'Your photo has been saved to your profile.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload photo', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
          {value ? (
            <img src={value} alt="Passport photo preview" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            id={inputId}
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />{value ? 'Change photo' : 'Upload photo'}</>
            )}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={uploading}>
              <X className="h-4 w-4 mr-2" />Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">JPG or PNG, clear head-and-shoulders photo.</p>
    </div>
  );
};

export default PhotoUpload;