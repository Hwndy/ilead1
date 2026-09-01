import React, { useEffect, useState } from 'react';
import { usePWAContext } from '@/contexts/PWAContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const UpdateAvailable: React.FC = () => {
  const { isUpdateAvailable, updateApp } = usePWAContext();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable && !shown) {
      setShown(true);
      toast('Update Available', {
        description: 'A new version of iVintageExam is available',
        duration: Infinity,
        action: {
          label: 'Update Now',
          onClick: () => {
            updateApp();
          },
        },
        icon: <RefreshCw className="h-4 w-4" />,
      });
    }
  }, [isUpdateAvailable, updateApp, shown]);

  if (!isUpdateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom duration-300">
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="font-medium">Update Available.</p>
            <p className="text-sm text-muted-foreground">
              Refresh to get the latest version
            </p>
          </div>
          <Button size="sm" onClick={updateApp}>
            Update
          </Button>
        </div>
      </div>
    </div>
  );
};
