import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppContext } from './AppContext';
import { api } from '../services/api';

export const NotificationContext = createContext();

// Replace with your actual VAPID public key once generated from Supabase
const VAPID_PUBLIC_KEY = 'BIg-I-5TEqEy_5_YtXu3ZTlaM5kXhLEsYgJw6SC2mwfOkdNHwHSyrJ39PQVSklB4EFYEsLsorB_iSKiTo3zZYCA';

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider = ({ children }) => {
  const { userId } = useContext(AppContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState(Notification.permission);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
    }
  }, []);

  // Fetch initial notifications when user logs in
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const fetchNotifications = async () => {
      const { data, error } = await api.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime updates for this user
    const sub = api.supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
          // Recalculate unread count
          setUnreadCount(prev => {
             // simplified: we'll just refetch or keep it simple. It's usually marking as read.
             return payload.new.is_read ? Math.max(0, prev - 1) : prev;
          });
        }
      )
      .subscribe();

    return () => {
      api.supabase.removeChannel(sub);
    };
  }, [userId]);

  const markAsRead = async (notificationId) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    await api.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    
    if (userId) {
      await api.supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    }
  };

  const subscribeToPush = async () => {
    if (!pushSupported || !userId) return false;

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission !== 'granted') return false;

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
      console.error('Failed to subscribe to push notifications:', err);
      return false;
    }
  };

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
