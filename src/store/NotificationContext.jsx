import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppContext } from './AppContext';
import { api } from '../services/api';

export const NotificationContext = createContext();

// Replace with your actual VAPID public key once generated from Supabase
const VAPID_PUBLIC_KEY = 'BIg-I-5TEqEy_5_YtXu3ZTlaM5kXhLEsYgJw6SC2mwfOkdNHwHSyrJ39PQVSklB4EFYEsLsorB_iSKiTo3zZYCA';

/**
 * Safely check if the Notification API is available in the current context.
 * Returns false in insecure contexts, some mobile browsers, Firefox private mode, etc.
 */
function isNotificationApiAvailable() {
  try {
    return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Safely get the current Notification permission state.
 * Returns 'denied' if the API is unavailable to prevent showing the prompt.
 */
function getNotificationPermission() {
  if (!isNotificationApiAvailable()) return 'denied';
  try {
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider = ({ children }) => {
  const { userId, role } = useContext(AppContext);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState(() => getNotificationPermission());

  useEffect(() => {
    // Check all prerequisites: service worker, push manager, and notification API
    const supported = 'serviceWorker' in navigator 
      && 'PushManager' in window 
      && isNotificationApiAvailable();
    setPushSupported(supported);
    
    // Sync permission state on mount (in case it changed externally)
    setPushPermission(getNotificationPermission());
  }, []);

  // Fetch initial notifications when user logs in and when role changes
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        // Query notifications filtered by both user_id and target role
        const { data } = await api.supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('role', role)
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (data) {
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();

    // Subscribe to realtime updates for this user
    let sub;
    try {
      sub = api.supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            // Client-side role matching check
            if (payload.new.role === role) {
              setNotifications(prev => [payload.new, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            if (payload.new.role === role) {
              setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Failed to subscribe to notification channel:', err);
    }

    return () => {
      if (sub) {
        try { api.supabase.removeChannel(sub); } catch (e) { /* ignore */ }
      }
    };
  }, [userId, role]);

  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    
    try {
      await api.supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    
    if (userId) {
      try {
        await api.supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('role', role)
          .eq('is_read', false);
      } catch (err) {
        console.error('Failed to mark all notifications as read:', err);
      }
    }
  }, [userId, role]);

  const subscribeToPush = useCallback(async () => {
    // Check API availability first
    if (!isNotificationApiAvailable()) {
      console.warn('Notification API is not available in this context (insecure origin or unsupported browser).');
      return false;
    }

    if (!pushSupported) {
      console.warn('Push notifications are not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission !== 'granted') return false;

      // If user isn't logged in, we've at least obtained permission.
      // The subscription will be completed when they log in.
      if (!userId) {
        console.info('Push permission granted but user not logged in. Subscription deferred.');
        return true;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const applicationServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // Send to Supabase
      const subJSON = subscription.toJSON();
      await api.supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJSON.endpoint,
        p256dh: subJSON.keys.p256dh,
        auth: subJSON.keys.auth
      }, { onConflict: 'user_id, endpoint' });
      
      return true;
    } catch (err) {
      // Handle the specific "NotAllowedError" when browser blocks permission requests
      if (err.name === 'NotAllowedError') {
        console.warn('Browser blocked the notification permission request. User may need to enable notifications in browser settings.');
        setPushPermission('denied');
      } else {
        console.error('Failed to subscribe to push notifications:', err);
      }
      return false;
    }
  }, [pushSupported, userId]);

  // Auto-subscribe to push notifications when user logs in/session restored, if permission is already granted
  useEffect(() => {
    if (userId && pushSupported && pushPermission === 'granted') {
      subscribeToPush();
    }
  }, [userId, pushSupported, pushPermission, subscribeToPush]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      pushSupported,
      pushPermission,
      subscribeToPush
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
