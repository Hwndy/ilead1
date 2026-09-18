// Official iVintage College letterhead, shared by every edge function that
// produces a PDF document or sends an email. The artwork is used exactly as
// supplied by the school — never redrawn, re-typed or recoloured.

const ASSET_BASE_URL = Deno.env.get("FRONTEND_URL")?.replace(/\/+$/, "") ||
  "https://ilead1.lovable.app";

export const LETTERHEAD_FULL_URL =
  `${ASSET_BASE_URL}/__l5e/assets-v1/63d1664b-4636-40b4-ba15-938fd07c6255/ivintage-letterhead-full.png`;
export const LETTERHEAD_CONTINUATION_URL =
  `${ASSET_BASE_URL}/__l5e/assets-v1/d2c405d0-7759-4aa6-a82a-f95db635f0d5/ivintage-letterhead-continuation.png`;
export const LETTERHEAD_HEADER_STRIP_URL =
  `${ASSET_BASE_URL}/__l5e/assets-v1/41870338-40ea-4941-8497-b1c5c35d82c7/ivintage-letterhead-header.png`;
export const LETTERHEAD_FOOTER_STRIP_URL =
  `${ASSET_BASE_URL}/__l5e/assets-v1/f20b0edd-2f42-4164-9c31-0c5d962f614c/ivintage-letterhead-footer.png`;

/** A4 safe area in mm for jsPDF documents drawn on the letterhead. */
export const LETTERHEAD_MARGINS = {
  top: 58,
  bottom: 42,
  left: 18,
  right: 18,
  continuationTop: 32,
};

const cache = new Map<string, string | null>();

/** Fetches a letterhead image once and caches it as a base64 data URL. */
export async function getLetterheadDataUrl(
  variant: "full" | "continuation" = "full",
): Promise<string | null> {
  const url = variant === "continuation"
    ? LETTERHEAD_CONTINUATION_URL
    : LETTERHEAD_FULL_URL;
  if (cache.has(url)) return cache.get(url) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("png")) throw new Error(`content-type ${type}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const dataUrl = `data:image/png;base64,${btoa(binary)}`;
    cache.set(url, dataUrl);
    return dataUrl;
  } catch (e) {
    console.error("Letterhead fetch failed:", e);
    cache.set(url, null);
    return null;
  }
}

/** Email header strip (top arc, crest and strapline) cut from the letterhead. */
export function emailLetterheadHeader(): string {
  return `
  <tr>
    <td style="padding:0;">
      <img src="${LETTERHEAD_HEADER_STRIP_URL}" width="600" alt="iVintage College"
           style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    </td>
  </tr>`;
}

/** Email footer strip (addresses, phone, website, email) cut from the letterhead. */
export function emailLetterheadFooter(): string {
  return `
  <tr>
    <td style="padding:0;">
      <img src="${LETTERHEAD_FOOTER_STRIP_URL}" width="600" alt="iVintage College contact details"
           style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    </td>
  </tr>`;
}

/** Wraps email body markup inside the official letterhead header and footer strips. */
export function wrapEmailInLetterhead(bodyHtml: string, title = "iVintage College"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#141C2B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:18px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:6px;overflow:hidden;">
        ${emailLetterheadHeader()}
        <tr><td style="padding:22px 28px 26px;font-size:15px;line-height:1.6;color:#141C2B;">${bodyHtml}</td></tr>
        ${emailLetterheadFooter()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
