import jsPDF from 'jspdf';
import { fetchSchoolBranding, SchoolBranding } from '@/lib/school-branding';

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

/** Builds a school-branded A4 receipt (logo, name, address, contacts, motto, stamp lines). */
export async function buildBrandedReceipt(data: ReceiptData, brandingOverride?: SchoolBranding): Promise<jsPDF> {
  const school = brandingOverride || (await fetchSchoolBranding());
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  // --- Header band -------------------------------------------------------
  doc.setFillColor(16, 78, 58);
  doc.rect(0, 0, w, 34, 'F');

  const logo = school.logo_url ? await loadImage(school.logo_url) : null;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, 12, 5, 24, 24);
    } catch { /* ignore unsupported image */ }
  }

  const textLeft = logo ? 42 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(school.name.toUpperCase(), textLeft, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let hy = 19;
  if (school.address) { doc.text(school.address, textLeft, hy); hy += 5; }
  const contact = [school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`]
    .filter(Boolean).join('   |   ');
  if (contact) { doc.text(contact, textLeft, hy); hy += 5; }
  if (school.motto) {
    doc.setFont('helvetica', 'italic');
    doc.text(`"${school.motto}"`, textLeft, hy);
  }

  // --- Title -------------------------------------------------------------
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(data.title || 'PAYMENT RECEIPT', w / 2, 46, { align: 'center' });
  doc.setDrawColor(16, 78, 58);
  doc.setLineWidth(0.8);
  doc.line(14, 50, w - 14, 50);

  // --- Watermark ---------------------------------------------------------
  if (logo) {
    try {
      const gs: any = (doc as any).GState && new (doc as any).GState({ opacity: 0.06 });
      if (gs) (doc as any).setGState(gs);
      doc.addImage(logo.dataUrl, logo.format, w / 2 - 45, 110, 90, 90);
      const solid: any = (doc as any).GState && new (doc as any).GState({ opacity: 1 });
      if (solid) (doc as any).setGState(solid);
    } catch { /* ignore */ }
  }

  // --- Meta row ----------------------------------------------------------
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt No:', 14, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(data.receiptNumber || '', 40, 60);
  doc.setFont('helvetica', 'normal');
  doc.text('Date:', w / 2 + 20, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(data.date || new Date().toLocaleDateString(), w / 2 + 35, 60);

  // --- Details box -------------------------------------------------------
  const rows = data.fields.filter(f => f.value);
  const boxTop = 68;
  const boxHeight = Math.max(30, rows.length * 9 + 10);
  doc.setDrawColor(200, 208, 204);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, boxTop, w - 28, boxHeight, 2, 2);

  let y = boxTop + 11;
  rows.forEach(f => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 96, 94);
    doc.text(f.label, 20, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(f.value), w - 20, y, { align: 'right' });
    y += 9;
  });

  // --- Amount band -------------------------------------------------------
  const amtY = boxTop + boxHeight + 10;
  doc.setFillColor(232, 243, 238);
  doc.roundedRect(14, amtY, w - 28, 18, 2, 2, 'F');
  doc.setTextColor(16, 78, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.amountLabel || 'Amount Paid', 20, amtY + 12);
  doc.setFontSize(15);
  doc.text(money(data.amount), w - 20, amtY + 12, { align: 'right' });

  // --- Signatures --------------------------------------------------------
  const sigY = amtY + 50;
  doc.setTextColor(20, 20, 20);
  doc.setLineWidth(0.3);
  doc.setDrawColor(120, 120, 120);
  doc.line(20, sigY, 85, sigY);
  doc.line(w - 85, sigY, w - 20, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(school.principal_name ? school.principal_name : 'Authorised Signature', 20, sigY + 5);
  if (school.principal_name) doc.text('Principal', 20, sigY + 10);
  doc.text('School Stamp', w - 85, sigY + 5);

  // --- Footer ------------------------------------------------------------
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(16, 78, 58);
  doc.rect(0, pageH - 16, w, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(
    data.footerNote || `${school.name}  this is a computer-generated receipt and is valid without a signature.`,
    w / 2,
    pageH - 6,
    { align: 'center' }
  );

  return doc;
}
