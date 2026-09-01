import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Camera, LogIn, LogOut, User, UserPlus, ScanLine } from 'lucide-react';
import { useParams } from 'react-router-dom';

type Mode = 'student' | 'staff' | 'visitor';
type Direction = 'in' | 'out';

interface ScanResult {
  full_name: string;
  admission_number?: string;
  employee_id?: string;
  class_name?: string;
  designation?: string;
  photo_url?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  unknown_reference: 'No QR value provided',
  token_revoked: 'This card has been reissued  please reprint',
  student_not_found: 'No student matches this card or admission number',
  staff_not_found: 'No staff member matches this card or employee ID',
  not_authorized: 'Only authorized teachers and administrators can record scans',
  invalid_direction: 'Choose check-in or check-out and try again',
};
const humanizeError = (msg: string) => {
  const normalized = msg?.replace(/^.*?:\s*/, '').trim();
  return ERROR_MESSAGES[normalized] || ERROR_MESSAGES[msg?.trim()] || msg;
};

export const ScanStation: React.FC = () => {
  const { toast } = useToast();
  const { token } = useParams<{ token?: string }>();
  const [mode, setMode] = useState<Mode>('student');
  const [direction, setDirection] = useState<Direction>('in');
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [last, setLast] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<Array<ScanResult & { at: string; dir: Direction }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const busyRef = useRef(false);
  const routeTokenHandledRef = useRef(false);

  // Keyboard-wedge (USB QR/barcode scanner) support
  useEffect(() => {
    let buf = '';
    let lastKey = Date.now();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const now = Date.now();
      if (now - lastKey > 200) buf = '';
      lastKey = now;
      if (e.key === 'Enter') {
        if (buf.length >= 6) handleScan(buf);
        buf = '';
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, direction]);

  const startCamera = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) handleScan(result.getText());
      });
    } catch (err: any) {
      toast({ title: 'Camera error', description: err.message || 'Unable to open camera', variant: 'destructive' });
      setScanning(false);
    }
  };

  const stopCamera = () => {
    try {
      // @ts-ignore private but safe
      readerRef.current?.reset?.();
    } catch { /* ignore */ }
    readerRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const beep = (ok: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = ok ? 880 : 220;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch { /* ignore */ }
  };

  const handleScan = async (raw: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setTimeout(() => { busyRef.current = false; }, 1500);

    if (mode === 'student') {
      const { data, error } = await (supabase as any).rpc('record_scan_by_ref', {
        p_ref: raw, p_direction: direction,
      });
      if (error) {
        beep(false);
        toast({ title: 'Scan failed', description: humanizeError(error.message), variant: 'destructive' });
        return;
      }
      beep(true);
      const info = data as any;
      const result: ScanResult = {
        full_name: info.full_name,
        admission_number: info.admission_number,
        class_name: info.class_name,
        photo_url: info.photo_url,
      };
      setLast(result);
      setRecent(r => [{ ...result, at: new Date().toLocaleTimeString(), dir: direction }, ...r].slice(0, 8));
    } else if (mode === 'staff') {
      const { data, error } = await (supabase as any).rpc('record_staff_scan', {
        p_ref: raw,
        p_direction: direction,
      });
      if (error) {
        beep(false);
        toast({ title: 'Scan failed', description: humanizeError(error.message), variant: 'destructive' });
        return;
      }
      beep(true);
      const info = data as ScanResult;
      setLast(info);
      setRecent(r => [{ ...info, at: new Date().toLocaleTimeString(), dir: direction }, ...r].slice(0, 8));
      toast({
        title: `${info.full_name || 'Staff'} checked ${direction}`,
        description: info.employee_id || info.designation || undefined,
      });
    }
  };

  useEffect(() => {
    if (!token || routeTokenHandledRef.current) return;
    routeTokenHandledRef.current = true;
    handleScan(token);
    // The route token must be recorded once only; direction defaults to check-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> ID Scan Station</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => { stopCamera(); setMode(v as Mode); }}>
            <TabsList>
              <TabsTrigger value="student">Students</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="visitor">Visitors</TabsTrigger>
            </TabsList>

            <div className="mt-4 flex gap-2">
              <Button variant={direction === 'in' ? 'default' : 'outline'} onClick={() => setDirection('in')}>
                <LogIn className="h-4 w-4 mr-1" /> Check-in
              </Button>
              <Button variant={direction === 'out' ? 'default' : 'outline'} onClick={() => setDirection('out')}>
                <LogOut className="h-4 w-4 mr-1" /> Check-out
              </Button>
            </div>

            <TabsContent value="student" className="mt-4 space-y-4">
              <CameraPanel scanning={scanning} onStart={startCamera} onStop={stopCamera} videoRef={videoRef} />
              <ManualEntry manual={manual} setManual={setManual} onSubmit={() => { if (manual) { handleScan(manual); setManual(''); } }} />
            </TabsContent>

            <TabsContent value="staff" className="mt-4 space-y-4">
              <CameraPanel scanning={scanning} onStart={startCamera} onStop={stopCamera} videoRef={videoRef} />
              <ManualEntry manual={manual} setManual={setManual} onSubmit={() => { if (manual) { handleScan(manual); setManual(''); } }} label="Manual entry (scan card or type employee ID)" placeholder="Scan card or enter employee ID" />
            </TabsContent>

            <TabsContent value="visitor" className="mt-4">
              <VisitorPanel onDone={() => beep(true)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {last && mode !== 'visitor' && (
        <Card>
          <CardHeader><CardTitle>Last scan</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {last.photo_url ? <img src={last.photo_url} className="w-full h-full object-cover" /> : <User className="h-8 w-8 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-xl font-bold">{last.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {mode === 'student'
                  ? `${last.admission_number || 'No registration number'} • ${last.class_name || 'No class'}`
                  : `${last.employee_id || 'No employee ID'} • ${last.designation || 'Staff'}`}
              </p>
              <p className="text-sm text-primary font-medium">{direction === 'in' ? 'Checked in' : 'Checked out'} at {new Date().toLocaleTimeString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent scans</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{r.full_name}</span>
                   <span className="text-muted-foreground">{r.class_name || r.designation || r.employee_id} • {r.dir} • {r.at}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const CameraPanel: React.FC<{ scanning: boolean; onStart: () => void; onStop: () => void; videoRef: React.RefObject<HTMLVideoElement>; }> = ({ scanning, onStart, onStop, videoRef }) => (
  <div>
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-w-lg">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {!scanning && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Camera className="h-10 w-10" />
        </div>
      )}
    </div>
    <div className="mt-2 flex gap-2">
      {!scanning ? (
        <Button onClick={onStart}><Camera className="h-4 w-4 mr-1" /> Start camera</Button>
      ) : (
        <Button variant="outline" onClick={onStop}>Stop camera</Button>
      )}
    </div>
  </div>
);

const ManualEntry: React.FC<{ manual: string; setManual: (v: string) => void; onSubmit: () => void; label?: string; placeholder?: string }> = ({ manual, setManual, onSubmit, label = 'Manual entry (paste token/URL or type admission #)', placeholder = 'Paste QR value or token' }) => (
  <div className="max-w-md">
    <Label>{label}</Label>
    <div className="flex gap-2 mt-1">
      <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && onSubmit()} />
      <Button onClick={onSubmit}>Submit</Button>
    </div>
  </div>
);

const VisitorPanel: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '', purpose: '', host_name: '' });
  const [openVisitors, setOpenVisitors] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('visitor_logs').select('*').is('signed_out_at', null).order('signed_in_at', { ascending: false }).limit(20);
    setOpenVisitors(data || []);
  };
  useEffect(() => { load(); }, []);

  const signIn = async () => {
    if (!form.full_name) return toast({ title: 'Name required', variant: 'destructive' });
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('visitor_logs').insert({
      ...form,
      badge_no: `V-${Date.now().toString().slice(-6)}`,
      signed_in_by: user.user?.id,
    } as any);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Visitor signed in' });
    setForm({ full_name: '', phone: '', purpose: '', host_name: '' });
    onDone();
    load();
  };

  const signOut = async (id: string) => {
    const { error } = await supabase.from('visitor_logs').update({ signed_out_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Visitor signed out' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
        <div><Label>Host (staff name)</Label><Input value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} /></div>
      </div>
      <Button onClick={signIn}><LogIn className="h-4 w-4 mr-1" /> Sign in & issue badge</Button>

      <div>
        <h3 className="font-semibold mb-2">On premises ({openVisitors.length})</h3>
        <div className="divide-y">
          {openVisitors.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{v.full_name} <span className="text-muted-foreground">({v.badge_no})</span></p>
                <p className="text-xs text-muted-foreground">{v.purpose} • host: {v.host_name || ''} • in: {new Date(v.signed_in_at).toLocaleTimeString()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => signOut(v.id)}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
            </div>
          ))}
          {openVisitors.length === 0 && <p className="text-sm text-muted-foreground">No visitors currently on premises.</p>}
        </div>
      </div>
    </div>
  );
};

export default ScanStation;