import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, MessageSquare, Plus, Send, Clock, CheckCircle, 
  XCircle, Loader2, Users, FileText, Trash2, Edit 
} from 'lucide-react';
import { format } from 'date-fns';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'sms' | 'email';
  subject?: string;
  body: string;
  variables: string[];
  created_at: string;
}

interface NotificationQueue {
  id: string;
  template_id: string;
  recipient_type: string;
  recipients: any;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  template?: NotificationTemplate;
}

interface ClassOption {
  id: string;
  name: string;
}

const AVAILABLE_VARIABLES = [
  { key: 'student_name', description: 'Student full name' },
  { key: 'parent_name', description: 'Parent/Guardian name' },
  { key: 'class_name', description: 'Class name' },
  { key: 'fee_amount', description: 'Fee amount due' },
  { key: 'due_date', description: 'Payment due date' },
  { key: 'school_name', description: 'School name' },
  { key: 'exam_date', description: 'Exam date' },
  { key: 'grade', description: 'Student grade/score' },
];

export const BulkNotificationSender: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [queue, setQueue] = useState<NotificationQueue[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'email' as 'sms' | 'email',
    subject: '',
    body: '',
  });

  const [sendForm, setSendForm] = useState({
    recipientType: 'all_parents',
    selectedClasses: [] as string[],
    scheduledAt: '',
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch templates
      const templatesRes = await supabase
        .from('notification_templates')
        .select('*')
        
        .order('created_at', { ascending: false });
      
      setTemplates((templatesRes.data || []) as NotificationTemplate[]);

      // Fetch queue with template info
      const queueRes = await supabase
        .from('notification_queue')
        .select('*')
        
        .order('created_at', { ascending: false })
        .limit(50);
      
      setQueue((queueRes.data || []) as NotificationQueue[]);

      // Fetch classes
      const classesRes = await supabase
        .from('classes')
        .select('id, name')
        
        .order('name');
      
      setClasses((classesRes.data || []) as ClassOption[]);
    } catch (error) {
      console.error('Error fetching notification data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const handleSaveTemplate = async () => {
    try {
      const variables = extractVariables(templateForm.body + (templateForm.subject || ''));
      
      if (editingTemplate) {
        const { error } = await supabase
          .from('notification_templates')
          .update({
            name: templateForm.name,
            type: templateForm.type,
            subject: templateForm.type === 'email' ? templateForm.subject : null,
            body: templateForm.body,
            variables,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);
        
        if (error) throw error;
        toast({ title: 'Success', description: 'Template updated' });
      } else {
        const { error } = await supabase
          .from('notification_templates')
          .insert({
                        name: templateForm.name,
            type: templateForm.type,
            subject: templateForm.type === 'email' ? templateForm.subject : null,
            body: templateForm.body,
            variables,
          });
        
        if (error) throw error;
        toast({ title: 'Success', description: 'Template created' });
      }

      setTemplateDialogOpen(false);
      resetTemplateForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Success', description: 'Template deleted' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSendNotification = async () => {
    if (!selectedTemplate) return;
    setIsSending(true);

    try {
      // Get recipients based on selection
      let recipients: any[] = [];
      
      if (sendForm.recipientType === 'all_parents') {
        const response = await (supabase.from('profiles') as any)
          .select('user_id, full_name')
          .eq('role', 'parent')
          ;
        recipients = (response.data || []) as any[];
      } else if (sendForm.recipientType === 'class' && sendForm.selectedClasses.length > 0) {
        // Get students in selected classes, then their parents
        const { data: students } = await supabase
          .from('class_assignments')
          .select('student_id')
          .in('class_id', sendForm.selectedClasses);
        
        if (students && students.length > 0) {
          const studentIds = students.map(s => s.student_id);
          // For now, get student profiles (parents would need a relationship)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', studentIds);
          recipients = profiles || [];
        }
      }

      // Queue the notification
      const { error } = await supabase
        .from('notification_queue')
        .insert({
                    template_id: selectedTemplate.id,
          recipient_type: sendForm.recipientType,
          recipients: recipients,
          status: sendForm.scheduledAt ? 'pending' : 'processing',
          scheduled_at: sendForm.scheduledAt || null,
        });

      if (error) throw error;

      // If not scheduled, send immediately via edge function
      if (!sendForm.scheduledAt) {
        const functionName = selectedTemplate.type === 'email' 
          ? 'send-bulk-email' 
          : 'send-bulk-sms';
        
        const { error: fnError } = await supabase.functions.invoke(functionName, {
          body: {
            templateId: selectedTemplate.id,
            recipients,
          },
        });

        if (fnError) {
          console.error('Edge function error:', fnError);
          toast({ 
            title: 'Warning', 
            description: 'Notification queued but sending may be delayed',
            variant: 'default'
          });
        }
      }

      toast({ 
        title: 'Success', 
        description: sendForm.scheduledAt 
          ? `Notification scheduled for ${format(new Date(sendForm.scheduledAt), 'PPp')}`
          : `Sending to ${recipients.length} recipients`
      });

      setSendDialogOpen(false);
      setSendForm({ recipientType: 'all_parents', selectedClasses: [], scheduledAt: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', type: 'email', subject: '', body: '' });
    setEditingTemplate(null);
  };

  const openEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject || '',
      body: template.body,
    });
    setTemplateDialogOpen(true);
  };

  const openSendDialog = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setSendDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      processing: 'default',
      sent: 'outline',
      failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{templates.length}</p>
                <p className="text-sm text-muted-foreground">Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{queue.filter(q => q.status === 'sent').length}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{queue.filter(q => q.status === 'pending').length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{queue.filter(q => q.status === 'failed').length}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            Templates
          </TabsTrigger>
          <TabsTrigger value="queue">
            Queue & History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notification Templates</CardTitle>
                <CardDescription>Create and manage SMS/Email templates</CardDescription>
              </div>
              <Button onClick={() => { resetTemplateForm(); setTemplateDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <Card key={template.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {template.type === 'email' ? (
                              <Mail className="h-5 w-5 text-blue-500" />
                            ) : (
                              <MessageSquare className="h-5 w-5 text-green-500" />
                            )}
                            <h3 className="font-semibold">{template.name}</h3>
                          </div>
                          <Badge variant="outline">{template.type}</Badge>
                        </div>
                        {template.subject && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Subject: {template.subject}
                          </p>
                        )}
                        <p className="text-sm line-clamp-2 mb-3">{template.body}</p>
                        {template.variables && template.variables.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {template.variables.map((v) => (
                              <Badge key={v} variant="secondary" className="text-xs">
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => openSendDialog(template)}>
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Queue & History</CardTitle>
              <CardDescription>Track sent and scheduled notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications sent yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">{item.recipient_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {Array.isArray(item.recipients) ? item.recipients.length : 0} recipients
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.scheduled_at 
                            ? format(new Date(item.scheduled_at), 'PPp')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {item.sent_at 
                            ? format(new Date(item.sent_at), 'PPp')
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., Fee Reminder"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={templateForm.type}
                  onValueChange={(v) => setTemplateForm({ ...templateForm, type: v as 'sms' | 'email' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {templateForm.type === 'email' && (
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="e.g., Fee Payment Reminder - {{student_name}}"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Message Body</Label>
              <Textarea
                value={templateForm.body}
                onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                placeholder="Dear {{parent_name}}, this is a reminder..."
                rows={6}
              />
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Available Variables:</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Badge
                    key={v.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => {
                      setTemplateForm({
                        ...templateForm,
                        body: templateForm.body + `{{${v.key}}}`,
                      });
                    }}
                  >
                    {`{{${v.key}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateForm.name || !templateForm.body}>
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{selectedTemplate.body}</p>
              </div>

              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select
                  value={sendForm.recipientType}
                  onValueChange={(v) => setSendForm({ ...sendForm, recipientType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_parents">All Parents</SelectItem>
                    <SelectItem value="all_students">All Students</SelectItem>
                    <SelectItem value="class">Specific Classes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sendForm.recipientType === 'class' && (
                <div className="space-y-2">
                  <Label>Select Classes</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
                    {classes.map((cls) => (
                      <div key={cls.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={cls.id}
                          checked={sendForm.selectedClasses.includes(cls.id)}
                          onCheckedChange={(checked) => {
                            setSendForm({
                              ...sendForm,
                              selectedClasses: checked
                                ? [...sendForm.selectedClasses, cls.id]
                                : sendForm.selectedClasses.filter((id) => id !== cls.id),
                            });
                          }}
                        />
                        <label htmlFor={cls.id} className="text-sm">{cls.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Schedule (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={sendForm.scheduledAt}
                  onChange={(e) => setSendForm({ ...sendForm, scheduledAt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to send immediately
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendNotification} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {sendForm.scheduledAt ? 'Schedule' : 'Send Now'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
