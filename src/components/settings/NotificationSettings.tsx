import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  checkPushSubscription,
  requestNotificationPermission,
  sendLocalNotification 
} from '@/services/pushNotifications';
import { Bell, BellOff, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkStatus();
  }, [user]);

  const checkStatus = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check permission status
      if ('Notification' in window) {
        setPermissionStatus(Notification.permission);
      }

      // Check if subscribed
      const subscribed = await checkPushSubscription(user.id);
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Error checking notification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      if (isSubscribed) {
        const success = await unsubscribeFromPushNotifications(user.id);
        if (success) {
          setIsSubscribed(false);
          toast.success('Notifications disabled');
        } else {
          toast.error('Failed to disable notifications');
        }
      } else {
        const permission = await requestNotificationPermission();
        setPermissionStatus(permission);
        
        if (permission !== 'granted') {
          toast.error('Notification permission denied', {
            description: 'Please enable notifications in your browser settings',
          });
          return;
        }

        const success = await subscribeToPushNotifications(user.id, undefined);
        if (success) {
          setIsSubscribed(true);
          toast.success('Notifications enabled');
        } else {
          toast.error('Failed to enable notifications');
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = () => {
    sendLocalNotification('Test Notification', {
      body: 'This is a test notification from iVintageExam',
      tag: 'test',
    });
    toast.success('Test notification sent!');
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Allowed
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Blocked
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            Not Set
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications for exams, grades, and important updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Browser Permission</Label>
            <p className="text-sm text-muted-foreground">
              Allow notifications from this app
            </p>
          </div>
          {getPermissionBadge()}
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="push-toggle">Enable Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about new exams, results, and announcements
            </p>
          </div>
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            onCheckedChange={handleToggleNotifications}
            disabled={isLoading || permissionStatus === 'denied'}
          />
        </div>

        {permissionStatus === 'denied' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <BellOff className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Notifications are blocked</p>
              <p>To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site.</p>
            </div>
          </div>
        )}

        {isSubscribed && (
          <Button
            variant="outline"
            onClick={handleTestNotification}
            className="w-full"
          >
            Send Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
