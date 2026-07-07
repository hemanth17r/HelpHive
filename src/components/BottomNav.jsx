import React, { useContext, useState, useEffect, useRef } from 'react';
import { Home, User, Repeat, Clock, Plus } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const BottomNav = () => {
  const { 
    activeTab, 
    setActiveTab, 
    switchRole, 
    role, 
    pushScreen, 
    currentScreen, 
    userId,
    openLoginModal,
    openOnboardingWizard
  } = useContext(AppContext);
  const [isRotating, setIsRotating] = useState(false);
  const [visible, setVisible] = useState(true);

  const timeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    setVisible(true);
  }, [currentScreen]);

  useEffect(() => {
    const handleScroll = (e) => {
      // Keep bottom bar always fixed on Hirer or Tasker Home Screens
      if (currentScreen === 'tasker_home' || currentScreen === 'poster_home') {
        setVisible(true);
        return;
      }

      const scrollTop = e.target.scrollTop;
      if (typeof scrollTop === 'undefined') return;
      if (scrollTop === lastScrollTopRef.current) return;

      // Only track scroll on major vertical scroll containers (like page screens)
      if (e.target.scrollHeight < window.innerHeight * 0.5) return;

      const diff = scrollTop - lastScrollTopRef.current;
      if (Math.abs(diff) < 10) return;

      if (scrollTop <= 10) {
        setVisible(true);
      } else if (diff > 0) {
        setVisible(false); // Scrolling down
      } else {
        setVisible(true); // Scrolling up
      }
      lastScrollTopRef.current = scrollTop;
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [currentScreen]);

  const handleSwitchMode = () => {
    setIsRotating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsRotating(false);
      switchRole(role === 'tasker' ? 'poster' : 'tasker');
    }, 400);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleHomeClick = () => {
    if (role === 'tasker') setActiveTab('home');
    else pushScreen('poster_home');
  };

  const handleProfileClick = () => {
    if (role === 'tasker') setActiveTab('profile');
    else pushScreen('my_profile');
  };

  const { missingWizardItems } = useProfileCompletion();

  const handlePlusClick = () => {
    if (!userId) {
      openLoginModal(() => {
        handlePlusClick();
      });
      return;
    }
    const isWizardCompleted = localStorage.getItem(`helphive_wizard_completed_poster_${userId}`) === 'true' && missingWizardItems.length === 0;
    if (!isWizardCompleted) {
      openOnboardingWizard(() => {
        pushScreen('post_job');
      });
    } else {
      pushScreen('post_job');
    }
  };

  const isHomeActive = role === 'tasker' 
    ? activeTab === 'home' 
    : currentScreen === 'poster_home';

  const isProfileActive = role === 'tasker' 
    ? activeTab === 'profile' 
    : currentScreen === 'my_profile';

  return (
    <div 
      className={`grid grid-cols-3 items-center bg-white/95 backdrop-blur-lg border-t border-border-m3 shrink-0 w-full transition-all duration-300 ease-in-out origin-bottom ${
        visible 
          ? 'py-2.5 opacity-100 translate-y-0 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]' 
          : 'py-0 opacity-0 pointer-events-none overflow-hidden border-transparent translate-y-full'
      }`}
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)'
      }}
    >
      <button
        onClick={handleHomeClick}
        className={`flex flex-col items-center space-y-0.5 py-1 transition-all cursor-pointer ${
          isHomeActive ? 'text-primary' : 'text-gray-400 hover:text-primary'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[9px] font-extrabold tracking-wide">Home</span>
      </button>

      {role === 'poster' ? (
        <div className="relative flex justify-center w-full h-10">
          <div className="absolute -top-[30px]">
            <button
              onClick={handlePlusClick}
              className="w-14 h-14 bg-gradient-to-tr from-primary to-orange-500 rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
              title="Post a Task"
            >
              <Plus size={32} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleProfileClick}
          className={`flex flex-col items-center space-y-0.5 py-1 transition-all cursor-pointer justify-center ${
            isProfileActive ? 'text-primary' : 'text-gray-400 hover:text-primary'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-extrabold tracking-wide">Profile</span>
        </button>
      )}

      <button
        onClick={handleSwitchMode}
        className="flex flex-col items-center space-y-0.5 py-1 text-gray-400 hover:text-primary transition-all cursor-pointer justify-center"
      >
        <Repeat className={`w-5 h-5 ${isRotating ? 'animate-role-rotate' : ''}`} />
        <span className="text-[9px] font-extrabold tracking-wide">
          {role === 'tasker' ? 'Hirer Mode' : 'Tasker Mode'}
        </span>
      </button>
    </div>
  );
};

export default BottomNav;
