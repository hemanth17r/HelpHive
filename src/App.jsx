import React, { useContext } from 'react';
import { AppProvider, AppContext } from './store/AppContext';
import { 
  Sparkles, 
  Home, 
  PlusCircle, 
  User, 
  HelpCircle, 
  LogOut, 
  Bell, 
  Wifi, 
  WifiOff, 
  ToggleRight, 
  ToggleLeft,
  MapPin,
  Search,
  ArrowLeft
} from 'lucide-react';

// Screens imports
import LandingScreen from './screens/LandingScreen';
import ServiceUnavailableScreen from './screens/ServiceUnavailableScreen';
import TaskerOnboardingScreen from './screens/tasker/TaskerOnboardingScreen';
import TaskerHomeScreen from './screens/tasker/TaskerHomeScreen';
import TaskerJobDetailsScreen from './screens/tasker/TaskerJobDetailsScreen';
import TaskerRatingScreen from './screens/tasker/TaskerRatingScreen';
import TaskerActivityScreen from './screens/tasker/TaskerActivityScreen';
import MyProfileScreen from './screens/MyProfileScreen';
import AboutUsScreen from './screens/AboutUsScreen';
import NeedHelpScreen from './screens/NeedHelpScreen';
import PosterHomeScreen from './screens/poster/PosterHomeScreen';
import PostJobScreen from './screens/poster/PostJobScreen';
import LiveStatusScreen from './screens/poster/LiveStatusScreen';
import CrewConfirmedScreen from './screens/poster/CrewConfirmedScreen';
import RatingScreen from './screens/poster/RatingScreen';
import JobReceiptScreen from './screens/poster/JobReceiptScreen';
import AddressBookScreen from './screens/poster/AddressBookScreen';
import AddEditAddressScreen from './screens/poster/AddEditAddressScreen';
import JobHistoryScreen from './screens/JobHistoryScreen';
import ProfileCompletionModal from './components/ProfileCompletionModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import NotificationsScreen from './screens/NotificationsScreen';

// Navigation Components
import BottomNav from './components/BottomNav';
import Tooltip from './components/Tooltip';
import BirdAvatar from './components/BirdAvatars';

