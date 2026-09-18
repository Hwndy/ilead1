import jsPDF from 'jspdf';
import { fetchSchoolBranding, SchoolBranding } from '@/lib/school-branding';
import { drawLetterhead, LETTERHEAD_MARGINS } from '@/lib/letterhead';

export interface ReceiptField {
  label: string;
  value?: string | null;
}

export interface ReceiptData {
  title?: string;              // e.g. "FEE PAYMENT RECEIPT"
  receiptNumber?: string | null;
  date?: string | null;        // pre-formatted
  fields: ReceiptField[];      // student / fee details
  amountLabel?: string;
  amount: number;
  footerNote?: string;
}

const money = (n: number) =>
  'NGN ' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);

async function loadImage(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

/** Builds a receipt on the official iVintage letterhead (artwork used exactly as supplied). */
export async function buildBrandedReceipt(data: ReceiptData, brandingOverride?: SchoolBranding): Promise<jsPDF> {
  const school = brandingOverride || (await fetchSchoolBranding());
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // --- Official letterhead ------------------------------------------------
  const painted = await drawLetterhead(doc, 'full');
  const left = LETTERHEAD_MARGINS.left;
  const right = w - LETTERHEAD_MARGINS.right;
  let top = painted ? LETTERHEAD_MARGINS.top : 24;

  if (!painted) {
    // Fallback only if the letterhead artwork cannot be fetched.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 28, 43);
    doc.text(school.name.toUpperCase(), w / 2, 18, { align: 'center' });
  }

  // --- Title -------------------------------------------------------------
  doc.setTextColor(20, 28, 43);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(data.title || 'PAYMENT RECEIPT', w / 2, top, { align: 'center' });
  doc.setDrawColor(198, 217, 45);
  doc.setLineWidth(1);
  doc.line(w / 2 - 30, top + 3, w / 2 + 30, top + 3);

  // --- Meta row ----------------------------------------------------------
  let y = top + 14;
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt No:', left, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.receiptNumber || '', left + 26, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Date:', w / 2 + 20, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.date || new Date().toLocaleDateString(), w / 2 + 35, y);

  // --- Details box -------------------------------------------------------
  const rows = data.fields.filter(f => f.value);
  const boxTop = y + 8;
  const boxHeight = Math.max(30, rows.length * 9 + 10);
  doc.setDrawColor(200, 208, 204);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, boxTop, right - left, boxHeight, 2, 2);

  let ry = boxTop + 11;
  rows.forEach(f => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 96, 94);
    doc.text(f.label, left + 6, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(f.value), right - 6, ry, { align: 'right' });
    ry += 9;
  });

  // --- Amount band -------------------------------------------------------
  const amtY = boxTop + boxHeight + 10;
  doc.setFillColor(244, 248, 219);
  doc.roundedRect(left, amtY, right - left, 18, 2, 2, 'F');
  doc.setTextColor(20, 28, 43);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.amountLabel || 'Amount Paid', left + 6, amtY + 12);
  doc.setFontSize(15);
  doc.text(money(data.amount), right - 6, amtY + 12, { align: 'right' });

  // --- Signatures --------------------------------------------------------
  const maxY = pageH - LETTERHEAD_MARGINS.bottom - 12;
  const sigY = Math.min(amtY + 45, maxY);
  doc.setTextColor(20, 20, 20);
  doc.setLineWidth(0.3);
  doc.setDrawColor(120, 120, 120);
  doc.line(left + 4, sigY, left + 65, sigY);
  doc.line(right - 65, sigY, right - 4, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(school.principal_name ? school.principal_name : 'Authorised Signature', left + 4, sigY + 5);
  if (school.principal_name) doc.text('Principal', left + 4, sigY + 10);
  doc.text('School Stamp', right - 65, sigY + 5);

  // --- Note (kept above the letterhead footer artwork) --------------------
  doc.setFontSize(8);
  doc.setTextColor(110, 116, 120);
  doc.text(
    data.footerNote || 'This is a computer-generated receipt and is valid without a signature.',
    w / 2,
    pageH - LETTERHEAD_MARGINS.bottom - 2,
    { align: 'center' }
  );

  return doc;
}
