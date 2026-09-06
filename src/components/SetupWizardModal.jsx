import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { 
  User, 
  Phone, 
  CheckCircle2, 
  MapPin, 
  Search, 
  Loader2, 
  Navigation, 
  Bell, 
  Briefcase, 
  IndianRupee, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  Smartphone, 
  X, 
  Flame, 
  Zap, 
  Wifi, 
  Mail, 
  LogOut,
  Globe
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';
import { ToastContext } from '../store/ToastContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { SKILLS } from '../config/constants';
import { GAME_SKILLS, HERO_DISCIPLINES, resolveUserSkills } from '../config/skillRegistry';
import { searchAddress, reverseGeocode } from '../utils/geocoding';
import { getCurrentLocation, INDIA_CENTER } from '../utils/location';
import { api } from '../services/api';
import LocationPicker from './LocationPicker';
import SkillPicker from './SkillPicker';
import ProfileContactInputs from './ProfileContactInputs';
import { formatPhoneNumber, cleanPhoneNumber, isValidPhoneNumber } from '../utils/validation';

/**
 * Unified Operative Onboarding Wizard
 * Single source of truth for full operative onboarding across HelpHive.
 * Calibrates identity, tactical skills, system access, and sector perimeter.
 */
const SetupWizardModal = ({ onComplete, onClose }) => {
  const { 
    userId, 
    userProfile, 
    setUserProfile, 
    savedAddresses = [], 
    addSavedAddress,
    realLocation, 
    setRealLocation,
    resetApp
  } = useContext(AppContext);

  const { subscribeToPush, pushSupported, pushPermission } = useContext(NotificationContext);
  const { showToast } = useContext(ToastContext);
  const { missingItems, missingWizardItems, hasValidNameAndPhone } = useProfileCompletion();

  // Active step counter (1 to 5)
  const [activeStep, setActiveStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Geolocation and Notification permissions reactive state
  const [geoState, setGeoState] = useState('prompt');
  const [notifState, setNotifState] = useState('prompt');
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  // Tactical Skills state
  const [selectedSkills, setSelectedSkills] = useState([]);
  
  // Sector Perimeter & Location State
  const [serviceAreaLocation, setServiceAreaLocation] = useState(() => {
    return realLocation || INDIA_CENTER;
  });
  const [coverageRadius, setCoverageRadius] = useState(5000);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorLandmark, setSectorLandmark] = useState('');
  const hasInitializedRef = useRef(false);

  // Profile Identity state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);

  // Authentication Step 1 state
  const [email, setEmail] = useState('');
  const [authView, setAuthView] = useState('main'); // 'main' | 'magic_link_sent'
  const [loadingAction, setLoadingAction] = useState(null);
  const isLoading = loadingAction !== null;

  // Sync map center with realLocation when it becomes available
  useEffect(() => {
    if (realLocation) {
      setServiceAreaLocation(prev => {
        if (prev.lat === INDIA_CENTER.lat && prev.lng === INDIA_CENTER.lng) {
          return { lat: realLocation.lat, lng: realLocation.lng };
        }
        return prev;
      });
    }
  }, [realLocation]);

  // Reactive Permission Checking
  const checkPermissions = useCallback(async () => {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
        setGeoState(geoStatus.state);
        geoStatus.onchange = () => setGeoState(geoStatus.state);
      } catch (e) {
        setGeoState(realLocation ? 'granted' : 'prompt');
      }
    } else {
      setGeoState(realLocation ? 'granted' : 'prompt');
    }
    setNotifState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  }, [realLocation]);

  useEffect(() => {
    checkPermissions();
    window.addEventListener('focus', checkPermissions);
    return () => window.removeEventListener('focus', checkPermissions);
  }, [checkPermissions]);

  useEffect(() => {
    const checkGoogleLinked = async () => {
      try {
        const { data: { session } } = await api.supabase.auth.getSession();
        if (session?.user?.app_metadata?.provider === 'google' || session?.user?.user_metadata?.full_name) {
          setIsGoogleLinked(true);
        }
      } catch (e) {
        console.error('Error checking auth provider:', e);
      }
    };
    checkGoogleLinked();
  }, []);

  // Pre-fill states from userProfile when available
  useEffect(() => {
    if (userProfile && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
      setName(cleanName);

      const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
      setPhone(formatPhoneNumber(cleanPhone));

      setUpiId(userProfile.upiId || '');

      const resolved = resolveUserSkills(userProfile.skills || [], userProfile.taskerTasksCompleted || userProfile.tasksCompleted || 0);
      setSelectedSkills(resolved.map(s => s.id));

      if (userProfile.serviceAreaLat && userProfile.serviceAreaLng) {
        setServiceAreaLocation({
          lat: userProfile.serviceAreaLat,
          lng: userProfile.serviceAreaLng
        });
      }

      if (userProfile.coverageRadius) {
        setCoverageRadius(userProfile.coverageRadius);
      }

      if (userProfile.serviceAreaName) {
        setSearchQuery(userProfile.serviceAreaName);
      }
    }
  }, [userProfile]);

  // Pre-fill landmark from saved addresses if available
  useEffect(() => {
    if (savedAddresses.length > 0 && !sectorLandmark) {
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      if (defaultAddr.landmark) {
        setSectorLandmark(defaultAddr.landmark);
      }
    }
  }, [savedAddresses, sectorLandmark]);

  const hasInitializedStepRef = useRef(false);

  // Auto-detect optimal starting step
  useEffect(() => {
    if (!hasInitializedStepRef.current) {
      if (!userId) {
        hasInitializedStepRef.current = true;
        setActiveStep(1);
      } else if (userProfile) {
        hasInitializedStepRef.current = true;
        const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
        const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
        const hasProfile = cleanName.trim() && cleanPhone.trim();
        const hasSkills = userProfile.skills && userProfile.skills.length > 0;
        const hasServiceArea = userProfile.serviceAreaLat && userProfile.serviceAreaLng;

        if (!hasProfile) {
          setActiveStep(2);
        } else if (!hasSkills) {
          setActiveStep(3);
        } else if (geoState !== 'granted' || notifState !== 'granted') {
          setActiveStep(4);
        } else if (!hasServiceArea && savedAddresses.length === 0) {
          setActiveStep(5);
        } else {
          setActiveStep(2);
        }
      }
    }
  }, [userProfile, savedAddresses, userId, geoState, notifState]);

  // Check if wizard completed flag is set
  const isCompleted = (
    localStorage.getItem(`helphive_wizard_completed_${userId}`) === 'true' ||
    localStorage.getItem(`helphive_wizard_completed_tasker_${userId}`) === 'true' ||
    localStorage.getItem(`helphive_wizard_completed_poster_${userId}`) === 'true'
  );

  useEffect(() => {
    if (userId && userProfile && !isCompleted && missingWizardItems.length === 0) {
      localStorage.setItem(`helphive_wizard_completed_${userId}`, 'true');
      if (onComplete) {
        onComplete();
      }
    }
  }, [missingWizardItems.length, userId, userProfile, isCompleted, onComplete]);

  // Auto-advance step if user authenticates in step 1
  useEffect(() => {
    if (userId && activeStep === 1) {
      setActiveStep(2);
    }
  }, [userId, activeStep]);

  const isWizardReallyCompleted = userId && isCompleted && missingWizardItems.length === 0;

  if (userId && !userProfile) return null;
  if (isWizardReallyCompleted) return null;
  if (userId && missingWizardItems.length === 0) return null;

  // --- Helper Methods ---

  const handleGoogleLogin = async () => {
    setLoadingAction('google');
    setError('');
    try {
      const { error } = await api.loginWithGoogle();
      if (error) throw error;
    } catch (e) {
      console.error(e);
      setError("Failed to initialize Google Login. Please try again.");
      setLoadingAction(null);
    }
  };

  const handleMagicLink = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      showToast('Enter a valid email address.', 'error');
      return;
    }

    setLoadingAction('magic');
    setError('');

    try {
      const { error } = await api.loginWithMagicLink(trimmedEmail);
      if (error) throw error;
      setAuthView('magic_link_sent');
    } catch (e) {
      console.error(e);
      setError("Failed to send magic link. Please try again.");
      setLoadingAction(null);
    }
  };

  const handleToggleSkill = (skillId) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    );
    setError('');
  };

  // Trigger Location request
  const requestLocation = async () => {
    setIsGeoLoading(true);
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
      setServiceAreaLocation(loc);
      setGeoState('granted');
      showToast('Location calibrated successfully!', 'success');
    } catch (err) {
      showToast('Location permission denied or unavailable.', 'warning');
    } finally {
      setIsGeoLoading(false);
    }
  };

  // Trigger Notification request
  const requestNotifications = async () => {
    setIsNotifLoading(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        setNotifState('granted');
        showToast('Notifications enabled successfully!', 'success');
      } else {
        showToast('Notification permission denied by user or browser.', 'warning');
      }
    } catch (err) {
      showToast('Failed to enable notifications.', 'error');
    } finally {
      setIsNotifLoading(false);
    }
  };

  // Step Validation & Transition
  const handleNext = async () => {
    setError('');

    if (activeStep === 1) {
      if (!userId) {
        setError('Please sign in to continue.');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (!name.trim()) {
        setError('Your full name is required.');
        return;
      }
      if (!isValidPhoneNumber(phone)) {
        setError('Please enter a valid 10-digit phone number.');
        return;
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      if (selectedSkills.length === 0) {
        setError('Please select at least one tactical skill.');
        return;
      }
      setActiveStep(4);
    } else if (activeStep === 4) {
      setActiveStep(5);
    } else if (activeStep === 5) {
      if (!serviceAreaLocation.lat || !serviceAreaLocation.lng) {
        setError('Please define your sector coordinates on the map.');
        return;
      }
      handleDone();
    }
  };

  const handleBack = () => {
    setError('');
    if (activeStep > 2) {
      setActiveStep(prev => prev - 1);
    } else if (activeStep === 2 && !userId) {
      setActiveStep(1);
    }
  };

  // Finalize Onboarding Wizard
  const handleDone = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const rawPhone = cleanPhoneNumber(phone);
      
      const payload = {
        name: name.trim(),
        phone: rawPhone,
        verifiedPhone: rawPhone,
        skills: selectedSkills,
        coverageRadius: coverageRadius,
        coverageLevel: coverageRadius === 20000 ? 'flexible' : coverageRadius === 10000 ? 'local' : 'nearby',
        serviceAreaName: searchQuery || sectorLandmark || 'Primary Sector',
        serviceAreaLat: serviceAreaLocation.lat,
        serviceAreaLng: serviceAreaLocation.lng,
        locationStr: `POINT(${serviceAreaLocation.lng} ${serviceAreaLocation.lat})`
      };

      if (upiId && upiId.trim()) {
        payload.upiId = upiId.trim();
      }

      const res = await setUserProfile(payload);
      if (res && res.success === false) {
        setError(res.error || 'Failed to update profile.');
        setIsSubmitting(false);
        return;
      }

      // Also ensure primary sector base address is saved in Address Book
      const landmarkText = sectorLandmark.trim() || searchQuery || 'Sector Base';
      const completeAddr = searchQuery || 'Primary Sector Coordinates';
      const isAlreadySaved = savedAddresses.some(
        addr => addr.completeAddress === completeAddr || (addr.lat === serviceAreaLocation.lat && addr.lng === serviceAreaLocation.lng)
      );
      if (!isAlreadySaved) {
        await addSavedAddress({
          lat: serviceAreaLocation.lat,
          lng: serviceAreaLocation.lng,
          completeAddress: completeAddr,
          landmark: landmarkText,
          type: 'Base',
          isDefault: savedAddresses.length === 0
        });
      }

      // Complete wizard across unified and legacy keys
      localStorage.setItem(`helphive_wizard_completed_${userId}`, 'true');
      localStorage.setItem(`helphive_wizard_completed_tasker_${userId}`, 'true');
      localStorage.setItem(`helphive_wizard_completed_poster_${userId}`, 'true');

      showToast('Profile calibrated successfully!', 'success');
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Error completing setup wizard:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await resetApp();
      showToast('Logged out successfully', 'success');
      if (onClose) onClose();
    } catch (e) {
      showToast('Failed to sign out', 'error');
    }
  };

  const totalSteps = 5;

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-[#F8FAFC] flex flex-col overflow-hidden select-none animate-[fadeIn_150ms_ease-out]">
      {/* Top Navigation Bar */}
      <header className="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-border bg-white shrink-0 flex flex-col space-y-3 shadow-xs">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs sm:text-sm font-black text-primary px-3 py-1 rounded-full bg-primary/10 tracking-tight">
              Profile Setup
            </span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 5-Step Progress Indicators */}
        <div className="max-w-4xl w-full mx-auto flex items-center space-x-2 pt-0.5">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isPassed = activeStep > idx + 1;
            const isActive = activeStep === idx + 1;
            return (
              <div key={idx} className="flex-1 flex flex-col space-y-1">
                <div className={`h-1.5 rounded-full transition-all duration-300 ${
                  isPassed ? 'bg-emerald-500' : isActive ? 'bg-primary' : 'bg-gray-200'
                }`} />
              </div>
            );
          })}
        </div>
      </header>

      {/* Content Body */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 flex flex-col">
        <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
          {error && (
            <div className="mb-4 text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 animate-pulse shrink-0">
              {error}
            </div>
          )}

          {/* Step 1: Authentication */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div className="space-y-4 pt-1">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 text-slate-700 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50 active-press cursor-pointer shadow-xs"
                >
                  {loadingAction === 'google' ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>{loadingAction === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-gray-50 text-gray-400 font-medium text-xs">or</span>
                  </div>
                </div>

                {authView === 'main' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-500">
                      Email address
                    </label>
                    <div className="flex items-center bg-white border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isLoading) {
                            handleMagicLink();
                          }
                        }}
                        disabled={isLoading}
                        placeholder="name@example.com"
                        className="w-full bg-transparent border-0 px-3 py-2 text-sm font-semibold outline-none text-dark h-full"
                      />
                      {email.length > 5 && (
                        <button
                          type="button"
                          onClick={handleMagicLink}
                          disabled={isLoading}
                          className="bg-primary hover:bg-primary/95 text-white px-4 py-1.5 rounded-lg text-xs font-black whitespace-nowrap ml-2 cursor-pointer shrink-0 disabled:opacity-70 flex items-center justify-center min-w-[80px] shadow-sm shadow-primary/20"
                        >
                          {loadingAction === 'magic' ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            'Send Link'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center p-6 bg-white border border-border rounded-3xl space-y-4 w-full">
                    <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-dark">Magic Link Sent!</h4>
                      <p className="text-xs font-semibold text-gray-400 mt-1 leading-relaxed">
                        We sent a sign-in link to <strong className="text-dark">{email}</strong>. Check your inbox to sign in automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthView('main')}
                      className="text-[10px] font-black uppercase text-primary tracking-widest mt-2 hover:underline cursor-pointer"
                    >
                      Use a different email
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Contact Identity (Name & Phone) */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-dark leading-tight">Your Identity</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1">Shared with matching claimers and deployers on active bounties.</p>
              </div>

              <div className="pt-1">
                <ProfileContactInputs
                  name={name}
                  setName={setName}
                  phone={phone}
                  setPhone={setPhone}
                  namePlaceholder="e.g. Felix Wing"
                  inputBg="bg-white"
                />
              </div>
            </div>
          )}

          {/* Step 3: Tactical Skills Selection */}
          {activeStep === 3 && (
            <div className="space-y-4 flex flex-col flex-1">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-dark leading-tight">Equip Tactical Skills</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1">Select your capabilities across Field and Cyber operations.</p>
              </div>

              <div className="flex-1 min-h-[350px]">
                <SkillPicker
                  mode="multi"
                  layout="grid"
                  selected={selectedSkills}
                  onSelect={handleToggleSkill}
                  maxHeight="max-h-[55vh]"
                />
              </div>
            </div>
          )}

          {/* Step 4: System Access (Location & Notification Permissions) */}
          {activeStep === 4 && (
            <div className="space-y-6 py-2 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-dark leading-tight">Enable Sector Access</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1 max-w-[320px] mx-auto">
                  Required to detect nearby bounties in real time and receive instant dispatch alerts.
                </p>
              </div>

              <div className="w-full space-y-3.5 pt-2">
                {/* Location Permission Block */}
                <div className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-primary flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-dark">Location</p>
                      <p className="text-[10px] font-semibold text-gray-400">Calibrates radar for local sector bounties</p>
                    </div>
                  </div>
                  
                  {geoState === 'granted' ? (
                    <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2.5 py-1 rounded-xl text-[10px] font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Enabled</span>
                    </div>
                  ) : geoState === 'denied' ? (
                    <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-xl">Blocked</span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={isGeoLoading}
                      className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[10px] font-bold transition-all active:scale-[0.97] cursor-pointer"
                    >
                      {isGeoLoading ? 'Enabling...' : 'Enable'}
                    </button>
                  )}
                </div>

                {/* Notification Permission Block */}
                <div className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-primary flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-dark">Notifications</p>
                      <p className="text-[10px] font-semibold text-gray-400">Instant alerts for nearby bounties and status updates</p>
                    </div>
                  </div>
                  
                  {notifState === 'granted' ? (
                    <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2.5 py-1 rounded-xl text-[10px] font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Enabled</span>
                    </div>
                  ) : notifState === 'denied' ? (
                    <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-xl">Blocked</span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestNotifications}
                      disabled={isNotifLoading}
                      className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[10px] font-bold transition-all active:scale-[0.97] cursor-pointer"
                    >
                      {isNotifLoading ? 'Enabling...' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Sector Area & Perimeter Calibration */}
          {activeStep === 5 && (
            <div className="space-y-4 flex flex-col flex-1 min-h-[500px]">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-dark leading-tight">Sector Calibration</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1">Calibrate your patrol radius and primary base for live radar matching and instant deployment.</p>
              </div>

              {/* Full-height LocationPicker with live coverage circle */}
              <div className="flex-1 min-h-[360px] sm:min-h-[420px] relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                <LocationPicker
                  initialLat={serviceAreaLocation.lat}
                  initialLng={serviceAreaLocation.lng}
                  coverageRadius={coverageRadius}
                  searchPlaceholder="Search sector base, street, or landmark..."
                  onLocationChange={(loc) => {
                    setServiceAreaLocation({
                      lat: loc.lat,
                      lng: loc.lng
                    });
                    setSearchQuery(loc.completeAddress);
                  }}
                  onLocationGranted={(coords) => {
                    setRealLocation(coords);
                  }}
                />
              </div>

              {/* Radius Control Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs shrink-0">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Sector Radar Radius</label>
                <div className="flex space-x-2.5">
                  {[
                    { val: 5000, label: '5 km', desc: 'Nearby' },
                    { val: 10000, label: '10 km', desc: 'Local' },
                    { val: 20000, label: '20 km', desc: 'Extended' }
                  ].map((rad) => {
                    const isRadSelected = coverageRadius === rad.val;
                    return (
                      <button
                        key={rad.val}
                        onClick={() => setCoverageRadius(rad.val)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer active-scale ${
                          isRadSelected
                            ? 'border-primary bg-primary/10 text-primary font-black shadow-xs ring-1 ring-primary/20'
                            : 'border-gray-200 bg-white text-gray-600 font-bold hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs font-black">{rad.label}</div>
                        <div className="text-[10px] font-semibold opacity-75">{rad.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sector Landmark / Drop Details */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs shrink-0 space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Sector Landmark / Base Drop Details</label>
                <input
                  type="text"
                  value={sectorLandmark}
                  onChange={(e) => setSectorLandmark(e.target.value)}
                  placeholder="e.g. Near Community Center, Sector 4, gate 2"
                  className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary rounded-xl px-3.5 h-11 w-full text-xs font-bold outline-none text-dark transition-all"
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Sticky Bottom Footer Navigation */}
      <footer className="px-4 sm:px-8 py-3.5 sm:py-4 bg-white border-t border-border shrink-0 shadow-sm">
        <div className="max-w-4xl w-full mx-auto flex items-center space-x-3 pb-2 sm:pb-0">
          {userId ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="py-3 px-4 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 text-red-500 font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50 active-scale"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold">Sign out</span>
            </button>
          ) : (
            (activeStep > 2 || (activeStep === 2 && !userId)) && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl border border-border font-semibold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50 active-scale"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-semibold">Back</span>
              </button>
            )
          )}

          <button
            onClick={handleNext}
            disabled={isSubmitting || (activeStep === 1 && !userId)}
            className="flex-1 bg-primary hover:bg-primary/95 text-white py-3.5 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all font-bold flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="text-xs font-bold uppercase tracking-wider">
                  {activeStep === 5 ? 'Calibrate & Enter The Grid 🚀' : 'Save & Next'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SetupWizardModal;
