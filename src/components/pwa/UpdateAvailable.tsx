import React, { useEffect, useRef, useState } from 'react';
import { usePWAContext } from '@/contexts/PWAContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const isBusy = () => {
  const el = document.activeElement as HTMLElement | null;
  if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  if (el?.isContentEditable) return true;
  return !!document.querySelector('[data-exam-active="true"]');
};

export const UpdateAvailable: React.FC = () => {
  const { isUpdateAvailable, updateApp } = usePWAContext();
  const [shown, setShown] = useState(false);
  const timer = useRef<number | null>(null);

  // Apply new versions automatically, waiting until the person isn't mid-typing.
  useEffect(() => {
    if (!isUpdateAvailable) return;
    if (!shown) {
      setShown(true);
      toast('Updating to the latest version…', { duration: 4000, icon: <RefreshCw className="h-4 w-4" /> });
    }
    timer.current = window.setInterval(() => {
      if (!isBusy()) updateApp();
    }, 3000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [isUpdateAvailable, updateApp, shown]);

  if (!isUpdateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom duration-300">
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="font-medium">New version ready</p>
            <p className="text-sm text-muted-foreground">It will apply automatically in a moment.</p>
          </div>
          <Button size="sm" onClick={updateApp}>Update now</Button>
        </div>
      </div>
    </div>
  );
};