const AppContent = () => {
  const { 
    currentScreen, 
    activeTab, 
    setActiveTab,
    role, 
    userLocation, 
    userProfile,
    pushScreen,
    popScreen,
    resetApp,
    demoMode,
    isOnline,
    setIsOnline,
    selectedBird,
    profileActionCallback,
    completeProfileAction,
  } = useContext(AppContext);

  const { 
    unreadCount, 
    pushSupported, 
    pushPermission, 
    subscribeToPush 
  } = useContext(NotificationContext);

  // Status dot for Tasker avatar
  const StatusDot = () => (
    (role === 'tasker' && isOnline) ? (
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 z-10 bg-green-500" />
    ) : null
  );

  React.useEffect(() => {
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      const color = currentScreen === 'landing' ? '#fff7ed' : '#ffffff';
      metaThemeColor.setAttribute('content', color);
    }
  }, [currentScreen]);



  // Render correct screen based on routing state
  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return <LandingScreen />;
      case 'service_unavailable':
        return <ServiceUnavailableScreen />;
      case 'tasker_onboarding':
        return <TaskerOnboardingScreen />;
      case 'poster_home':
        return <PosterHomeScreen />;
      case 'tasker_home':
        return activeTab === 'home' ? <TaskerHomeScreen /> : <MyProfileScreen />;
      case 'my_profile':
        return <MyProfileScreen />;
      case 'tasker_accepted_job':
        return <TaskerJobDetailsScreen />;
      case 'tasker_rating':
        return <TaskerRatingScreen />;
      case 'tasker_activity':
        return <TaskerActivityScreen />;
      case 'post_job':
        return <PostJobScreen />;
      case 'live_status':
        return <LiveStatusScreen />;
      case 'crew_confirmed':
        return <CrewConfirmedScreen />;
      case 'rating_screen':
        return <RatingScreen />;
      case 'job_receipt':
        return <JobReceiptScreen />;
      case 'about_us':
        return <AboutUsScreen />;
      case 'need_help':
        return <NeedHelpScreen />;
      case 'address_book':
        return <AddressBookScreen />;
      case 'add_edit_address':
        return <AddEditAddressScreen />;
      case 'job_history':
        return <JobHistoryScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      default:
        return <LandingScreen />;
    }
  };

  const handleAlert = (message) => {
    alert(message);
  };

  const isMainScreen = currentScreen === 'landing' || (currentScreen === 'tasker_home' && activeTab === 'home') || currentScreen === 'poster_home';
  const showBottomNav = currentScreen === 'tasker_home' || currentScreen === 'poster_home';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-0 md:p-4 lg:p-0 select-none font-sans overflow-hidden">
      
      {/* Desktop Dashboard Layout (above 1024px) */}
      <div className="hidden lg:flex flex-col w-full h-screen bg-[#F8F9FA] overflow-hidden">
        
        {/* Top Header Bar */}
        {role && isMainScreen && currentScreen !== 'landing' && (
          <header className="h-[72px] mx-auto w-full lg:max-w-2xl bg-white border-b border-border lg:border-x lg:border-gray-100 flex items-center px-4 md:px-6 shrink-0 justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative z-10">
            
            {/* Left: Location & Back Button */}
            <div className="flex items-center flex-1 justify-start overflow-hidden pr-2">
              <div className="flex items-center space-x-2 shrink-0 max-w-[200px] sm:max-w-[250px] md:max-w-[300px]">
                {!isMainScreen && (
                  <button 
                    onClick={popScreen}
                    className="flex items-center space-x-1 mr-2 px-1 py-1 hover:bg-gray-200 text-dark rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                <MapPin className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
                <div className="flex flex-col items-start leading-tight overflow-hidden">
                  <span className="text-base md:text-lg font-black text-dark truncate w-full flex items-center gap-1">
                    {userLocation?.id === 'lpu' ? (
                      <>LPU <span className="text-xs md:text-sm font-bold text-gray-500">&amp; nearby</span></>
                    ) : (
                      userLocation ? userLocation.name : 'Location'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Branding */}
            <div 
              className="flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity absolute left-1/2 -translate-x-1/2"
              onClick={resetApp}
            >
              <span className="text-lg md:text-xl font-black text-dark tracking-tight hidden sm:block bg-white px-2 rounded-md shadow-[0_0_10px_rgba(255,255,255,1)]">
                Help<span className="text-primary">Hive</span>
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end flex-1 pl-2">
              
              {/* Notification Bell */}
              <div 
                className="relative cursor-pointer mr-4 hover:opacity-80 transition-opacity"
                onClick={() => pushScreen('notifications')}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>

              {/* Profile Avatar Trigger */}
              <div 
                className="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (role === 'tasker') {
                    setActiveTab('profile');
                    pushScreen('tasker_home');
                  } else if (role === 'poster') {
                    pushScreen('my_profile');
                  }
                }}
              >
                <div className="text-right hidden md:block max-w-[100px]">
                  <p className="text-xs font-black text-dark leading-none truncate">{userProfile?.name || 'Guest User'}</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{role === 'poster' ? 'Hirer' : role}</p>
                </div>
                <div className="relative">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-primary/20 overflow-hidden bg-orange-50 flex items-center justify-center shrink-0 shadow-sm">
                    <BirdAvatar birdName={selectedBird} size={36} />
                  </div>
                  <StatusDot />
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main scrollable body */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50/50 lg:bg-[#F8F9FA]">

          {/* Main scrollable body */}
          <main className="flex-1 overflow-y-auto relative flex justify-center w-full bg-[#F8F9FA]">
            <div key={currentScreen} className="w-full lg:max-w-2xl bg-white lg:shadow-[0_0_20px_rgba(0,0,0,0.03)] lg:border-x lg:border-gray-100 flex flex-col min-h-screen relative animate-[fadeIn_200ms_ease-in-out]">
              {renderScreen()}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile/Tablet Card Layout (below 1024px) */}
      <div className="lg:hidden w-full max-w-md h-screen md:h-[844px] md:max-h-[90vh] bg-white md:rounded-[40px] md:shadow-2xl md:border-[8px] md:border-dark relative flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Top bar on Mobile */}
        {role && isMainScreen && currentScreen !== 'landing' && (
          <div 
            className="bg-white border-b border-border px-4 pb-3 flex items-center justify-between shrink-0 shadow-xs z-10 relative pt-safe"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
          >
            <div className="flex items-center">
              {/* Location Badge (Mobile) */}
              <div className="flex items-center space-x-2.5 max-w-[260px] sm:max-w-[320px]">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <div className="flex flex-col items-start leading-tight overflow-hidden">
                  <span className="text-base font-black text-dark truncate w-full flex items-center gap-1">
                    {userLocation?.id === 'lpu' ? (
                      <>LPU <span className="text-xs font-bold text-gray-500">&amp; nearby</span></>
                    ) : (
                      userLocation ? userLocation.name : 'Location'
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Notification Bell (Mobile) */}
              <div 
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => pushScreen('notifications')}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>

              {isMainScreen && (
                <div 
                  onClick={() => {
                    if (role === 'tasker') {
                      setActiveTab('profile');
                      pushScreen('tasker_home');
                    } else if (role === 'poster') {
                      pushScreen('my_profile');
                    }
                  }}
                  className="relative cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full border border-primary/20 overflow-hidden bg-orange-50 flex items-center justify-center shrink-0 hover:border-primary transition-colors">
                    <BirdAvatar birdName={selectedBird} size={32} />
                  </div>
                  <StatusDot />
                </div>
              )}
              {/* Back button (hides on main layout bases) */}
              {!isMainScreen && (
                <button 
                  onClick={popScreen}
                  className="text-[10px] font-black text-primary hover:underline cursor-pointer"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main App Body */}
        <div key={currentScreen} className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative animate-[fadeIn_200ms_ease-in-out]">
          {renderScreen()}
        </div>

      {/* Floating Bottom Nav */}
      {showBottomNav && <BottomNav />}
    </div>

    <ProfileCompletionModal 
      isOpen={!!profileActionCallback}
      onClose={cancelProfileAction}
      onSubmit={completeProfileAction}
    />

    <PWAInstallPrompt />

  </div>
);
};

import { ToastProvider } from './store/ToastContext';
import { NotificationProvider, NotificationContext } from './store/NotificationContext';

function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AppProvider>
    </ToastProvider>
  );
}

export default App;
