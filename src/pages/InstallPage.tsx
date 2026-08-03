import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePWAContext } from '@/contexts/PWAContext';
import { Logo } from '@/components/shared/Logo';
import { 
  Download, Smartphone, Monitor, Share, CheckCircle,
  Wifi, WifiOff, Bell, Zap, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const InstallPage: React.FC = () => {
  const { isInstallable, isInstalled, installApp } = usePWAContext();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  const handleInstall = async () => {
    if (!isIOS) {
      await installApp();
    }
  };

  const benefits = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Instant loading with cached resources',
    },
    {
      icon: WifiOff,
      title: 'Works Offline',
      description: 'Access your exams even without internet',
    },
    {
      icon: Bell,
      title: 'Push Notifications',
      description: 'Get notified about exams and results',
    },
    {
      icon: Shield,
      title: 'Secure',
      description: 'Your data is encrypted and protected',
    },
  ];

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">App Installed!</h1>
            <p className="text-muted-foreground">
              iVintageExam is already installed on your device. Open it from your home screen for the best experience.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo size="lg" className="justify-center mb-4" />
          <h1 className="text-3xl font-bold mb-2">Install iVintageExam</h1>
          <p className="text-muted-foreground">
            Get the best experience with our installable app
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {benefits.map((benefit, index) => (
            <Card key={index} className="text-center p-4">
              <benefit.icon className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-semibold text-sm">{benefit.title}</h3>
              <p className="text-xs text-muted-foreground">{benefit.description}</p>
            </Card>
          ))}
        </div>

        {/* Install Instructions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              Installation Instructions
            </CardTitle>
            <CardDescription>
              {isIOS 
                ? 'Follow these steps to install on iOS'
                : isAndroid 
                  ? 'Tap the button below to install'
                  : 'Click the button below or follow the manual steps'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isIOS ? (
              // iOS Instructions
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Look for the <Share className="h-4 w-4" /> icon at the bottom of Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                    <p className="text-sm text-muted-foreground">
                      You may need to scroll down in the share menu
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Tap "Add"</p>
                    <p className="text-sm text-muted-foreground">
                      Confirm by tapping Add in the top right corner
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Android / Desktop
              <div className="space-y-4">
                {isInstallable ? (
                  <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                    <Download className="h-5 w-5" />
                    Install iVintageExam
                  </Button>
                ) : (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-muted-foreground">
                      Your browser doesn't support app installation, or the app is already installed.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or install manually
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold flex-shrink-0">
                      1
                    </div>
                    <p>Click the menu icon (⋮) in your browser</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold flex-shrink-0">
                      2
                    </div>
                    <p>Select "Install app" or "Add to Home screen"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold flex-shrink-0">
                      3
                    </div>
                    <p>Confirm the installation</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continue to App */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Don't want to install? You can still use the web version
          </p>
          <Button variant="outline" asChild>
            <Link to="/login">Continue to Web App</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstallPage;
