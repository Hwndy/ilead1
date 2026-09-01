import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Unlink, UserPlus } from 'lucide-react';
import { LinkParentStudentDialog } from './LinkParentStudentDialog';

interface Props { parentUserId: string; onBack: () => void; }

interface Child {
  relationship_id: string;
  student_id: string;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  relationship_type: string;
  verified: boolean;
  can_view_grades: boolean;
  can_view_attendance: boolean;
  can_view_fees: boolean;
}

export const ParentDetail: React.FC<Props> = ({ parentUserId, onBack }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; created_at?: string } | null>(null);
  const [parent, setParent] = useState<{ id: string; phone_primary: string | null; notification_preferences: any } | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prof }, { data: par }] = await Promise.all([
        supabase.from('profiles').select('full_name,created_at').eq('user_id', parentUserId).maybeSingle(),
        supabase.from('parents').select('id,phone_primary,notification_preferences').eq('user_id', parentUserId).maybeSingle(),
      ]);
      setProfile(prof as any); setParent(par as any);

      if (par?.id) {
        const { data: rels } = await supabase
          .from('student_parent_relationships')
          .select('id,relationship_type,verified,can_view_grades,can_view_attendance,can_view_fees,student_id')
          .eq('parent_id', par.id);
        const sids = (rels || []).map(r => r.student_id);
        const { data: students } = sids.length
          ? await supabase.from('students').select('id,user_id,admission_number').in('id', sids)
          : { data: [] as any };
        const uids = (students || []).map((s: any) => s.user_id).filter(Boolean);
        // class_assignments.student_id stores the student's auth user_id, not students.id
        const { data: cas } = uids.length
          ? await supabase.from('class_assignments').select('student_id,class_id').in('student_id', uids)
          : { data: [] as any };
        const cids = (cas || []).map((c: any) => c.class_id).filter(Boolean);
        const [{ data: sprof }, { data: classes }] = await Promise.all([
          uids.length ? supabase.from('profiles').select('user_id,full_name').in('user_id', uids) : Promise.resolve({ data: [] as any }),
          cids.length ? supabase.from('classes').select('id,name').in('id', cids) : Promise.resolve({ data: [] as any }),
        ]);
        const built: Child[] = (rels || []).map((r: any) => {
          const s = students?.find((x: any) => x.id === r.student_id);
          const ca = cas?.find((x: any) => x.student_id === s?.user_id);
          const cls = classes?.find((c: any) => c.id === ca?.class_id);
          return {
            relationship_id: r.id, student_id: r.student_id,
            full_name: sprof?.find((p: any) => p.user_id === s?.user_id)?.full_name || s?.admission_number || 'Student',
            admission_number: s?.admission_number || null, class_name: cls?.name || null,
            relationship_type: r.relationship_type, verified: r.verified,
            can_view_grades: r.can_view_grades, can_view_attendance: r.can_view_attendance, can_view_fees: r.can_view_fees,
          };
        });
        setChildren(built);

        if (sids.length) {
          const { data: pays } = await supabase.from('fee_payments')
            .select('id,student_id,amount,status,created_at,receipt_number')
            .in('student_id', sids).order('created_at', { ascending: false }).limit(20);
          setPayments(pays || []);
        } else setPayments([]);
      } else {
        setChildren([]); setPayments([]);
      }
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [parentUserId]);

  const unlink = async (relationship_id: string) => {
    if (!confirm('Unlink this child from the parent?')) return;
    const { error } = await supabase.rpc('admin_unlink_parent', { p_relationship_id: relationship_id });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Unlinked' }); load(); }
  };

  const togglePerm = async (rel: Child, key: 'can_view_grades' | 'can_view_attendance' | 'can_view_fees') => {
    const patch: Record<string, boolean> = { [key]: !rel[key] };
    const { error } = await supabase.from('student_parent_relationships').update(patch as any).eq('id', rel.relationship_id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else load();
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back to parents</Button>

      <Card>
        <CardHeader><CardTitle>{profile?.full_name || 'Parent'}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <div><div className="text-muted-foreground">Phone</div><div>{parent?.phone_primary || ''}</div></div>
          <div><div className="text-muted-foreground">Children linked</div><div>{children.length}</div></div>
          <div><div className="text-muted-foreground">Account created</div><div>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Linked children</CardTitle>
          <Button size="sm" onClick={() => setLinkOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Link a child</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Adm. #</TableHead><TableHead>Class</TableHead>
              <TableHead>Relationship</TableHead><TableHead>Permissions</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {children.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No children linked</TableCell></TableRow>
              ) : children.map(c => (
                <TableRow key={c.relationship_id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>{c.admission_number || ''}</TableCell>
                  <TableCell>{c.class_name || <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                  <TableCell><Badge variant="outline">{c.relationship_type}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(['can_view_grades','can_view_attendance','can_view_fees'] as const).map(k => (
                        <Badge key={k} variant={c[k] ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => togglePerm(c, k)}>
                          {k.replace('can_view_','')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => unlink(c.relationship_id)}><Unlink className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent fee activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Receipt</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No payments</TableCell></TableRow>
              ) : payments.map(p => {
                const child = children.find(c => c.student_id === p.student_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{child?.full_name || ''}</TableCell>
                    <TableCell>₦{Number(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === 'success' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell className="text-sm">{p.receipt_number || ''}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(parent?.notification_preferences || {}, null, 2)}</pre>
        </CardContent>
      </Card>

      <LinkParentStudentDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={load} fixedParentUserId={parentUserId} />
    </div>
  );
};