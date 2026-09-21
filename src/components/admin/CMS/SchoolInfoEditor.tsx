import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';
import type { SchoolInfo } from '@/types/website';

export const SchoolInfoEditor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schoolInfo, isLoading } = useQuery({
    queryKey: ['school-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_info')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as SchoolInfo[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { key: string; value: string; category: string }[]) => {
      const promises = updates.map(({ key, value, category }) =>
        supabase
          .from('school_info')
          .upsert({
            info_key: key,
            info_value: value,
            category,
            is_active: true,
          })
          .eq('info_key', key)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-info'] });
      toast({ title: 'Success', description: 'School information updated' });
    },
  });

  const getValue = (key: string) => {
    return schoolInfo?.find((info) => info.info_key === key)?.info_value || '';
  };

  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (category: string, fields: { key: string; label: string }[]) => {
    const updates = fields.map(({ key }) => ({
      key,
      value: formData[key] || getValue(key),
      category,
    }));
    updateMutation.mutate(updates);
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  const generalFields = [
    { key: 'name', label: 'School Name' },
    { key: 'motto', label: 'School Motto' },
    { key: 'established_year', label: 'Established Year' },
    { key: 'principal_name', label: 'Principal Name' },
  ];

  const contactFields = [
    { key: 'contact_phone', label: 'Contact Phone' },
    { key: 'whatsapp_number', label: 'WhatsApp Number' },
    { key: 'contact_email', label: 'Contact Email' },
    { key: 'address', label: 'Physical Address' },
  ];

  const socialFields = [
    { key: 'facebook_url', label: 'Facebook URL' },
    { key: 'twitter_url', label: 'Twitter URL' },
    { key: 'instagram_url', label: 'Instagram URL' },
    { key: 'linkedin_url', label: 'LinkedIn URL' },
    { key: 'youtube_url', label: 'YouTube URL' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="social">Social Media</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              {generalFields.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    defaultValue={getValue(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => handleSave('general', generalFields)}>
                <Save className="h-4 w-4 mr-2" />
                Save General Info
              </Button>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              {contactFields.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    defaultValue={getValue(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => handleSave('contact', contactFields)}>
                <Save className="h-4 w-4 mr-2" />
                Save Contact Info
              </Button>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              {socialFields.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="url"
                    placeholder={`https://...`}
                    defaultValue={getValue(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => handleSave('social', socialFields)}>
                <Save className="h-4 w-4 mr-2" />
                Save Social Media Links
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
