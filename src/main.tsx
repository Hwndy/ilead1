import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import App from "./App.tsx";
import "./index.css";

// Register the service worker and keep the app on the newest version automatically.
if ('serviceWorker' in navigator) {
  let reloading = false;

  // Don't interrupt someone in the middle of typing or an exam.
  const isBusy = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
    if (el?.isContentEditable) return true;
    if (document.querySelector('[data-exam-active="true"]')) return true;
    return false;
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        const applyWaiting = () => {
          if (registration.waiting && !isBusy()) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) applyWaiting();
          });
        });

        const check = () => {
          registration.update().catch(() => undefined);
          applyWaiting();
        };

        check();
        setInterval(check, 15 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        window.addEventListener('online', check);
        window.addEventListener('focus', check);
      })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
