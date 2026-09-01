import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { StaffIDCard, StaffIDCardData, StaffIDCardSchool } from './StaffIDCard';
import { useToast } from '@/hooks/use-toast';
import { fetchSchoolBranding } from '@/lib/school-branding';
import { Loader2, Download, Search, IdCard, Printer, BadgeCheck } from 'lucide-react';

interface Row {
  user_id: string;
  employee_id: string | null;
  designation: string | null;
  department: string | null;
  date_of_joining: string | null;
  blood_group: string | null;
  full_name: string;
  phone: string | null;
  photo_url: string | null;
}

export const StaffIDCardGenerator: React.FC = () => {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [school, setSchool] = useState<StaffIDCardSchool>({ name: 'iVintage College' });
  const [downloading, setDownloading] = useState(false);
  const [batching, setBatching] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [staffRes, branding] = await Promise.all([
        supabase
          .from('staff_details')
          .select('user_id, employee_id, designation, department, join_date, blood_group, phone, photo_url')
          .order('employee_id', { nullsFirst: false }),
        fetchSchoolBranding(),
      ]);
      if (staffRes.error) throw staffRes.error;
      const list = (staffRes.data as any[]) || [];
      const userIds = list.map((s: any) => s.user_id).filter(Boolean);
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
        : { data: [] as any };
      const nameMap = new Map<string, string>(((profs as any[]) || []).map((p: any) => [p.user_id, p.full_name]));
      setRows(
        list.map((s: any) => ({
          user_id: s.user_id,
          employee_id: s.employee_id,
          designation: s.designation,
          department: s.department,
          date_of_joining: s.join_date,
          blood_group: s.blood_group,
          phone: s.phone,
          full_name: nameMap.get(s.user_id) || '',
          photo_url: s.photo_url,
        })),
      );
      setSchool({
        name: branding.name,
        address: branding.address,
        phone: branding.phone,
        logo_url: branding.logo_url,
        motto: branding.motto,
      });
    } catch (e: any) {
      toast({ title: 'Failed to load staff', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    !q.trim() ||
    (r.full_name?.toLowerCase().includes(q.toLowerCase())) ||
    (r.employee_id?.toLowerCase().includes(q.toLowerCase())) ||
    (r.designation?.toLowerCase().includes(q.toLowerCase())),
  );

  const staffCard: StaffIDCardData | null = selected && {
    user_id: selected.user_id,
    full_name: selected.full_name,
    employee_id: selected.employee_id,
    designation: selected.designation,
    department: selected.department,
    date_of_joining: selected.date_of_joining,
    blood_group: selected.blood_group,
    phone: selected.phone,
    photo_url: selected.photo_url,
  };

  const download = async () => {
    const el = document.getElementById('staff-id-card');
    if (!el || !selected) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `${selected.full_name.replace(/\s+/g, '_')}_ID.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const toggle = (id: string) =>
    setChecked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const toggleAll = () => {
    const ids = filtered.map(r => r.user_id);
    setChecked(prev => (ids.every(i => prev.includes(i)) ? prev.filter(i => !ids.includes(i)) : [...new Set([...prev, ...ids])]));
  };

  /** Issue employee IDs to every selected staff member who does not have one. */
  const issueEmployeeIds = async () => {
    const targets = rows.filter(r => checked.includes(r.user_id) && !r.employee_id);
    if (!targets.length) { toast({ title: 'Nothing to issue', description: 'Selected staff already have employee IDs.' }); return; }
    setIssuing(true);
    try {
      for (const t of targets) {
        const { data, error } = await (supabase as any).rpc('next_employee_id');
        if (error) throw error;
        const { error: upErr } = await supabase.from('staff_details').update({ employee_id: data }).eq('user_id', t.user_id);
        if (upErr) throw upErr;
      }
      toast({ title: `Issued ${targets.length} employee ID(s)` });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not issue IDs', description: e.message, variant: 'destructive' });
    } finally {
      setIssuing(false);
    }
  };

  /** Batch-print selected staff cards onto A4 (4 per page, 54 x 90.75mm). */
  const printBatch = async () => {
    const targets = rows.filter(r => checked.includes(r.user_id));
    if (!targets.length) { toast({ title: 'Select staff first', variant: 'destructive' }); return; }
    setBatching(true);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cardW = 54, cardH = 90.75, margin = 10, gap = 5, perPage = 4;
    try {
      for (let i = 0; i < targets.length; i++) {
        setSelected(targets[i]);
        await new Promise(r => setTimeout(r, 250));
        const el = cardRef.current;
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
        if (i > 0 && i % perPage === 0) pdf.addPage();
        const pos = i % perPage;
        const x = margin + (pos % 2) * (cardW + gap);
        const y = margin + Math.floor(pos / 2) * (cardH + gap);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, cardW, cardH);
      }
      pdf.save(`Staff_ID_Cards_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: `Generated ${targets.length} staff card(s)` });
    } catch (e: any) {
      toast({ title: 'Batch failed', description: e.message, variant: 'destructive' });
    } finally {
      setBatching(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2"><IdCard className="h-5 w-5" /> Staff ID Cards</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={issueEmployeeIds} disabled={issuing || !checked.length}>
              {issuing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-1" />}
              Issue employee IDs
            </Button>
            <Button size="sm" onClick={printBatch} disabled={batching || !checked.length}>
              {batching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
              Print selected ({checked.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, ID, role…" className="pl-8" />
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every(r => checked.includes(r.user_id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No staff found. Add staff in Staff Management first.</TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.user_id} className={selected?.user_id === r.user_id ? 'bg-accent' : ''}>
                      <TableCell>
                        <Checkbox checked={checked.includes(r.user_id)} onCheckedChange={() => toggle(r.user_id)} />
                      </TableCell>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{r.employee_id || ''}</TableCell>
                      <TableCell>{r.designation || ''}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Preview</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Preview</CardTitle>
          {staffCard && (
            <Button size="sm" onClick={download} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} PNG
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {staffCard ? (
            <div ref={cardRef}>
              <StaffIDCard staff={staffCard} school={school} />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-16">Select a staff member to preview their ID card.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffIDCardGenerator;