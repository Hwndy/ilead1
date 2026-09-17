import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;
const TERMS = ['First Term', 'Second Term', 'Third Term'];

type Category = { id: string; name: string; is_active: boolean };
type Fee = { id: string; category_id: string | null; name: string; amount: number; is_optional: boolean; is_active: boolean };
type Rule = { id: string; fee_id: string; campus_id: string | null; class_id: string | null; arm_id: string | null; student_type: string | null; term: string | null; academic_year: string | null; is_active: boolean };
type Named = { id: string; name: string };

export const BillingRules: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [campuses, setCampuses] = useState<Named[]>([]);
  const [saving, setSaving] = useState(false);

  const [feeOpen, setFeeOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({ name: '', amount: '', category_id: '', is_optional: false });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ fee_id: '', campus_id: 'all', class_id: 'all', student_type: 'all', term: 'all', academic_year: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats, error }, { data: feeData }, { data: ruleData }, { data: classData }, { data: campusData }] = await Promise.all([
      db.from('fee_categories').select('*').order('name'),
      db.from('fees').select('*').order('name'),
      db.from('fee_rules').select('*'),
      db.from('classes').select('id, name').order('name'),
      db.from('campuses').select('id, name').order('name'),
    ]);
    if (error) { setSetupNeeded(true); setLoading(false); return; }
    setSetupNeeded(false);
    setCategories(cats || []);
    setFees(feeData || []);
    setRules(ruleData || []);
    setClasses(classData || []);
    setCampuses(campusData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const catName = (id: string | null) => categories.find(c => c.id === id)?.name || 'Uncategorised';
  const nameOf = (list: Named[], id: string | null, fallback: string) => (id ? list.find(x => x.id === id)?.name || fallback : fallback);

  const saveFee = async () => {
    if (!feeForm.name.trim() || !feeForm.amount) { toast({ title: 'Name and amount are required', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await db.from('fees').insert({
      name: feeForm.name.trim(),
      amount: Number(feeForm.amount),
      category_id: feeForm.category_id || null,
      is_optional: feeForm.is_optional,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save fee', description: error.message, variant: 'destructive' }); return; }
    setFeeOpen(false); setFeeForm({ name: '', amount: '', category_id: '', is_optional: false }); load();
  };

  const toggleFee = async (fee: Fee) => {
    const { error } = await db.from('fees').update({ is_active: !fee.is_active }).eq('id', fee.id);
    if (error) { toast({ title: 'Could not update fee', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const saveRule = async () => {
    if (!ruleForm.fee_id) { toast({ title: 'Choose a fee', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await db.from('fee_rules').insert({
      fee_id: ruleForm.fee_id,
      campus_id: ruleForm.campus_id === 'all' ? null : ruleForm.campus_id,
      class_id: ruleForm.class_id === 'all' ? null : ruleForm.class_id,
      student_type: ruleForm.student_type === 'all' ? null : ruleForm.student_type,
      term: ruleForm.term === 'all' ? null : ruleForm.term,
      academic_year: ruleForm.academic_year.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save rule', description: error.message, variant: 'destructive' }); return; }
    setRuleOpen(false); setRuleForm({ fee_id: '', campus_id: 'all', class_id: 'all', student_type: 'all', term: 'all', academic_year: '' }); load();
  };

  const deleteRule = async (rule: Rule) => {
    const { error } = await db.from('fee_rules').delete().eq('id', rule.id);
    if (error) { toast({ title: 'Could not remove rule', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const rulesByFee = useMemo(() => {
    const map: Record<string, Rule[]> = {};
    rules.forEach(r => { (map[r.fee_id] ||= []).push(r); });
    return map;
  }, [rules]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (setupNeeded) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>The billing tables are not in the database yet. Run db/phase4-billing.sql in your database SQL editor.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => setRuleOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add rule</Button>
        <Button onClick={() => setFeeOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add fee</Button>
      </div>

      <div className="grid gap-3">
        {fees.map(fee => (
          <Card key={fee.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>{fee.name} · ₦{Number(fee.amount).toLocaleString()}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{catName(fee.category_id)}</Badge>
                  {fee.is_optional && <Badge variant="secondary">Optional</Badge>}
                  <Badge variant={fee.is_active ? 'default' : 'secondary'}>{fee.is_active ? 'Active' : 'Retired'}</Badge>
                  <Button size="sm" variant="outline" onClick={() => toggleFee(fee)}>{fee.is_active ? 'Retire' : 'Restore'}</Button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {(rulesByFee[fee.id] || []).map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm text-muted-foreground border rounded px-2 py-1">
                  <span>
                    {nameOf(campuses, r.campus_id, 'All campuses')} · {nameOf(classes, r.class_id, 'All classes')} · {r.student_type ? (r.student_type === 'boarding' ? 'Boarders' : 'Day students') : 'All students'} · {r.term || 'Every term'}{r.academic_year ? ` · ${r.academic_year}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => deleteRule(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {(rulesByFee[fee.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No rule yet — this fee will not be billed to anyone.</p>}
            </CardContent>
          </Card>
        ))}
        {fees.length === 0 && <p className="text-sm text-muted-foreground">No fees defined yet.</p>}
      </div>

      <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add fee</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={feeForm.name} onChange={e => setFeeForm({ ...feeForm, name: e.target.value })} /></div>
            <div><Label>Amount (₦)</Label><Input type="number" value={feeForm.amount} onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={feeForm.category_id} onValueChange={v => setFeeForm({ ...feeForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={feeForm.is_optional} onCheckedChange={v => setFeeForm({ ...feeForm, is_optional: v })} />
              <Label>Optional (parents choose it)</Label>
            </div>
            <Button className="w-full" onClick={saveFee} disabled={saving}>{saving ? 'Saving…' : 'Save fee'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Who pays this fee?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fee</Label>
              <Select value={ruleForm.fee_id} onValueChange={v => setRuleForm({ ...ruleForm, fee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose fee" /></SelectTrigger>
                <SelectContent>{fees.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campus</Label>
              <Select value={ruleForm.campus_id} onValueChange={v => setRuleForm({ ...ruleForm, campus_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campuses</SelectItem>
                  {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={ruleForm.class_id} onValueChange={v => setRuleForm({ ...ruleForm, class_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student type</Label>
              <Select value={ruleForm.student_type} onValueChange={v => setRuleForm({ ...ruleForm, student_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  <SelectItem value="day">Day students</SelectItem>
                  <SelectItem value="boarding">Boarders</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Term</Label>
              <Select value={ruleForm.term} onValueChange={v => setRuleForm({ ...ruleForm, term: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every term</SelectItem>
                  {TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Academic year (optional)</Label><Input placeholder="2026/2027" value={ruleForm.academic_year} onChange={e => setRuleForm({ ...ruleForm, academic_year: e.target.value })} /></div>
            <Button className="w-full" onClick={saveRule} disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingRules;
