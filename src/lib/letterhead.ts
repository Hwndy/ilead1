// Official iVintage College letterhead.
// The artwork is used exactly as supplied by the school (converted from the
// original .docx at print resolution). Nothing is redrawn or re-typed —
// documents simply typeset their content inside the clear safe area.

import fullAsset from '@/assets/ivintage-letterhead-full.png.asset.json';
import continuationAsset from '@/assets/ivintage-letterhead-continuation.png.asset.json';
import headerAsset from '@/assets/ivintage-letterhead-header.png.asset.json';
import footerAsset from '@/assets/ivintage-letterhead-footer.png.asset.json';

export const LETTERHEAD_FULL_URL = fullAsset.url;
export const LETTERHEAD_CONTINUATION_URL = continuationAsset.url;
export const LETTERHEAD_HEADER_STRIP_URL = headerAsset.url;
export const LETTERHEAD_FOOTER_STRIP_URL = footerAsset.url;

/** A4 safe area (mm) — content must stay clear of the arcs and the address block. */
export const LETTERHEAD_MARGINS = {
  top: 58,
  bottom: 42,
  left: 18,
  right: 18,
  /** Top margin on continuation pages (no address block repeated). */
  continuationTop: 32,
};

export function letterheadAbsoluteUrl(url: string): string {
  if (/^https?:/i.test(url)) return url;
  if (typeof window !== 'undefined') return `${window.location.origin}${url}`;
  return url;
}

type LoadedImage = { dataUrl: string; format: 'PNG' };

const imageCache = new Map<string, LoadedImage | null>();

async function loadLetterheadImage(url: string): Promise<LoadedImage | null> {
  const key = url;
  if (imageCache.has(key)) return imageCache.get(key) || null;
  try {
    const res = await fetch(letterheadAbsoluteUrl(url));
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const loaded: LoadedImage = { dataUrl, format: 'PNG' };
    imageCache.set(key, loaded);
    return loaded;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

/**
 * Paints the official letterhead across the full current page of a jsPDF (A4) doc.
 * Returns true when the artwork was drawn.
 */
export async function drawLetterhead(
  doc: { internal: any; addImage: (...args: any[]) => void },
  variant: 'full' | 'continuation' = 'full',
): Promise<boolean> {
  const img = await loadLetterheadImage(
    variant === 'continuation' ? LETTERHEAD_CONTINUATION_URL : LETTERHEAD_FULL_URL,
  );
  if (!img) return false;
  try {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.addImage(img.dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST');
    return true;
  } catch {
    return false;
  }
}

/**
 * Print CSS that puts the official letterhead behind every printed page and
 * keeps content inside the safe area. Pair with `letterheadBackgroundMarkup()`.
 */
export function letterheadPageCss(): string {
  const m = LETTERHEAD_MARGINS;
  return `
    @page { size: A4 portrait; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
    html, body { background: #fff; }
    .lh-page-bg {
      position: fixed;
      top: -${m.top}mm; left: -${m.left}mm;
      width: 210mm; height: 297mm;
      z-index: 0;
      pointer-events: none;
    }
    .lh-page-bg img { width: 210mm; height: 297mm; display: block; }
    .lh-body { position: relative; z-index: 1; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  `;
}

export function letterheadBackgroundMarkup(className = 'lh-page-bg'): string {
  return `<div class="${className}"><img src="${letterheadAbsoluteUrl(LETTERHEAD_FULL_URL)}" alt="" /></div>`;
}
