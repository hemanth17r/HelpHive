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
  Smartphone
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';
import { ToastContext } from '../store/ToastContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { SKILLS } from '../config/constants';
import { searchAddress, reverseGeocode } from '../utils/geocoding';
import { getCurrentLocation } from '../utils/location';
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

const SetupWizardModal = () => {
  const { 
    role, 
    userId, 
    userProfile, 
    setUserProfile, 
    savedAddresses = [], 
    addSavedAddress,
    realLocation, 
    setRealLocation,
    switchRole
  } = useContext(AppContext);

  const { subscribeToPush, pushSupported, pushPermission } = useContext(NotificationContext);
  const { showToast } = useContext(ToastContext);
  const { missingItems, hasValidNameAndPhone } = useProfileCompletion();

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
    return realLocation || { lat: 12.9716, lng: 77.5946 };
  });
  const [coverageRadius, setCoverageRadius] = useState(5000);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Profile fields state (Common)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');

  // --- Poster / Hirer State ---
  // Address Setup State
  const [addressDetails, setAddressDetails] = useState(() => {
    return {
      lat: realLocation?.lat || 12.9716,
      lng: realLocation?.lng || 77.5946,
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
        if (prev.lat === 12.9716 && prev.lng === 77.5946) {
          return { lat: realLocation.lat, lng: realLocation.lng };
        }
        return prev;
      });
      setAddressDetails(prev => {
        if (prev.lat === 12.9716 && prev.lng === 77.5946) {
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

  // 2. Pre-fill states from userProfile when available
  useEffect(() => {
    if (userProfile) {
      // Name
      const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
      setName(cleanName);

      // Phone
      const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
      setPhone(formatPhoneNumber(cleanPhone));

      // UPI
      setUpiId(userProfile.upiId || '');

      // Skills
      setSelectedSkills(userProfile.skills || []);

      // Service Area Coordinates
      if (userProfile.serviceAreaLat && userProfile.serviceAreaLng) {
        setServiceAreaLocation({
          lat: userProfile.serviceAreaLat,
          lng: userProfile.serviceAreaLng
        });
        setMapKey(prev => prev + 1);
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
    if (userProfile && !hasInitializedStepRef.current) {
      hasInitializedStepRef.current = true;
      
      if (role === 'tasker') {
        const hasSkills = userProfile.skills && userProfile.skills.length > 0;
        const hasServiceArea = userProfile.serviceAreaLat && userProfile.serviceAreaLng && userProfile.serviceAreaName;
        
        const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
        const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
        const hasProfileAndUpi = cleanName.trim() && cleanPhone.trim() && userProfile.upiId;

        if (!hasSkills) {
          setActiveStep(1);
        } else if (!hasServiceArea) {
          setActiveStep(2);
        } else if (!hasProfileAndUpi) {
          setActiveStep(3);
        } else {
          setActiveStep(4);
        }
      } else if (role === 'poster') {
        const cleanName = userProfile.name === 'New User' || userProfile.name === 'Guest User' ? '' : userProfile.name || '';
        const cleanPhone = userProfile.phone === 'Add Phone' ? '' : userProfile.phone || '';
        const hasProfile = cleanName.trim() && cleanPhone.trim();
        
        const hasAddress = savedAddresses.length > 0;

        if (!hasProfile) {
          setActiveStep(1);
        } else if (!hasAddress) {
          setActiveStep(2);
        } else {
          setActiveStep(3);
        }
      }
    }
  }, [userProfile, role, savedAddresses]);

  // Check if wizard completed flag is set
  const isCompleted = localStorage.getItem(`helphive_wizard_completed_${role}_${userId}`) === 'true';

  // Do not render if already completed OR userProfile isn't loaded yet
  if (!userId || !userProfile || isCompleted) return null;

  // Render ONLY if there are missing items to onboarding
  if (missingItems.length === 0) {
    // If no missing items but flag not set, auto-mark completed
    localStorage.setItem(`helphive_wizard_completed_${role}_${userId}`, 'true');
    return null;
  }

  // --- Helper Methods ---

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
    setMapKey(prev => prev + 1);
    setShowDropdown(false);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setServiceAreaLocation({ lat: loc.lat, lng: loc.lng });
      setMapKey(prev => prev + 1);
      
      const result = await reverseGeocode(loc.lat, loc.lng);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      showToast('Location permission denied or unavailable.', 'error');
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

    // --- Tasker Steps Flow (1: Skills, 2: Service Area, 3: Profile/UPI, 4: Permissions) ---
    if (role === 'tasker') {
      if (activeStep === 1) {
        if (selectedSkills.length === 0) {
          setError('Please select at least one skill task.');
          return;
        }
        setActiveStep(2);
      } else if (activeStep === 2) {
        if (!serviceAreaLocation.lat || !serviceAreaLocation.lng) {
          setError('Please define your service scope center.');
          return;
        }
        setActiveStep(3);
      } else if (activeStep === 3) {
        if (!name.trim()) {
          setError('Your full name is required.');
          return;
        }
        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length !== 10) {
          setError('Please enter a valid 10-digit phone number.');
          return;
        }
        if (!upiId.trim()) {
          setError('A UPI Payout ID is required to receive earnings.');
          return;
        }
        if (!upiId.includes('@')) {
          setError('Please enter a valid UPI ID (e.g. name@upi).');
          return;
        }
        setActiveStep(4);
      } else if (activeStep === 4) {
        handleDone();
      }
    }

    // --- Poster Steps Flow (1: Profile/Name/Phone, 2: Address Picker, 3: Permissions) ---
    if (role === 'poster') {
      if (activeStep === 1) {
        if (!name.trim()) {
          setError('Your full name is required.');
          return;
        }
        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length !== 10) {
          setError('Please enter a valid 10-digit phone number.');
          return;
        }
        setActiveStep(2);
      } else if (activeStep === 2) {
        if (!addressDetails.completeAddress) {
          setError('Please search and pin your address on the map.');
          return;
        }
        if (!addressDetails.landmark.trim()) {
          setError('Please enter the nearest landmark.');
          return;
        }
        setActiveStep(3);
      } else if (activeStep === 3) {
        handleDone();
      }
    }
  };

  const handleBack = () => {
    setError('');
    if (activeStep > 1) {
      setActiveStep(prev => prev - 1);
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
          upiId: upiId.trim(),
          skills: selectedSkills,
          coverageRadius: coverageRadius,
          coverageLevel: coverageRadius === 20000 ? 'extended' : coverageRadius === 10000 ? 'local' : 'nearby',
          serviceAreaName: searchQuery || 'Primary Service Area',
          locationStr: `POINT(${serviceAreaLocation.lng} ${serviceAreaLocation.lat})`
        };
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
    } catch (err) {
      console.error('Error completing setup wizard:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSwitch = async () => {
    setError('');
    const newRole = role === 'tasker' ? 'poster' : 'tasker';
    setActiveStep(1);
    await switchRole(newRole);
  };

  // Total Steps
  const totalSteps = role === 'tasker' ? 4 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs modal-backdrop-open">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[32px] rounded-t-[32px] flex flex-col h-[92vh] sm:h-[85vh] max-h-[800px] overflow-hidden shadow-2xl modal-content-open text-left">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-white shrink-0 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-dark leading-none">Configure HelpHive</h2>
              <span className="text-[10px] font-black uppercase text-primary tracking-widest mt-1.5 block">
                {role === 'tasker' ? 'Helper Setup' : 'Hirer Setup'}
              </span>
            </div>
            <button
              onClick={handleRoleSwitch}
              className="text-[10px] font-extrabold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              Switch to {role === 'tasker' ? 'Hirer' : 'Helper'}
            </button>
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

          {/* --- TASKER FLOW --- */}
          {role === 'tasker' && (
            <>
              {/* Step 1: Skills Selection */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">What jobs can you do?</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Select all categories of work you are comfortable doing.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {SKILLS.map((skill) => {
                      const isSelected = selectedSkills.includes(skill.id);
                      const SkillIcon = skill.icon;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSkills(selectedSkills.filter(id => id !== skill.id));
                            } else {
                              setSelectedSkills([...selectedSkills, skill.id]);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all cursor-pointer h-24 ${
                            isSelected 
                              ? 'border-primary bg-primary/5 text-primary' 
                              : 'border-border bg-white text-dark hover:border-gray-300'
                          }`}
                        >
                          <SkillIcon className={`w-6 h-6 mb-2 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                          <span className="text-xs font-black tracking-tight">{skill.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Service Scope Area */}
              {activeStep === 2 && (
                <div className="space-y-4 flex flex-col h-full min-h-[380px]">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Define your work range</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">We will match you with tasks posted inside this circle.</p>
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
                          placeholder="Search your main work location..."
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
                      key={mapKey}
                      center={[serviceAreaLocation.lat, serviceAreaLocation.lng]}
                      zoom={coverageRadius > 10000 ? 10 : coverageRadius > 5000 ? 11 : 12}
                      draggable={true}
                      onDragEnd={handleDragEnd}
                      coverageRadius={coverageRadius}
                      height="100%"
                    />

                    {/* Floating GPS Button */}
                    <button 
                      onClick={handleUseCurrentLocation}
                      className="absolute bottom-4 right-3 z-20 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer border border-gray-100"
                      aria-label="Find current location"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Radius Selection */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">Coverage Radius</label>
                    <div className="flex space-x-2">
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

              {/* Step 3: Contact & UPI Payout Details */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Payout & Contact</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Configure your personal and direct payment transfer options.</p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Full Name</label>
                      <div className="flex items-center bg-white border border-border focus-within:border-primary rounded-xl px-3 h-12">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full bg-transparent border-0 px-2.5 text-xs font-semibold outline-none text-dark"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Phone Number</label>
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

                    {/* UPI Payout ID */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
                        <span>UPI ID (For payouts)</span>
                        <span className="text-[9px] text-green-600 font-extrabold normal-case bg-green-50 px-1.5 py-0.5 rounded-md">Direct Bank Transfer</span>
                      </label>
                      <div className="flex items-center bg-white border border-border focus-within:border-primary rounded-xl px-3 h-12">
                        <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="e.g. ramesh@okaxis"
                          className="w-full bg-transparent border-0 px-2.5 text-xs font-semibold outline-none text-dark"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* --- POSTER FLOW --- */}
          {role === 'poster' && (
            <>
              {/* Step 1: Contact Details */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Introduce Yourself</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Helpers will see this name and verified number on active tasks.</p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Full Name</label>
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
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Phone Number</label>
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

              {/* Step 2: Address Setup */}
              {activeStep === 2 && (
                <div className="space-y-4 flex flex-col h-full min-h-[380px]">
                  <div>
                    <h3 className="text-lg font-black text-dark leading-tight">Where do you live?</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Set a primary home or business address to post jobs faster.</p>
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
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400">Nearest Landmark</label>
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

          {/* Step Last (Permissions Step for both flows) */}
          {((role === 'tasker' && activeStep === 4) || (role === 'poster' && activeStep === 3)) && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-dark leading-tight">Enable App Access</h3>
                <p className="text-xs font-semibold text-gray-400 mt-1">Enable device features for real-time tracking and dispatch matching.</p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Geolocation Card */}
                <div className="bg-white border border-border rounded-2xl p-4 flex items-start space-x-4 shadow-sm">
                  <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0 mt-0.5">
                    <Navigation className="w-5 h-5 fill-red-500/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-dark uppercase tracking-wide">OS Location Services</h4>
                    <p className="text-[10px] font-medium text-gray-400 leading-normal mt-1">
                      {role === 'tasker' 
                        ? 'Required to calculate distances from jobs and navigate to poster locations.'
                        : 'Required to pinpoint your address automatically and find closest taskers.'}
                    </p>
                    <div className="mt-3 flex items-center">
                      {geoState === 'granted' ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-200/30 flex items-center space-x-1.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Permission Active</span>
                        </span>
                      ) : (
                        <button
                          onClick={requestLocation}
                          disabled={isGeoLoading}
                          className="text-[10px] font-black uppercase tracking-wider bg-primary text-white hover:bg-primary/90 px-3.5 py-1.5 rounded-lg active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-70"
                        >
                          {isGeoLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Allow Location</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notifications Card */}
                <div className="bg-white border border-border rounded-2xl p-4 flex items-start space-x-4 shadow-sm">
                  <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl shrink-0 mt-0.5">
                    <Bell className="w-5 h-5 fill-yellow-600/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-dark uppercase tracking-wide">Instant Push Alerts</h4>
                    <p className="text-[10px] font-medium text-gray-400 leading-normal mt-1">
                      {role === 'tasker'
                        ? 'Required to send instant notifications as soon as jobs matching your skills are posted.'
                        : 'Required to alert you instantly when a helper accepts your task or responds.'}
                    </p>
                    <div className="mt-3 flex items-center">
                      {notifState === 'granted' ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-200/30 flex items-center space-x-1.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Permission Active</span>
                        </span>
                      ) : (
                        <button
                          onClick={requestNotifications}
                          disabled={isNotifLoading}
                          className="text-[10px] font-black uppercase tracking-wider bg-primary text-white hover:bg-primary/90 px-3.5 py-1.5 rounded-lg active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-70"
                        >
                          {isNotifLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Allow Notifications</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-white border-t border-border shrink-0 flex items-center space-x-3 pb-8 sm:pb-4">
          {activeStep > 1 && (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="py-3 px-4 rounded-xl border border-border font-extrabold text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Back</span>
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex-1 bg-primary hover:bg-primary/95 text-white py-3 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all font-black flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-80"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="text-xs font-black uppercase tracking-wider">
                  {((role === 'tasker' && activeStep === 4) || (role === 'poster' && activeStep === 3)) 
                    ? 'Complete & Continue' 
                    : 'Save & Next'}
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
