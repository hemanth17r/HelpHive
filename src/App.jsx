import React, { useContext, useEffect, useState, useCallback } from 'react';
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
  ChevronDown,
  ArrowLeftRight,
  Briefcase,
  Star,
  Menu,
  Clock,
  TrendingUp
} from 'lucide-react';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

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
import SetupWizardModal from './components/SetupWizardModal';
import LoginModal from './components/LoginModal';
import DevToolsPanel from './components/DevToolsPanel';
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
    isProfileLoading,
    showWizard,
    openOnboardingWizard,
    closeOnboardingWizard,
    showLoginModal,
    setShowLoginModal,
    userId,
    logout,
    switchRole,
    jobHistoryTab,
    setJobHistoryTab
  } = useContext(AppContext);

  const { 
    unreadCount, 
    pushSupported, 
    pushPermission, 
    subscribeToPush 
  } = useContext(NotificationContext);

  const { 
    completionPercentage, 
    missingWizardItems, 
    hasOsLocation, 
    hasNotifications,
    hasValidNameAndPhone,
    hasSkills,
    hasUpiId,
    hasJobLocation
  } = useProfileCompletion();

  const lastActiveWriteRef = React.useRef(0);

  // Compulsory Onboarding Wizard for Authenticated Users
  useEffect(() => {
    if (userId && !isProfileLoading) {
      // Bypass wizard for test/debug profiles
      const isTestUser = userProfile?.name && (
        userProfile.name.toLowerCase().includes('tester') || 
        userProfile.name.toLowerCase().includes('debug') || 
        userProfile.name === 'HR'
      );
      if (isTestUser) return;

      // Determine if they are missing any required profile inputs or permission grants
      let isProfileIncomplete = false;
      
      // Permissions are compulsory for real users
      const hasPermissions = hasOsLocation && hasNotifications;

      if (role === 'tasker') {
        const hasServiceArea = !missingWizardItems.includes('service_area');
        isProfileIncomplete = !hasSkills || !hasServiceArea || !hasValidNameAndPhone || !hasUpiId || !hasPermissions;
      } else {
        isProfileIncomplete = !hasValidNameAndPhone || !hasJobLocation || !hasPermissions;
      }

      if (isProfileIncomplete && !showWizard) {
        openOnboardingWizard();
      }
    }
  }, [
    userId,
    role,
    hasSkills,
    hasValidNameAndPhone,
    hasUpiId,
    hasJobLocation,
    hasOsLocation,
    hasNotifications,
    missingWizardItems,
    isProfileLoading,
    showWizard,
    openOnboardingWizard
  ]);



  // Status dot for Tasker avatar (always online/green)
  const renderStatusDot = () => (
    (role === 'tasker') ? (
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
    ) : null
  );

  const handleWhatsAppSupport = () => {
    window.open('https://wa.me/919347442426?text=Hi%20HelpHive%20Support%2C%20I%20need%20help!', '_blank');
  };

  const handleLogout = () => {
    logout();
    pushScreen('landing');
  };

  const handleHomeLogoClick = () => {
    if (role === 'tasker') {
      setActiveTab('home');
      pushScreen('tasker_home');
    } else if (role === 'poster') {
      pushScreen('poster_home');
    } else {
      resetApp();
    }
  };

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

  // Dynamic SEO Metadata and Document Title Updates based on route
  React.useEffect(() => {
    let title = "HelpHive | Local Help, Side Hustles & Quick Tasks";
    let description = "HelpHive connects you with trusted local helpers and flexible side hustles in your neighborhood. Post tasks or find quick services on demand.";

    switch (currentScreen) {
      case 'landing':
        title = "HelpHive | Local Help, Side Hustles & Quick Tasks";
        description = "Get trusted local help, fast. Post tasks or find local gigs and side hustles near you on HelpHive.";
        break;
      case 'about_us':
        title = "About HelpHive | Connect • Help • Earn";
        description = "Learn more about HelpHive, our mission, values, and how we connect local helpers with people needing assistance.";
        break;
      case 'need_help':
        title = "HelpHive Support | Help & FAQs";
        description = "Need assistance? Find answers to frequently asked questions and get in touch with HelpHive support.";
        break;
      case 'poster_home':
        title = "Poster Dashboard | HelpHive";
        description = "Manage your posted tasks, review applications from local helpers, and coordinate jobs.";
        break;
      case 'tasker_home':
        title = "Tasker Dashboard | HelpHive";
        description = "Receive local tasks in your area, submit offers, and start earning on your own schedule.";
        break;
      case 'post_job':
        title = "Post a New Task | HelpHive";
        description = "Quickly post a new task on HelpHive to find local verified helpers in minutes.";
        break;
      case 'notifications':
        title = "Notifications | HelpHive";
        description = "View your recent notifications, matches, and chat updates on HelpHive.";
        break;
      case 'my_profile':
        title = "My Profile | HelpHive";
        description = "Manage your HelpHive profile, ratings, verification status, and app settings.";
        break;
      case 'job_history':
        title = "My Tasks History | HelpHive";
        description = "Review your past jobs, transactions, and completed works on HelpHive.";
        break;
      case 'admin_dashboard':
        title = "Admin Portal | HelpHive";
        description = "Administrative analytics, system health metrics, and user management dashboard.";
        break;
      default:
        break;
    }

    document.title = title;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    }
  }, [currentScreen]);

  // Update last active timestamp for active pool logic
  React.useEffect(() => {
    if (userProfile?.id && currentScreen !== 'landing') {
      const now = Date.now();
      // Throttle updates to at most once every 5 minutes (300,000 ms)
      if (now - lastActiveWriteRef.current > 300000) {
        lastActiveWriteRef.current = now;
        api.updateLastActive().catch(err => console.warn('Failed to update last active:', err));
      }
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
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-white w-full">
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
  const showBottomNav = (currentScreen === 'tasker_home' && activeTab === 'home') || currentScreen === 'poster_home';



  const isHomeActive = role === 'tasker' 
    ? activeTab === 'home' && currentScreen === 'tasker_home'
    : currentScreen === 'poster_home';

  const isProfileActive = role === 'tasker' 
    ? activeTab === 'profile' && currentScreen === 'tasker_home'
    : currentScreen === 'my_profile';

  const isEarningsActive = currentScreen === 'tasker_activity';
  const isAddressBookActive = currentScreen === 'address_book' || currentScreen === 'add_edit_address';
  const isActiveTasksActive = currentScreen === 'job_history' && jobHistoryTab === 'active';

  // Collapsible sidebar state — persisted to localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('helphive_sidebar') !== 'collapsed'; } catch { return true; }
  });
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('helphive_sidebar', next ? 'expanded' : 'collapsed'); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  const showLabels = sidebarOpen;

  if (isProfileLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-white w-full">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-gray-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white flex items-center justify-center p-0 select-none font-sans overflow-hidden">
      
      {/* Desktop Dashboard Layout (above 1024px) */}
      <div className="hidden lg:flex flex-col w-full h-full bg-white overflow-hidden">
        
        {/* Top Header Bar */}
        {role && currentScreen !== 'landing' && (
          <header className="h-16 w-full bg-white flex items-center px-4 shrink-0 justify-between relative z-20">
            
            {/* Left: Hamburger + Branding */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-full hover:bg-[#E8EAED] text-gray-600 transition-colors cursor-pointer active-scale"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div 
                className="flex items-center cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleHomeLogoClick}
              >
                <span className="text-[22px] font-black text-dark tracking-tight">
                  Help<span className="text-primary">Hive</span>
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2">
              
              {/* Notification Bell */}
              <button 
                className="relative p-2.5 text-gray-600 hover:bg-[#E8EAED] rounded-full transition-colors active-scale cursor-pointer"
                onClick={handleNotificationClick}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Profile Avatar Trigger */}
              <button 
                className="p-1 rounded-full hover:bg-[#E8EAED] transition-colors active-scale cursor-pointer"
                onClick={() => {
                  if (role === 'tasker') {
                    setActiveTab('profile');
                    pushScreen('tasker_home');
                  } else if (role === 'poster') {
                    pushScreen('my_profile');
                  }
                }}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center p-[1.5px] relative"
                  style={{ background: `conic-gradient(#F26419 ${completionPercentage}%, #e5e7eb ${completionPercentage}%)` }}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-2 border-white">
                    <BirdAvatar birdName={selectedBird} size={24} />
                  </div>
                  {renderStatusDot()}
                </div>
              </button>
            </div>
          </header>
        )}

        {/* Main Dashboard Layout with Left Sidebar */}
        <div className="flex-1 flex flex-row w-full overflow-hidden bg-white">
          
          {/* Left Sidebar Navigation — Collapsible */}
          {role && currentScreen !== 'landing' && (
            <div 
              className={`shrink-0 transition-[width] duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)] relative h-full ${
                sidebarOpen ? 'w-[256px]' : 'w-[68px]'
              }`}
            >
              <aside 
                className={`bg-white flex flex-col justify-between py-3 px-3 z-40 transition-[width] duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden h-full ${
                  sidebarOpen 
                    ? 'w-[256px] relative' 
                    : 'w-[68px] absolute left-0 top-0'
                }`}
              >
                <div className="space-y-1">

                  {/* Primary Nav Links */}
                  <nav className="space-y-0.5">
                    <button 
                      onClick={() => {
                        if (role === 'tasker') {
                          setActiveTab('profile');
                          pushScreen('tasker_home');
                        } else {
                          pushScreen('my_profile');
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap overflow-hidden ${
                        isProfileActive 
                          ? 'bg-[#FCE8DB] text-[#C4521A]' 
                          : 'text-[#444746] hover:bg-[#FCE8DB]/40 hover:text-[#C4521A]'
                      }`}
                      title="Profile"
                    >
                      <User className="w-5 h-5 shrink-0" />
                      <span className={`transition-opacity duration-200 ${showLabels ? 'opacity-100' : 'opacity-0'}`}>Profile</span>
                    </button>
                  </nav>

                  {/* Divider removed */}

                  {/* Role switch */}
                  <button 
                    onClick={() => switchRole(role === 'tasker' ? 'poster' : 'tasker')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[13px] font-semibold text-primary hover:bg-[#FCE8DB]/50 transition-colors duration-200 cursor-pointer active-scale whitespace-nowrap overflow-hidden"
                    title={role === 'tasker' ? 'Switch to Hirer' : 'Switch to Tasker'}
                  >
                    <ArrowLeftRight className="w-5 h-5 shrink-0" />
                    <span className={`transition-opacity duration-200 ${showLabels ? 'opacity-100' : 'opacity-0'}`}>{role === 'tasker' ? 'Switch to Hirer' : 'Switch to Tasker'}</span>
                  </button>

                  {/* Divider removed */}

                  {/* Secondary Navigation Links */}
                  <div className="space-y-0.5">
                    {role === 'tasker' ? (
                      <button 
                        onClick={() => {
                          pushScreen('tasker_activity');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap overflow-hidden ${
                          isEarningsActive 
                            ? 'bg-[#FCE8DB] text-[#C4521A]' 
                            : 'text-[#444746] hover:bg-[#FCE8DB]/40 hover:text-[#C4521A]'
                        }`}
                        title="Earnings"
                      >
                        <TrendingUp className="w-5 h-5 shrink-0" />
                        <span className={`transition-opacity duration-200 ${showLabels ? 'opacity-100' : 'opacity-0'}`}>Earnings</span>
                      </button>
                    ) : role === 'poster' ? (
                      <button 
                        onClick={() => {
                          pushScreen('address_book');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap overflow-hidden ${
                          isAddressBookActive 
                            ? 'bg-[#FCE8DB] text-[#C4521A]' 
                            : 'text-[#444746] hover:bg-[#FCE8DB]/40 hover:text-[#C4521A]'
                        }`}
                        title="Address Book"
                      >
                        <MapPin className="w-5 h-5 shrink-0" />
                        <span className={`transition-opacity duration-200 ${showLabels ? 'opacity-100' : 'opacity-0'}`}>Address Book</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Bottom Actions */}
                {userId && (
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors duration-200 cursor-pointer active-scale whitespace-nowrap overflow-hidden"
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className={`transition-opacity duration-200 ${showLabels ? 'opacity-100' : 'opacity-0'}`}>Sign Out</span>
                  </button>
                )}
              </aside>
            </div>
          )}

          {/* Main Viewport Content Area */}
          <main className={`flex-1 overflow-y-auto relative flex flex-col w-full transition-all duration-300 ${
            currentScreen === 'landing' 
              ? 'bg-orange-50 p-0' 
              : 'bg-white'
          }`}>
            <div key={currentScreen} className="w-full flex-1 flex flex-col relative animate-[fadeIn_200ms_ease-in-out]">
              <ErrorBoundary key={currentScreen}>
                {renderScreen()}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile/Tablet Card Layout (below 1024px) */}
      <div className="lg:hidden w-full h-full bg-white relative flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Top bar on Mobile */}
        {role && isMainScreen && currentScreen !== 'landing' && (
          <div 
            className="bg-white px-4 pb-3 flex items-center justify-between shrink-0 z-10 relative pt-safe"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
          >
            <div className="flex items-center">
              {/* Branding (Mobile) */}
              <div 
                className="flex items-center cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleHomeLogoClick}
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
                    style={{ background: `conic-gradient(#F26419 ${completionPercentage}%, #f3f4f6 ${completionPercentage}%)` }}
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

      {/* Fixed Bottom Nav */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-50 w-full">
          <BottomNav />
        </div>
      )}
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

    {showWizard && (
      <SetupWizardModal 
        onComplete={() => closeOnboardingWizard(true)}
        onClose={userId ? null : () => closeOnboardingWizard(false)}
      />
    )}

    <LoginModal 
      isOpen={showLoginModal}
      onClose={() => setShowLoginModal(false)}
    />

    <DevToolsPanel />

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
