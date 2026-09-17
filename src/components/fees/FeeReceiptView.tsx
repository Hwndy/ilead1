import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download } from 'lucide-react';
import { fetchSchoolBranding, SchoolBranding, DEFAULT_SCHOOL_BRANDING } from '@/lib/school-branding';
import { buildBrandedReceipt, ReceiptField } from '@/lib/receipt-pdf';

export interface FeeReceiptData {
  title?: string;
  receiptNumber?: string | null;
  date?: string | null;
  fields: ReceiptField[];
  amountLabel?: string;
  amount: number;
  footerNote?: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

/**
 * The single branded receipt presentation. The same data object drives the
 * on-screen preview, the printed copy and the downloaded PDF, so all three
 * always match.
 */
export const FeeReceiptView: React.FC<{ data: FeeReceiptData; actions?: boolean }> = ({ data, actions = true }) => {
  const [school, setSchool] = useState<SchoolBranding>(DEFAULT_SCHOOL_BRANDING);
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);

  useEffect(() => { fetchSchoolBranding().then(setSchool).catch(() => undefined); }, []);

  const withDoc = async (action: 'print' | 'download') => {
    setBusy(action);
    try {
      const doc = await buildBrandedReceipt(data, school);
      if (action === 'download') {
        doc.save(`receipt-${data.receiptNumber || Date.now()}.pdf`);
      } else {
        doc.autoPrint();
        const url = doc.output('bloburl');
        window.open(url as unknown as string, '_blank');
      }
    } finally {
      setBusy(null);
    }
  };

  const rows = data.fields.filter(f => f.value);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden bg-card">
        <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
          {school.logo_url && <img src={school.logo_url} alt="" className="h-12 w-12 object-contain bg-background rounded p-1" />}
          <div className="min-w-0">
            <p className="font-bold uppercase leading-tight truncate">{school.name}</p>
            {school.address && <p className="text-xs opacity-90 truncate">{school.address}</p>}
            {(school.phone || school.email) && (
              <p className="text-xs opacity-90 truncate">{[school.phone && `Tel: ${school.phone}`, school.email].filter(Boolean).join('  |  ')}</p>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center font-semibold tracking-wide border-b pb-2">{data.title || 'PAYMENT RECEIPT'}</div>

          <div className="flex justify-between text-sm">
            <span>Receipt No: <span className="font-semibold font-mono">{data.receiptNumber || ''}</span></span>
            <span>Date: <span className="font-semibold">{data.date || new Date().toLocaleDateString()}</span></span>
          </div>

          <div className="rounded-md bg-muted/50 divide-y">
            {rows.map(f => (
              <div key={f.label} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-right">{f.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-primary/10 text-primary flex items-center justify-between px-4 py-3">
            <span className="font-semibold">{data.amountLabel || 'Amount Paid'}</span>
            <span className="text-lg font-bold">{money(data.amount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8 text-xs text-muted-foreground">
            <div className="border-t pt-1">{school.principal_name || 'Authorised Signature'}</div>
            <div className="border-t pt-1 text-right">School Stamp</div>
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => withDoc('print')} disabled={busy !== null}>
            {busy === 'print' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}Print
          </Button>
          <Button onClick={() => withDoc('download')} disabled={busy !== null}>
            {busy === 'download' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Download PDF
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeeReceiptView;
