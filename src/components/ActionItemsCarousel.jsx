import React, { useContext } from 'react';
import { User, MapPin, Bell, Briefcase, IndianRupee } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { getCurrentLocation } from '../utils/location';

const ActionItemsCarousel = () => {
  const { requireProfile, pushScreen, setRealLocation, setActiveTab } = useContext(AppContext);
  const { subscribeToPush } = useContext(NotificationContext);
  const { missingItems } = useProfileCompletion();

  if (missingItems.length === 0) return null;

  const handleLocationRequest = async () => {
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
    } catch (e) {
      console.error("Location access denied or failed", e);
      // Optional: Show a toast here if you have a toast system
    }
  };

  const handleNotificationRequest = async () => {
    await subscribeToPush();
  };

  const handleProfileRequest = () => {
    requireProfile(() => {
      // Intentionally empty. requireProfile will trigger the completion modal 
      // if profile is incomplete. Once completed, it will just execute this callback.
    });
  };

  const handleSkillsRequest = () => {
    pushScreen('tasker_onboarding');
  };

  const handleUpiRequest = () => {
    // We can push to profile tab or tasker activity where UPI is set
    setActiveTab('profile');
  };

  const CARDS = {
    profile: {
      id: 'profile',
      icon: User,
      title: 'Complete Profile',
      desc: 'Add Name & Phone',
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      action: handleProfileRequest
    },
    location: {
      id: 'location',
      icon: MapPin,
      title: 'Enable Location',
      desc: 'Find nearby tasks',
      color: 'bg-red-50 text-red-500 border-red-200',
      action: handleLocationRequest
    },
    notifications: {
      id: 'notifications',
      icon: Bell,
      title: 'Turn on Alerts',
      desc: 'Get instant updates',
      color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      action: handleNotificationRequest
    },
    skills: {
      id: 'skills',
      icon: Briefcase,
      title: 'Setup Skills',
      desc: 'Select your tasks',
      color: 'bg-orange-50 text-orange-500 border-orange-200',
      action: handleSkillsRequest
    },
    upi: {
      id: 'upi',
      icon: IndianRupee,
      title: 'Add UPI ID',
      desc: 'Receive payments',
      color: 'bg-green-50 text-green-600 border-green-200',
      action: handleUpiRequest
    }
  };

  return (
    <div className="w-full overflow-x-auto hide-scrollbar pb-4 pt-1 px-1 -mx-1">
      <div className="flex items-center space-x-3 w-max">
        {missingItems.map(key => {
          const card = CARDS[key];
          if (!card) return null;
          const Icon = card.icon;
          return (
            <div 
              key={card.id}
              onClick={card.action}
              className={`flex items-center p-2.5 rounded-2xl border cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-sm ${card.color} w-48 shrink-0`}
            >
              <div className="bg-white/60 p-2 rounded-xl mr-3 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[11px] font-black uppercase tracking-wider truncate">{card.title}</span>
                <span className="text-[10px] font-bold opacity-80 truncate">{card.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActionItemsCarousel;
