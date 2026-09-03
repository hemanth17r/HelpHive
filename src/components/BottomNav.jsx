import React, { useContext, useState, useEffect, useRef } from 'react';
import { Radio, Plus, Layers } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const BottomNav = () => {
  const { 
    activeTab, 
    setActiveTab, 
    pushScreen, 
    currentScreen, 
    userId,
    openLoginModal,
    openOnboardingWizard
  } = useContext(AppContext);
  
  const [visible, setVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    setVisible(true);
  }, [currentScreen]);

  useEffect(() => {
    const handleScroll = (e) => {
      // Keep bottom bar always fixed on main screens
      if (currentScreen === 'tasker_home' || currentScreen === 'operations' || currentScreen === 'poster_home') {
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

  const { missingWizardItems } = useProfileCompletion();

  const handleRadarClick = () => {
    setActiveTab('home');
    pushScreen('tasker_home');
  };

  const handleOperationsClick = () => {
    pushScreen('operations');
  };

  const handleDeployClick = () => {
    if (!userId) {
      openLoginModal(() => {
        handleDeployClick();
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

  const isRadarActive = currentScreen === 'tasker_home' && activeTab === 'home';
  const isDeployActive = currentScreen === 'post_job';
  const isOperationsActive = currentScreen === 'operations' || currentScreen === 'poster_home';

  return (
    <nav 
      aria-label="Bottom Navigation"
      className={`pointer-events-auto mx-auto w-[calc(100%-2.5rem)] max-w-xs sm:max-w-sm p-1 grid grid-cols-3 items-center bg-slate-200/50 backdrop-blur-2xl backdrop-saturate-150 rounded-full border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] transition-all duration-300 ease-in-out origin-bottom z-40 ${
        visible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 pointer-events-none translate-y-8'
      }`}
      style={{
        marginBottom: 'max(env(safe-area-inset-bottom), 14px)'
      }}
    >
      {/* 1. Radar Grid */}
      <button
        onClick={handleRadarClick}
        className={`flex flex-col items-center justify-center py-2 px-2 rounded-full transition-all duration-200 cursor-pointer select-none active-scale ${
          isRadarActive 
            ? 'bg-white/95 backdrop-blur-md text-primary font-black shadow-[0_2px_10px_rgba(242,100,25,0.12),0_1px_2px_rgba(0,0,0,0.04)] border border-white/90' 
            : 'text-slate-500 hover:text-slate-900 hover:bg-white/30'
        }`}
      >
        <Radio className="w-5 h-5 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Radar</span>
      </button>

      {/* 2. Deploy Contract (Middle Inline Tab) */}
      <button
        onClick={handleDeployClick}
        className={`flex flex-col items-center justify-center py-2 px-2 rounded-full transition-all duration-200 cursor-pointer select-none active-scale ${
          isDeployActive 
            ? 'bg-white/95 backdrop-blur-md text-primary font-black shadow-[0_2px_10px_rgba(242,100,25,0.12),0_1px_2px_rgba(0,0,0,0.04)] border border-white/90' 
            : 'text-slate-500 hover:text-slate-900 hover:bg-white/30'
        }`}
      >
        <Plus className="w-5 h-5 shrink-0 stroke-[2.5]" />
        <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Deploy</span>
      </button>

      {/* 3. Operations Center */}
      <button
        onClick={handleOperationsClick}
        className={`flex flex-col items-center justify-center py-2 px-2 rounded-full transition-all duration-200 cursor-pointer select-none active-scale ${
          isOperationsActive 
            ? 'bg-white/95 backdrop-blur-md text-primary font-black shadow-[0_2px_10px_rgba(242,100,25,0.12),0_1px_2px_rgba(0,0,0,0.04)] border border-white/90' 
            : 'text-slate-500 hover:text-slate-900 hover:bg-white/30'
        }`}
      >
        <Layers className="w-5 h-5 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Operations</span>
      </button>
    </nav>
  );
};

export default BottomNav;
