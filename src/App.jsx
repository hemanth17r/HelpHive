import React, { useContext } from 'react';
import { api } from './services/api';
import { AppProvider, AppContext } from './store/AppContext';
import { ToastProvider } from './store/ToastContext';
import { NotificationProvider, NotificationContext } from './store/NotificationContext';
import { 
  Sparkles, 
  Home, 
  PlusCircle, 
  User, 
  HelpCircle, 
  LogOut, 
  Bell, 
  MapPin, 
  Search, 
  ArrowLeft, 
  ChevronDown
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
import AdminDashboard from './screens/AdminDashboard';
import ProfileCompletionModal from './components/ProfileCompletionModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import NotificationsScreen from './screens/NotificationsScreen';
import ErrorBoundary from './components/ErrorBoundary';
import LocationPermissionModal from './components/LocationPermissionModal';
import { useProfileCompletion } from './hooks/useProfileCompletion';

// Navigation Components
import BottomNav from './components/BottomNav';
import Tooltip from './components/Tooltip';
import BirdAvatar from './components/BirdAvatars';

const AppContent = () => {
  const { 
    currentScreen, 
    routeParams,
    activeTab, 
    setActiveTab,
    role, 
    userLocation, 
    userProfile,
    pushScreen,
    popScreen,
    resetApp,
    isOnline,
    setIsOnline,
    selectedBird,
    profileActionCallback,
    completeProfileAction,
    cancelProfileAction,
    liveStatus,
    locationActionCallback,
    locationActionRole,
    completeLocationAction,
    cancelLocationAction,
    setLocationModalOpen,
    realLocation,
    setRealLocation,
    isProfileLoading
  } = useContext(AppContext);

  const { 
    unreadCount, 
    pushSupported, 
    pushPermission, 
    subscribeToPush 
  } = useContext(NotificationContext);

  const { completionPercentage } = useProfileCompletion();

  if (isProfileLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-dvh bg-white w-full">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-gray-500">Loading your profile...</p>
      </div>
    );
  }

  // Status dot for Tasker avatar
  const renderStatusDot = () => (
    (role === 'tasker') ? (
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
        !isOnline ? 'bg-gray-400' : 'bg-emerald-500'
      }`} />
    ) : null
  );

  const formatHeaderLocation = (loc) => {
    if (!loc) return 'Select Location';
    const parts = loc.name.split(',');
    if (parts.length > 0) {
      const first = parts[0].trim();
      const second = parts.length > 1 ? parts[1].trim() : '';
      if (second && (first.length + second.length < 22)) {
        return `${first}, ${second}`;
      }
      return first.length > 25 ? `${first.slice(0, 22)}...` : first;
    }
    return loc.name;
  };

  React.useEffect(() => {
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      const color = currentScreen === 'landing' ? '#fff7ed' : '#ffffff';
      metaThemeColor.setAttribute('content', color);
    }
  }, [currentScreen]);

  // Update last active timestamp for active pool logic
  React.useEffect(() => {
    if (userProfile?.id && currentScreen !== 'landing') {
      api.updateLastActive().catch(err => console.warn('Failed to update last active:', err));
    }
  }, [currentScreen, userProfile?.id]);

  const handleNotificationClick = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.error("Notification permission request failed", e);
      }
    }
    pushScreen('notifications');
  };



  // Render correct screen based on routing state
  const renderScreen = () => {
    switch (currentScreen) {
      case 'auth_loading':
        return (
          <div className="flex-1 flex flex-col items-center justify-center min-h-dvh bg-white w-full">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold text-gray-500">Securely logging you in...</p>
          </div>
        );
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
      case 'admin_dashboard':
        return <AdminDashboard />;
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
    <div className="min-h-dvh bg-gray-100 flex items-center justify-center p-0 select-none font-sans overflow-hidden">
      
      {/* Desktop Dashboard Layout (above 1024px) */}
      <div className="hidden lg:flex flex-col w-full h-dvh bg-[#F8F9FA] overflow-hidden">
        
        {/* Top Header Bar */}
        {role && isMainScreen && currentScreen !== 'landing' && (
          <header className="h-[72px] mx-auto w-full lg:max-w-2xl bg-white border-b border-border lg:border-x lg:border-gray-100 flex items-center px-4 md:px-6 shrink-0 justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative z-10">
            
            {/* Left: Branding & Back Button */}
            <div className="flex items-center space-x-3 justify-start overflow-hidden pr-2">
              {!isMainScreen && (
                <button 
                  onClick={popScreen}
                  className="flex items-center space-x-1 mr-2 px-1.5 py-1 hover:bg-gray-100 text-dark rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <div 
                className="flex items-center cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                onClick={resetApp}
              >
                <span className="text-lg md:text-xl font-black text-dark tracking-tight bg-white px-2 rounded-md shadow-[0_0_10px_rgba(255,255,255,1)]">
                  Help<span className="text-primary">Hive</span>
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end flex-1 pl-2">
              
              {/* Notification Bell */}
              <div 
                className="relative cursor-pointer mr-2 hover:opacity-80 transition-opacity"
                onClick={handleNotificationClick}
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
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (role === 'tasker') {
                    setActiveTab('profile');
                    pushScreen('tasker_home');
                  } else if (role === 'poster') {
                    pushScreen('my_profile');
                  }
                }}
              >
                <div className="relative">
                  <div 
                    className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center p-[2px]"
                    style={{ background: `conic-gradient(#f97316 ${completionPercentage}%, #f3f4f6 ${completionPercentage}%)` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-2 border-white">
                      <BirdAvatar birdName={selectedBird} size={36} />
                    </div>
                  </div>
                  {renderStatusDot()}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main scrollable body */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50/50 lg:bg-[#F8F9FA]">

          {/* Main scrollable body */}
          <main className="flex-1 overflow-y-auto relative flex justify-center w-full bg-[#F8F9FA]">
            <div key={currentScreen} className="w-full lg:max-w-2xl bg-white lg:shadow-[0_0_20px_rgba(0,0,0,0.03)] lg:border-x lg:border-gray-100 flex flex-col min-h-dvh relative animate-[fadeIn_200ms_ease-in-out]">
              <ErrorBoundary key={currentScreen}>
                {renderScreen()}
              </ErrorBoundary>
              {/* Bottom Nav for desktop */}
              {showBottomNav && (
                <div className="sticky bottom-0 z-20">
                  <BottomNav />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile/Tablet Card Layout (below 1024px) */}
      <div className="lg:hidden w-full h-dvh bg-white relative flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Top bar on Mobile */}
        {role && isMainScreen && currentScreen !== 'landing' && (
          <div 
            className="bg-white border-b border-border px-4 pb-3 flex items-center justify-between shrink-0 shadow-xs z-10 relative pt-safe"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
          >
            <div className="flex items-center">
              {/* Branding (Mobile) */}
              <div 
                className="flex items-center cursor-pointer hover:opacity-90 transition-opacity"
                onClick={resetApp}
              >
                <span className="text-lg font-black text-dark tracking-tight">
                  Help<span className="text-primary">Hive</span>
                </span>
              </div>
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Notification Bell (Mobile) */}
              <div 
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleNotificationClick}
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
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center p-[2px]"
                    style={{ background: `conic-gradient(#f97316 ${completionPercentage}%, #f3f4f6 ${completionPercentage}%)` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-2 border-white">
                      <BirdAvatar birdName={selectedBird} size={28} />
                    </div>
                  </div>
                  {renderStatusDot()}
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
          <ErrorBoundary key={currentScreen}>
            {renderScreen()}
          </ErrorBoundary>
        </div>

      {/* Floating Bottom Nav */}
      {showBottomNav && <BottomNav />}
    </div>

    <ProfileCompletionModal 
      isOpen={!!profileActionCallback}
      onClose={cancelProfileAction}
      onSubmit={completeProfileAction}
    />

    <LocationPermissionModal 
      isOpen={!!locationActionCallback}
      onClose={cancelLocationAction}
      onAllow={completeLocationAction}
      role={locationActionRole}
    />

    <PWAInstallPrompt />

  </div>
);
};

// ToastProvider and NotificationProvider imported at top of file

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
