import React, { useContext, useState, useEffect, useRef } from 'react';
import { Home, User, RefreshCw } from 'lucide-react';
import { AppContext } from '../store/AppContext';

const BottomNav = () => {
  const { activeTab, setActiveTab, switchRole, role, pushScreen, currentScreen } = useContext(AppContext);
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

  const isHomeActive = role === 'tasker' 
    ? activeTab === 'home' 
    : currentScreen === 'poster_home';

  const isProfileActive = role === 'tasker' 
    ? activeTab === 'profile' 
    : currentScreen === 'my_profile';

  return (
    <div 
      className={`grid grid-cols-3 items-center bg-white border-t border-border shadow-lg shrink-0 w-full transition-all duration-300 ease-in-out origin-bottom rounded-t-3xl ${
        visible 
          ? 'max-h-20 py-2.5 pb-safe opacity-100 translate-y-0' 
          : 'max-h-0 py-0 opacity-0 pointer-events-none overflow-hidden border-t-transparent translate-y-full'
      }`}
    >
      <button
        onClick={handleHomeClick}
        className={`flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl transition-all cursor-pointer ${
          isHomeActive ? 'text-primary' : 'text-gray-400 hover:text-dark'
        }`}
      >
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-bold">Home</span>
      </button>

      <button
        onClick={handleProfileClick}
        className={`flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl transition-all cursor-pointer justify-center ${
          isProfileActive ? 'text-primary' : 'text-gray-400 hover:text-dark'
        }`}
      >
        <User className="w-6 h-6" />
        <span className="text-[10px] font-bold">Profile</span>
      </button>

      <button
        onClick={handleSwitchMode}
        className="flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl text-gray-400 hover:text-primary transition-all cursor-pointer justify-center"
      >
        <RefreshCw className={`w-6 h-6 transition-transform duration-300 ${isRotating ? 'rotate-180' : ''}`} />
        <span className="text-[10px] font-bold">
          {role === 'tasker' ? 'Switch to Hirer' : 'Switch to Tasker'}
        </span>
      </button>
    </div>
  );
};

export default BottomNav;
