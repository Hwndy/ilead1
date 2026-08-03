import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePWAContext } from '@/contexts/PWAContext';
import { Download, X, Smartphone, Monitor, Share } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, installApp } = usePWAContext();
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('pwa-install-dismissed');
      } else {
        setDismissed(true);
      }
    }

    // Show banner after 3 seconds if installable
    const timer = setTimeout(() => {
      if ((isInstallable || isIOS) && !isInstalled && !dismissed) {
        setShowBanner(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, dismissed, isIOS]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      const success = await installApp();
      if (success) {
        setShowBanner(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || dismissed || !showBanner) return null;

  return (
    <>
      {/* Mobile Banner */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
          <Card className="bg-primary text-primary-foreground shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-10 w-10 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Install iVintageExam</p>
                  <p className="text-sm opacity-90 truncate">
                    Get quick access from your home screen
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDismiss}
                    className="px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleInstall}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Install
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop Banner */}
      {!isMobile && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <Card className="w-80 shadow-lg border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Monitor className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Install iVintageExam</p>
                  <p className="text-sm text-muted-foreground">
                    Install for faster access and offline support
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={handleDismiss}>
                      Later
                    </Button>
                    <Button size="sm" onClick={handleInstall} className="gap-1">
                      <Download className="h-4 w-4" />
                      Install
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* iOS Install Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install on iOS</DialogTitle>
            <DialogDescription>
              Follow these steps to add iVintageExam to your home screen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div className="flex items-center gap-2">
                <span>Tap the</span>
                <Share className="h-5 w-5" />
                <span>Share button</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <span>Scroll down and tap "Add to Home Screen"</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              <span>Tap "Add" in the top right corner</span>
            </div>
          </div>
          <Button onClick={() => setShowIOSModal(false)} className="w-full">
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
