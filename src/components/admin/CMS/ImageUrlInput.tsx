import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateUpload, IMAGE_MIME } from '@/lib/file-upload-guards';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  id?: string;
  folder: string; // e.g. 'news', 'gallery', 'testimonials', 'site'
  placeholder?: string;
}

// Reuses the public 'admission-documents' bucket under a website/<folder>/ prefix.
// Admins have full manage rights; the bucket is public-read so URLs work on the site.
const BUCKET = 'media';

export const ImageUrlInput = ({
  value,
  onChange,
  label = 'Image',
  id,
  folder,
  placeholder = 'https://example.com/image.jpg',
}: ImageUrlInputProps) => {
  const inputId = id || `img-${folder}`;
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
      const path = `website/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(pub.publicUrl);
      toast({ title: 'Uploaded', description: 'Image uploaded successfully' });
    } catch (e: any) {
      toast({
        title: 'Upload failed',
        description: e?.message || 'Could not upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">
            {uploading ? 'Uploading…' : 'Upload'}
          </span>
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange('')}
            title="Clear image"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value && (
        <div className="mt-2">
          <img
            src={value}
            alt="Preview"
            className="h-24 w-auto rounded border border-border object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        </div>
      )}
    </div>
  );
};