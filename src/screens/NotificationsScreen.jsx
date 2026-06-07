import React, { useContext, useState } from 'react';
import { ArrowLeft, Bell, CheckCircle2, Navigation, Star, AlertTriangle, BellOff } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';

const getIconForType = (type) => {
  switch (type) {
    case 'job_accepted': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'job_completed': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
    case 'new_job': return <Navigation className="w-5 h-5 text-primary" />;
    case 'badge_received': return <Star className="w-5 h-5 text-yellow-500" />;
    default: return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const NotificationsScreen = () => {
  const { popScreen, pushScreen } = useContext(AppContext);
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    pushSupported, 
    pushPermission, 
    subscribeToPush 
  } = useContext(NotificationContext);

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState(null);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      pushScreen(notification.action_url);
    }
  };

  const handleSubscribeToPush = async () => {
    setIsSubscribing(true);
    setSubscribeError(null);
    try {
      const success = await subscribeToPush();
      if (!success) {
        setSubscribeError('Could not enable notifications. Please check your browser settings and allow notifications for this site.');
      }
    } catch {
      setSubscribeError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Show the prompt if push is supported and permission hasn't been granted yet
  const showPushPrompt = pushSupported && pushPermission !== 'granted';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <button 
            onClick={popScreen}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-dark" />
          </button>
          <h2 className="text-lg font-black text-dark">Notifications</h2>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button 
            onClick={markAllAsRead}
            className="text-xs font-bold text-primary hover:text-primary/80"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Push Subscription Prompt */}
      {showPushPrompt && (
        <div className="m-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start space-x-3 shadow-sm">
          {pushPermission === 'denied' ? (
            <BellOff className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
          ) : (
            <Bell className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            {pushPermission === 'denied' ? (
              <>
                <h3 className="text-sm font-bold text-dark">Notifications Blocked</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Notifications are blocked by your browser. To enable them, open your browser settings and allow notifications for this site.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-dark">Enable Push Notifications</h3>
                <p className="text-xs text-gray-600 mt-1">Get instantly notified when a tasker accepts your job or completes a task, even when you're not in the app.</p>
                <button 
                  onClick={handleSubscribeToPush}
                  disabled={isSubscribing}
                  className={`mt-3 bg-primary text-white text-xs font-bold px-4 py-2 rounded-full transition-colors ${
                    isSubscribing ? 'opacity-70 cursor-wait' : 'hover:bg-primary/90 cursor-pointer'
                  }`}
                >
                  {isSubscribing ? (
                    <span className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
                      <span>Enabling...</span>
                    </span>
                  ) : 'Turn on notifications'}
                </button>
                {subscribeError && (
                  <p className="text-xs text-red-500 font-semibold mt-2">{subscribeError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-dark font-bold">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">When you get updates about your tasks or ratings, they'll show up here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3 ${
                notification.is_read 
                  ? 'bg-white border-gray-100 hover:border-gray-200' 
                  : 'bg-orange-50/50 border-primary/20 hover:border-primary/40'
              }`}
            >
              <div className={`p-2 rounded-full shrink-0 ${notification.is_read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
                {getIconForType(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm truncate pr-2 ${notification.is_read ? 'font-semibold text-gray-800' : 'font-black text-dark'}`}>
                    {notification.title}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-medium shrink-0">
                    {new Date(notification.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                  {notification.body}
                </p>
              </div>
              {!notification.is_read && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 self-center" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;

