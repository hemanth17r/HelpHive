import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
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
  LogOut
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';
import { ToastContext } from '../store/ToastContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { SKILLS } from '../config/constants';
import { GAME_SKILLS, resolveUserSkills } from '../config/skillRegistry';
import { searchAddress, reverseGeocode } from '../utils/geocoding';
import { getCurrentLocation, INDIA_CENTER } from '../utils/location';
import { api } from '../services/api';
import MapView from './MapView';
import LocationPicker from './LocationPicker';

const formatPhoneNumber = (value) => {
  const input = value.replace(/\D/g, ''); // Digits only
  if (input.length > 3 && input.length <= 6) {
    return `${input.slice(0, 3)}-${input.slice(3)}`;
  } else if (input.length > 6) {
    return `${input.slice(0, 3)}-${input.slice(3, 6)}-${input.slice(6, 10)}`;
  }
  return input;
};

const SetupWizardModal = ({ onComplete, onClose }) => {
  const { 
    role, 
    userId, 
    userProfile, 
    setUserProfile, 
    savedAddresses = [], 
    addSavedAddress,
    realLocation, 
    setRealLocation,
    switchRole,
    resetApp
  } = useContext(AppContext);

  const { subscribeToPush, pushSupported, pushPermission } = useContext(NotificationContext);
  const { showToast } = useContext(ToastContext);
  const { missingItems, missingWizardItems, hasValidNameAndPhone } = useProfileCompletion();

  // Active step counter (1-indexed)
  const [activeStep, setActiveStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Geolocation and Notification permissions reactive state
  const [geoState, setGeoState] = useState('prompt');
  const [notifState, setNotifState] = useState('prompt');
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  // --- Tasker / Helper State ---
  const [selectedSkills, setSelectedSkills] = useState([]);
  
  // Service Area Map state
  const [serviceAreaLocation, setServiceAreaLocation] = useState(() => {
    return realLocation || INDIA_CENTER;
  });
  const [coverageRadius, setCoverageRadius] = useState(5000);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const hasInitializedRef = useRef(false);

  // Profile fields state (Common)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);

  // Authentication Step 1 states
  const [email, setEmail] = useState('');
  const [authView, setAuthView] = useState('main'); // 'main' | 'magic_link_sent'
  const [loadingAction, setLoadingAction] = useState(null);
  const isLoading = loadingAction !== null;

  // --- Poster / Hirer State ---
  // Address Setup State
  const [addressDetails, setAddressDetails] = useState(() => {
    return {
      lat: realLocation?.lat || INDIA_CENTER.lat,
      lng: realLocation?.lng || INDIA_CENTER.lng,
      completeAddress: '',
      landmark: ''
    };
  });

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Sync map center and default address with realLocation when it becomes available
  useEffect(() => {
    if (realLocation) {
      setServiceAreaLocation(prev => {
        if (prev.lat === INDIA_CENTER.lat && prev.lng === INDIA_CENTER.lng) {
          return { lat: realLocation.lat, lng: realLocation.lng };
        }
        return prev;
      });
      setAddressDetails(prev => {
        if (prev.lat === INDIA_CENTER.lat && prev.lng === INDIA_CENTER.lng) {
          return { ...prev, lat: realLocation.lat, lng: realLocation.lng };
        }
        return prev;
      });
    }
  }, [realLocation]);

  // 1. Reactive Permission Checking
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

  // 2. Pre-fill states from userProfile when available (only once on load)
  useEffect(() => {
    if (userProfile && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Name
      const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
      setName(cleanName);

      // Phone
      const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
      setPhone(formatPhoneNumber(cleanPhone));

      // UPI
      setUpiId(userProfile.upiId || '');

      // Skills
      const resolved = resolveUserSkills(userProfile.skills || [], userProfile.taskerTasksCompleted || userProfile.tasksCompleted || 0);
      setSelectedSkills(resolved.map(s => s.id));

      // Service Area Coordinates
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

  // Pre-fill Poster Address with default address if it exists
  useEffect(() => {
    if (role === 'poster' && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      setAddressDetails({
        lat: defaultAddr.lat,
        lng: defaultAddr.lng,
        completeAddress: defaultAddr.completeAddress,
        landmark: defaultAddr.landmark || ''
      });
    }
  }, [role, savedAddresses]);

  // Click outside for search dropdown and cleanup search timeout
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const hasInitializedStepRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedStepRef.current) {
      if (!userId) {
        hasInitializedStepRef.current = true;
        setActiveStep(1);
      } else if (userProfile) {
        hasInitializedStepRef.current = true;
        if (role === 'tasker') {
          const hasSkills = userProfile.skills && userProfile.skills.length > 0;
          const hasServiceArea = userProfile.serviceAreaLat && userProfile.serviceAreaLng && userProfile.serviceAreaName;
          
          const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
          const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
          const hasProfile = cleanName.trim() && cleanPhone.trim();

          if (!hasSkills) {
            setActiveStep(2);
          } else if (geoState !== 'granted' || notifState !== 'granted') {
            setActiveStep(3);
          } else if (!hasServiceArea) {
            setActiveStep(4);
          } else if (!hasProfile) {
            setActiveStep(5);
          } else {
            setActiveStep(5);
          }
        } else if (role === 'poster') {
          const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
          const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
          const hasProfile = cleanName.trim() && cleanPhone.trim();
          
          const hasAddress = savedAddresses.length > 0;

          if (!hasProfile) {
            setActiveStep(2);
          } else if (geoState !== 'granted' || notifState !== 'granted') {
            setActiveStep(3);
          } else if (!hasAddress) {
            setActiveStep(4);
          } else {
            setActiveStep(4);
          }
        }
      }
    }
  }, [userProfile, role, savedAddresses, userId, geoState, notifState]);

  // Check if wizard completed flag is set
  const isCompleted = localStorage.getItem(`helphive_wizard_completed_${role}_${userId}`) === 'true';

  useEffect(() => {
    if (userId && userProfile && !isCompleted && missingWizardItems.length === 0) {
      localStorage.setItem(`helphive_wizard_completed_${role}_${userId}`, 'true');
      if (onComplete) {
        onComplete();
      }
    }
  }, [missingWizardItems.length, role, userId, userProfile, isCompleted, onComplete]);

  // Auto-advance step if user authenticates in step 1
  useEffect(() => {
    if (userId && activeStep === 1) {
      setActiveStep(2);
    }
  }, [userId, activeStep]);

  const isWizardReallyCompleted = userId && isCompleted && missingWizardItems.length === 0;

  // Do not render if already completed OR userProfile isn't loaded yet
  if (userId && !userProfile) return null;
  if (isWizardReallyCompleted) return null;

  // Render ONLY if there are missing items to onboarding
  if (userId && missingWizardItems.length === 0) {
    return null;
  }

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

  const handlePhoneChange = (e) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  // Search Address Autocomplete
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    setIsSearching(true);
    setShowDropdown(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 800);
  };

  const handleSelectResult = (result) => {
    setSearchQuery(result.displayName);
    setServiceAreaLocation({ lat: result.lat, lng: result.lng });
    setShowDropdown(false);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getCurrentLocation();
      setServiceAreaLocation({ lat: loc.lat, lng: loc.lng });
      
      const result = await reverseGeocode(loc.lat, loc.lng);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      showToast('Location permission denied or unavailable.', 'error');
    } finally {
      setIsLocating(false);
    }
  };

  const handleDragEnd = async (pos) => {
    setServiceAreaLocation(pos);
    try {
      const result = await reverseGeocode(pos.lat, pos.lng);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      console.error('Failed reverse geocoding on drag end', e);
    }
  };

  // Trigger Geolocation request
  const requestLocation = async () => {
    setIsGeoLoading(true);
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
      setGeoState('granted');
      setServiceAreaLocation({ lat: loc.lat, lng: loc.lng });
      setAddressDetails(prev => ({ ...prev, lat: loc.lat, lng: loc.lng }));
      showToast('Location permission granted!', 'success');
    } catch (err) {
      showToast(err.message || 'Location access denied.', 'error');
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

    // --- Tasker Steps Flow (1: Auth, 2: Skills, 3: Enable Access, 4: Service Area, 5: Profile/Contact) ---
    if (role === 'tasker') {
      if (activeStep === 1) {
        if (!userId) {
          setError('Please sign in or sign up to continue.');
          return;
        }
        setActiveStep(2);
      } else if (activeStep === 2) {
        if (selectedSkills.length === 0) {
          setError('Please select at least one skill task.');
          return;
        }
        setActiveStep(3);
      } else if (activeStep === 3) {
        setActiveStep(4);
      } else if (activeStep === 4) {
        if (!serviceAreaLocation.lat || !serviceAreaLocation.lng) {
          setError('Please define your service scope center.');
          return;
        }
        setActiveStep(5);
      } else if (activeStep === 5) {
        if (!name.trim()) {
          setError('Your full name is required.');
          return;
        }
        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length !== 10) {
          setError('Please enter a valid 10-digit phone number.');
          return;
        }
        handleDone();
      }
    }

    // --- Poster Steps Flow (1: Auth, 2: Profile/Name/Phone, 3: Enable Access, 4: Address Picker) ---
    if (role === 'poster') {
      if (activeStep === 1) {
        if (!userId) {
          setError('Please sign in or sign up to continue.');
          return;
        }
        setActiveStep(2);
      } else if (activeStep === 2) {
        if (!name.trim()) {
          setError('Your full name is required.');
          return;
        }
        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length !== 10) {
          setError('Please enter a valid 10-digit phone number.');
          return;
        }
        setActiveStep(3);
      } else if (activeStep === 3) {
        setActiveStep(4);
      } else if (activeStep === 4) {
        if (!addressDetails.completeAddress) {
          setError('Please search and pin your address on the map.');
          return;
        }
        if (!addressDetails.landmark.trim()) {
          setError('Please enter the nearest landmark.');
          return;
        }
        handleDone();
      }
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
      const rawPhone = phone.replace(/\D/g, '');
      
      let payload = {
        name: name.trim(),
        phone: rawPhone,
        verifiedPhone: rawPhone
      };

      if (role === 'tasker') {
        payload = {
          ...payload,
          skills: selectedSkills,
          coverageRadius: coverageRadius,
          coverageLevel: coverageRadius === 20000 ? 'flexible' : coverageRadius === 10000 ? 'local' : 'nearby',
          serviceAreaName: searchQuery || 'Primary Service Area',
          locationStr: `POINT(${serviceAreaLocation.lng} ${serviceAreaLocation.lat})`
        };
        if (upiId && upiId.trim()) {
          payload.upiId = upiId.trim();
        }
      }

      const res = await setUserProfile(payload);
      if (res && res.success === false) {
        setError(res.error || 'Failed to update profile.');
        setIsSubmitting(false);
        return;
      }

      if (role === 'poster') {
        // Only save the address if it doesn't already exist in savedAddresses
        const isAlreadySaved = savedAddresses.some(
          addr => addr.completeAddress === addressDetails.completeAddress &&
                  addr.landmark?.trim() === addressDetails.landmark.trim()
        );
        if (!isAlreadySaved) {
          await addSavedAddress({
            lat: addressDetails.lat,
            lng: addressDetails.lng,
            completeAddress: addressDetails.completeAddress,
            landmark: addressDetails.landmark.trim(),
            type: 'Home',
            isDefault: savedAddresses.length === 0
          });
        }
      }

      // Complete wizard!
      localStorage.setItem(`helphive_wizard_completed_${role}_${userId}`, 'true');
      showToast('Profile & settings updated successfully!', 'success');
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

  const handleRoleSwitch = async () => {
    setError('');
    const newRole = role === 'tasker' ? 'poster' : 'tasker';
    setActiveStep(1);
    await switchRole(newRole);
  };

  // Total Steps
  const totalSteps = role === 'tasker' ? 5 : 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm modal-backdrop-open"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-[32px] rounded-t-[32px] flex flex-col h-[92vh] sm:h-[85vh] max-h-[800px] overflow-hidden shadow-2xl modal-content-open text-left"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-white shrink-0 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">
              {role === 'tasker' ? 'Apex Operator Calibration' : 'Fixer Contractor Calibration'}
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRoleSwitch}
                className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Switch to {role === 'tasker' ? 'Fixer' : 'Operator'}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center space-x-2 pt-1">
            {Array.from({ length: totalSteps }).map((_, idx) => {
              const isPassed = activeStep > idx + 1;
              const isActive = activeStep === idx + 1;
              return (
                <div key={idx} className="flex-1 flex flex-col space-y-1">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${
                    isPassed ? 'bg-green-500' : isActive ? 'bg-primary' : 'bg-gray-100'
                  }`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50/50">
          
          {error && (
            <div className="mb-4 text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 animate-pulse">
              {error}
            </div>
          )}

          {/* Step 1: Authentication (Common for both flows) */}
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

          {/* --- TASKER FLOW --- */}
          {role === 'tasker' && (
            <>
              {/* Step 2: Skills Selection */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Select Specialist Classes</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Select tactical archetypes &amp; skill trees you want to execute.</p>
                  </div>
                  
                  <div className="space-y-8 pt-1">
                    {/* On-site Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 px-1">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span className="text-xs font-medium text-slate-700 tracking-wide">Field Ops &amp; Physical Archetypes</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {GAME_SKILLS.filter(s => s.type === 'physical').map((skill) => {
                          const isSelected = selectedSkills.includes(skill.id);
                          const SkillIcon = skill.icon || Zap;
                          return (
                            <button
                              key={skill.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedSkills(selectedSkills.filter(id => id !== skill.id));
                                } else {
                                  setSelectedSkills([...selectedSkills, skill.id]);
                                }
                              }}
                              className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-center transition-all cursor-pointer min-h-[96px] ${
                                isSelected 
                                  ? 'border-primary bg-primary/[0.03] text-primary shadow-xs shadow-primary/10' 
                                  : 'border-border bg-white text-dark hover:border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-primary text-white rounded-full flex items-center justify-center shadow-xs animate-[scaleIn_150ms_ease-out]">
                                  <Check className="w-2.5 h-2.5 stroke-[4]" />
                                </div>
                              )}
                              <SkillIcon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                              <span className="text-xs font-black tracking-tight leading-tight">{skill.shortLabel || skill.label}</span>
                              <span className="text-[9.5px] text-slate-400 font-medium line-clamp-1 mt-0.5">{skill.tagline}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Online Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 px-1">
                        <Wifi className="w-3 h-3 text-primary shrink-0" />
                        <span className="text-xs font-medium text-slate-700 tracking-wide">Cyber &amp; Remote Archetypes</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {GAME_SKILLS.filter(s => s.type === 'remote').map((skill) => {
                          const isSelected = selectedSkills.includes(skill.id);
                          const SkillIcon = skill.icon || Zap;
                          return (
                            <button
                              key={skill.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedSkills(selectedSkills.filter(id => id !== skill.id));
                                } else {
                                  setSelectedSkills([...selectedSkills, skill.id]);
                                }
                              }}
                              className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-center transition-all cursor-pointer min-h-[96px] ${
                                isSelected 
                                  ? 'border-primary bg-primary/[0.03] text-primary shadow-xs shadow-primary/10' 
                                  : 'border-border bg-white text-dark hover:border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-primary text-white rounded-full flex items-center justify-center shadow-xs animate-[scaleIn_150ms_ease-out]">
                                  <Check className="w-2.5 h-2.5 stroke-[4]" />
                                </div>
                              )}
                              <SkillIcon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                              <span className="text-xs font-black tracking-tight leading-tight">{skill.shortLabel || skill.label}</span>
                              <span className="text-[9.5px] text-slate-400 font-medium line-clamp-1 mt-0.5">{skill.tagline}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="pt-4 border-t border-border flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary text-white border border-primary">
                        NEW
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">Newly Added</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                        <Flame className="w-2.5 h-2.5 fill-current text-white" />
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">High Demand</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                        <Zap className="w-2.5 h-2.5 fill-current text-white" />
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">Quick Match</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Service Scope Area */}
              {activeStep === 4 && (
                <div className="space-y-4 flex flex-col h-full min-h-[380px]">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Set Sector Patrol Range</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Your radar scanner will ping bounties broadcast within this sector perimeter.</p>
                  </div>

                  {/* Map container */}
                  <div className="flex-1 relative min-h-[220px] rounded-2xl overflow-hidden border border-border mt-2">
                    {/* Autocomplete Search */}
                    <div className="absolute top-3 left-3 right-3 z-20" ref={dropdownRef}>
                      <div className="relative shadow-md rounded-xl">
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={handleSearchChange}
                          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                          className="w-full bg-white border-none rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Search sector base coordinates..."
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-primary animate-spin" />
                        )}
                      </div>
                      
                      {showDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-44 overflow-y-auto">
                          {searchResults.map((result, idx) => (
                            <div 
                              key={idx}
                              onClick={() => handleSelectResult(result)}
                              className="p-2.5 border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors flex items-start space-x-2 text-[11px] font-semibold text-dark"
                            >
                              <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{result.displayName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <MapView
                      center={[serviceAreaLocation.lat, serviceAreaLocation.lng]}
                      zoom={coverageRadius > 10000 ? 10 : coverageRadius > 5000 ? 11 : 12}
                      draggable={true}
                      onDragEnd={handleDragEnd}
                      coverageRadius={coverageRadius}
                      height="100%"
                    />

                    {/* Labeled GPS Button */}
                    <button 
                      onClick={handleUseCurrentLocation}
                      disabled={isLocating}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-100 text-gray-600 hover:text-primary hover:border-primary/30 hover:shadow-xl active:scale-[0.95] transition-all cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLocating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="text-[11px] font-bold">
                        {isLocating ? 'Pinging GPS...' : 'Ping Current GPS'}
                      </span>
                    </button>
                  </div>

                  {/* Radius Selection */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Radar Perimeter Radius</label>
                    <div className="flex space-x-2">
                      {[
                        { val: 5000, label: '5 km', desc: 'Nearby Sector' },
                        { val: 10000, label: '10 km', desc: 'Local Sector' },
                        { val: 20000, label: '20 km', desc: 'Extended Sector' }
                      ].map((rad) => {
                        const isRadSelected = coverageRadius === rad.val;
                        return (
                          <button
                            key={rad.val}
                            onClick={() => setCoverageRadius(rad.val)}
                            className={`flex-1 py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                              isRadSelected
                                ? 'border-primary bg-primary/5 text-primary font-black'
                                : 'border-border bg-white text-gray-600 font-bold hover:border-gray-300'
                            }`}
                          >
                            <div className="text-xs">{rad.label}</div>
                            <div className="text-[9px] opacity-75">{rad.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Contact & Profile Details */}
              {activeStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Operator Profile &amp; Contact Details</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Set your callsign and direct contact phone to coordinate directly with posters.</p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-500">Operator callsign / full name</label>
                      <div className="flex items-center bg-gray-50 border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Felix Wing"
                          className="w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-500">Comms phone number</label>
                      <div className="flex items-center bg-gray-50 border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="tel"
                          value={phone}
                          maxLength={12}
                          onChange={handlePhoneChange}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Common Step 3: Enable Access (Location & Notification Permissions) */}
          {activeStep === 3 && (
            <div className="space-y-6 py-2 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-dark leading-tight">Activate Comms &amp; Sector Radar</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1 max-w-[280px] mx-auto">
                  To detect sector bounties on radar and receive priority comms dispatches, activate system uplinks.
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
                      <p className="text-xs font-bold text-dark">GPS Sector Radar</p>
                      <p className="text-[10px] font-semibold text-gray-400">Used to sync sector grid with your live operational vector</p>
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
                      <p className="text-xs font-bold text-dark">Priority Comms Dispatches</p>
                      <p className="text-[10px] font-semibold text-gray-400">Used to broadcast incoming bounty pings and crew keycode updates</p>
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

          {/* --- POSTER FLOW --- */}
          {role === 'poster' && (
            <>
              {/* Step 2: Contact Details */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Fixer Identity &amp; Callsign</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Operators will see this identity and comms number on locked contracts.</p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-500">Fixer callsign / name</label>
                      <div className="flex items-center bg-white border border-border focus-within:border-primary rounded-xl px-3 h-12">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Priya Sharma"
                          className="w-full bg-transparent border-0 px-2.5 text-xs font-semibold outline-none text-dark"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-500">Direct comms phone number</label>
                      <div className="flex items-center bg-white border border-border focus-within:border-primary rounded-xl px-3 h-12">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="tel"
                          value={phone}
                          maxLength={12}
                          onChange={handlePhoneChange}
                          placeholder="e.g. 987-654-3210"
                          className="w-full bg-transparent border-0 px-2.5 text-xs font-semibold outline-none text-dark"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Address Setup */}
              {activeStep === 4 && (
                <div className="space-y-4 flex flex-col h-full min-h-[380px]">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Primary Base Coordinates</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Set your headquarters or drop zone to broadcast bounties with zero delay.</p>
                  </div>

                  {/* Map picker wrapper */}
                  <div className="flex-1 min-h-[220px] relative rounded-2xl overflow-hidden border border-border mt-1">
                    <LocationPicker
                      initialLat={addressDetails.lat}
                      initialLng={addressDetails.lng}
                      onLocationChange={(loc) => {
                        setAddressDetails(prev => ({
                          ...prev,
                          lat: loc.lat,
                          lng: loc.lng,
                          completeAddress: loc.completeAddress
                        }));
                      }}
                    />
                  </div>

                   {/* Landmark detail */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-500">Sector Landmark / Drop Details</label>
                    <input
                      type="text"
                      value={addressDetails.landmark}
                      onChange={(e) => setAddressDetails(prev => ({ ...prev, landmark: e.target.value }))}
                      placeholder="e.g. Near Community Center, opposite park"
                      className="bg-white border border-border focus:border-primary rounded-xl px-3 h-10 w-full text-xs font-semibold outline-none text-dark"
                    />
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-white border-t border-border shrink-0 flex items-center space-x-3 pb-8 sm:pb-4">
          {userId ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="py-3 px-4 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 text-red-500 font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
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
                className="py-3 px-4 rounded-xl border border-border font-semibold text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-semibold">Back</span>
              </button>
            )
          )}

          <button
            onClick={handleNext}
            disabled={isSubmitting || (activeStep === 1 && !userId)}
            className="flex-1 bg-primary hover:bg-primary/95 text-white py-3 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all font-bold flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="text-xs font-bold">
                  {((role === 'tasker' && activeStep === 5) || (role === 'poster' && activeStep === 4)) 
                    ? 'Complete & continue' 
                    : 'Save & next'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupWizardModal;
