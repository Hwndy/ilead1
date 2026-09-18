/**
 * Live preview bridge between the admin website editor and the public site
 * rendered inside an iframe. The iframe is loaded with `?cms_preview=1`; the
 * editor posts unsaved values to it, and the CMS hooks merge them on top of
 * the saved settings so the admin sees changes as they type.
 */

export const CMS_PREVIEW_PARAM = 'cms_preview';
export const CMS_DRAFT_MESSAGE = 'ivintage-cms-draft';

type Draft = Record<string, any>;

let draft: Draft | null = null;
const listeners = new Set<() => void>();

export function isCmsPreview(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(CMS_PREVIEW_PARAM);
}

if (typeof window !== 'undefined' && isCmsPreview()) {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; settings?: Draft };
    if (data?.type !== CMS_DRAFT_MESSAGE) return;
    draft = data.settings ?? {};
    listeners.forEach((listener) => listener());
  });
  // Tell the editor we are ready for the first draft payload.
  window.parent?.postMessage({ type: `${CMS_DRAFT_MESSAGE}-ready` }, window.location.origin);
}

export function subscribeToDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDraft(): Draft | null {
  return draft;
}

export function getServerDraft(): Draft | null {
  return null;
}

export function sendDraft(frame: HTMLIFrameElement | null, settings: Draft) {
  frame?.contentWindow?.postMessage(
    { type: CMS_DRAFT_MESSAGE, settings },
    window.location.origin,
  );
}
