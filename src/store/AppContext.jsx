import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { SERVICE_AREAS } from '../config/serviceAreas';
import { api } from '../services/api';
import { SKILLS } from '../config/constants';
import { trackEvent, EVENTS } from '../utils/eventTracker';
import { ToastContext } from './ToastContext';
import { parseEWKBPoint, getCurrentLocation } from '../utils/location';
import { reverseGeocode } from '../utils/geocoding';

export const AppContext = createContext();

// Helper to calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
};

// Helper to parse profile data with feedbacks & reputation badges
const parseProfileData = (data, currentRole) => {
  const verifiedPhones = data.verified_phones || [];
  const parsedLoc = data.location ? parseEWKBPoint(data.location) : null;

  const feedbacks = data.feedbacks || [];
  const taskerFeedbacks = feedbacks.filter(f => f.role_context === 'tasker').map(f => f.rating);
  const posterFeedbacks = feedbacks.filter(f => f.role_context === 'poster').map(f => f.rating);

  const taskerRating = taskerFeedbacks.length > 0 
    ? parseFloat((taskerFeedbacks.reduce((sum, r) => sum + r, 0) / taskerFeedbacks.length).toFixed(1))
    : null;
  const posterRating = posterFeedbacks.length > 0
    ? parseFloat((posterFeedbacks.reduce((sum, r) => sum + r, 0) / posterFeedbacks.length).toFixed(1))
    : null;

  const taskerTasks = taskerFeedbacks.length;
  const posterTasks = posterFeedbacks.length;

  const repBadges = data.reputation_badges || [];
  const taskerBadges = repBadges.filter(b => b.role_context === 'tasker').map(b => b.badge_type);
  const posterBadges = repBadges.filter(b => b.role_context === 'poster').map(b => b.badge_type);

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    posterName: data.posterName || data.name,
    posterPhone: data.posterPhone || data.phone,
    taskerName: data.taskerName || data.name,
    taskerPhone: data.taskerPhone || data.phone,
    verifiedPhones: verifiedPhones,
    skills: data.skills || [],
    
    // Real Database Ratings and Badges
    taskerRating,
    posterRating,
    taskerTasksCompleted: taskerTasks,
    posterTasksCompleted: posterTasks,
    taskerBadges,
    posterBadges,
    taskerReviews: taskerFeedbacks,
    posterReviews: posterFeedbacks,

    // Compatibility fields
    rating: currentRole === 'tasker' ? taskerRating : posterRating,
    tasksCompleted: currentRole === 'tasker' ? taskerTasks : posterTasks,
    badges: currentRole === 'tasker' ? taskerBadges : posterBadges,
    reviews: currentRole === 'tasker' ? taskerFeedbacks : posterFeedbacks,

    bird: data.bird,
    upiId: data.upi_id || '',
    coverageRadius: data.coverage_radius,
    coverageLevel: data.coverage_level,
    serviceAreaName: data.service_area_name,
    serviceAreaLat: parsedLoc?.lat || null,
    serviceAreaLng: parsedLoc?.lng || null
  };
};

export const AppProvider = ({ children }) => {
  const { showToast } = useContext(ToastContext);


  // State to track scroll target for tasker activity screen
  const [taskerActivityScrollTarget, setTaskerActivityScrollTarget] = useState(null);

  // Global State for role & profiles
  const [role, setRole] = useState(localStorage.getItem('activeRole') || 'tasker');
  
  // Location Action Interceptor
  const [locationActionCallback, setLocationActionCallback] = useState(null);
  const [locationActionRole, setLocationActionRole] = useState('poster');
  const [userProfile, setUserProfileState] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse cached userProfile", e);
      }
    }
    return null;
  }); // { name, phone, skills, rating, tasksCompleted }
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [isProfileLoading, setIsProfileLoading] = useState(() => {
    const hasUserId = !!localStorage.getItem('userId');
    const hasCachedProfile = !!localStorage.getItem('userProfile');
    return hasUserId && !hasCachedProfile;
  });

  // Sync user profile to local cache when it changes
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('userProfile');
    }
  }, [userProfile]);
  const [selectedBird, setSelectedBird] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.bird) return parsed.bird;
      } catch (e) {
        // ignore
      }
    }
    return 'falcon';
  }); // Bird avatar selection
  const [isAdmin, setIsAdmin] = useState(false); // Admin dashboard access

  // Always online
  const [isOnline, setIsOnlineState] = useState(true);
  
  // Navigation stack state
  const [screenStack, setScreenStack] = useState(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('access_token') || search.includes('code=')) {
      return ['auth_loading'];
    }
    const activeRole = localStorage.getItem('activeRole');
    const storedUserId = localStorage.getItem('userId');
    if (activeRole && storedUserId) {
      const path = window.location.pathname.replace(/^\/+/g, '').replace(/\/+$/g, '');
      const validScreens = ['notifications', 'tasker_activity', 'my_profile', 'about_us', 'need_help', 'job_history', 'address_book'];
      if (validScreens.includes(path)) {
        return [activeRole === 'tasker' ? 'tasker_home' : 'poster_home', path];
      }
      return [activeRole === 'tasker' ? 'tasker_home' : 'poster_home'];
    }
    return ['landing'];
  });
  const [routeParams, setRouteParams] = useState(null);
  const currentScreen = screenStack[screenStack.length - 1];

  // Early viewport reset on OAuth redirect return.
  // When returning from Google's login page, mobile browsers may render the
  // page at an incorrect zoom level (appearing as "desktop view"). This
  // effect fires once on mount to force a viewport re-evaluation as early as
  // possible, before the auth callback processing completes.
  useEffect(() => {
    const isOAuthReturn =
      window.location.hash.includes('access_token') ||
      window.location.search.includes('code=');
    if (isOAuthReturn) {
      const vp = document.querySelector('meta[name="viewport"]');
      if (vp) {
        const original = vp.getAttribute('content');
        vp.setAttribute('content', 'width=device-width, initial-scale=0.99');
        requestAnimationFrame(() => {
          vp.setAttribute('content', original);
        });
      }
    }
  }, []);

  // Location States
  const [locationPermission, setLocationPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [userLocation, setUserLocation] = useState(() => {
    const saved = localStorage.getItem('userLocation');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved userLocation", e);
      }
    }
    return null;
  });
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [realLocation, setRealLocation] = useState(() => {
    const saved = localStorage.getItem('userLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.lat && parsed?.lng) {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return null;
  }); // Actual GPS coordinates {lat, lng}
  
  const [isLocationModalOpen, setLocationModalOpen] = useState(false);
  const [showBlinkitPrompt, setShowBlinkitPrompt] = useState(false);
  
  // Saved Addresses
  const [savedAddresses, setSavedAddressesState] = useState(() => {
    const saved = localStorage.getItem('helphive_addresses_v2');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  });

  const [hasMigratedLocalAddresses, setHasMigratedLocalAddresses] = useState(false);

  // Sync addresses with DB when user logs in
  useEffect(() => {
    const syncAddresses = async () => {
      if (!userId) return;
      const { data } = await api.fetchAddresses(userId);
      if (data) {
        if (data.length > 0) {
          setSavedAddressesState(data);
          setHasMigratedLocalAddresses(true); // Don't migrate if DB already has addresses
        } else if (!hasMigratedLocalAddresses) {
          // Migrate local addresses to DB ONCE
          const localAddresses = JSON.parse(localStorage.getItem('helphive_addresses_v2') || '[]');
          if (Array.isArray(localAddresses) && localAddresses.length > 0) {
            for (const addr of localAddresses) {
              await api.createAddress(userId, addr);
            }
            const { data: newData } = await api.fetchAddresses(userId);
            if (newData) {
              setSavedAddressesState(newData);
            }
          }
          setHasMigratedLocalAddresses(true);
        }
      }
    };
    syncAddresses();
  }, [userId, hasMigratedLocalAddresses]);

  // Keep local storage in sync for offline/guest
  useEffect(() => {
    localStorage.setItem('helphive_addresses_v2', JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  // On startup or login, manage user location detection
  useEffect(() => {
    const initLocation = async () => {
      // 1. If we already have a userLocation from state/local storage, we can proceed
      if (userLocation) {
        if (!realLocation && userLocation.lat && userLocation.lng) {
          setRealLocation({ lat: userLocation.lat, lng: userLocation.lng });
        }
        return;
      }

      // 2. If logged in, check database first
      if (userId) {
        try {
          const { data } = await api.fetchUserLocation(userId);
          if (data && data.area_name) {
            const loc = {
              id: 'db_saved',
              name: data.area_name,
              lat: data.latitude,
              lng: data.longitude
            };
            setUserLocation(loc);
            localStorage.setItem('userLocation', JSON.stringify(loc));
            setRealLocation({ lat: data.latitude, lng: data.longitude });
            return;
          }
        } catch (e) {
          console.error("Failed to fetch user location from DB:", e);
        }
      }

      // 3. Try to check permission and auto-detect location
      if (navigator.geolocation && navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'granted') {
            const coords = await getCurrentLocation();
            const details = await reverseGeocode(coords.lat, coords.lng);
            if (details) {
              const loc = {
                id: 'detected',
                name: details.displayName,
                lat: details.lat,
                lng: details.lng
              };
              setUserLocation(loc);
              setRealLocation(coords);
              localStorage.setItem('userLocation', JSON.stringify(loc));
              if (userId) {
                await api.upsertUserLocation({
                  user_id: userId,
                  area_name: details.displayName,
                  city: details.displayName.split(',')[1]?.trim() || 'Pan India',
                  latitude: details.lat,
                  longitude: details.lng,
                  updated_at: new Date().toISOString()
                });
              }
              return;
            }
          }
        } catch (e) {
          console.error("Startup geolocation check error", e);
        }
      }

      // 4. If still no location, do not trigger the Blinkit prompt (friction removed)
      // setShowBlinkitPrompt(true);
    };

    initLocation();
  }, [userId]);

  // New Address Methods
  const addSavedAddress = async (newAddress) => {
    const isFirst = savedAddresses.length === 0;
    if (userId) {
      const { data, error } = await api.createAddress(userId, { ...newAddress, isDefault: isFirst });
      if (data) {
        setSavedAddressesState(prev => {
          const newAddresses = [data, ...prev].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0));
          return newAddresses;
        });
        return data;
      }
      // DB write failed — log it and fall back to local state so the address is not lost
      console.error('[addSavedAddress] DB write failed, falling back to local state:', error);
    }
    // Fallback: local-only (guest or DB failure)
    const newAddrWithId = { ...newAddress, id: Date.now().toString(), isDefault: isFirst, lastUsedAt: new Date().toISOString() };
    setSavedAddressesState(prev => {
      const newAddresses = [newAddrWithId, ...prev].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0));
      return newAddresses;
    });
    return newAddrWithId;
  };

  const updateSavedAddress = async (addressId, updates) => {
    if (userId) {
      const { data, error } = await api.updateAddress(addressId, updates);
      if (data) {
        setSavedAddressesState(prev => {
          const newAddresses = prev.map(a => a.id === addressId ? data : a).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0));
          return newAddresses;
        });
        return;
      }
      // DB write failed — log it and fall back to updating local state so UI stays consistent
      console.error('[updateSavedAddress] DB write failed, falling back to local state:', error);
    }
    // Fallback: local-only (guest or DB failure)
    setSavedAddressesState(prev => {
      const newAddresses = prev.map(a => a.id === addressId ? { ...a, ...updates } : a).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0));
      return newAddresses;
    });
  };

  const removeSavedAddress = async (addressId) => {
    if (userId) {
      await api.deleteAddress(addressId);
    }
    setSavedAddressesState(prev => prev.filter(a => a.id !== addressId));
  };

  const setDefaultAddress = async (addressId) => {
    if (userId) {
      // Set all others to false, then set target to true
      const promises = savedAddresses.map(a => {
        if (a.id === addressId && !a.isDefault) {
          return api.updateAddress(a.id, { isDefault: true, lastUsedAt: new Date().toISOString() });
        } else if (a.id !== addressId && a.isDefault) {
          return api.updateAddress(a.id, { isDefault: false });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      const { data } = await api.fetchAddresses(userId);
      if (data) setSavedAddressesState(data);
    } else {
      setSavedAddressesState(prev => {
        const newAddresses = prev.map(a => 
          a.id === addressId ? { ...a, isDefault: true, lastUsedAt: new Date().toISOString() } : { ...a, isDefault: false }
        ).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0));
        return newAddresses;
      });
    }
  };
  
  // Job and tasker registers
  const [jobs, setJobs] = useState([]);
  const [taskers, setTaskers] = useState([]);

  // Fetch jobs from API
  const fetchJobs = useCallback(async () => {
    const { data, error } = await api.fetchJobs();
    if (data) {
      const mappedJobs = data.map(j => {
        let expiresAt = null;
        let cleanDesc = j.description || '';
        const match = cleanDesc.match(/\s*\[Time: ([^\]]+)\]/);
        if (match) {
          expiresAt = match[1];
          cleanDesc = cleanDesc.replace(/\s*\[Time: [^\]]+\]/, '');
        } else {
          expiresAt = new Date(j.created_at).toISOString();
        }

        const coords = parseEWKBPoint(j.location) || { lng: j.lng || 0, lat: j.lat || 0 };
        return {
          ...j,
          description: cleanDesc,
          expiresAt: expiresAt,
          posterId: j.posterId || j.poster_id,
          taskerId: j.taskerId || j.tasker_id,
          skillId: j.skillId || j.skill_id,
          peopleNeeded: j.peopleNeeded || j.people_needed,
          timePosted: j.timePosted || j.created_at,
          lng: coords.lng,
          lat: coords.lat,
        };
      });

      // Check for active jobs that should be automatically expired (unfulfilled)
      // after 5 days from their selected time (expiresAt).
      const now = new Date();
      const updatedJobs = mappedJobs.map(j => {
        if (j.status !== 'completed' && j.status !== 'expired') {
          const selectedDate = new Date(j.expiresAt);
          if (!isNaN(selectedDate.getTime())) {
            const diffTime = now - selectedDate;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays > 5) {
              // Update in backend asynchronously
              api.updateJob(j.id, { status: 'expired', v2_status: 'expired' }).then();
              return { ...j, status: 'expired', v2_status: 'expired' };
            }
          }
        }
        return j;
      });

      setJobs(updatedJobs);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchJobs();

    const sub = api.subscribeToJobs(() => {
      fetchJobs();
    });

    const pollInterval = setInterval(() => {
      fetchJobs();
    }, 30000);

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [fetchJobs]);

  // Fetch profile if returning user
  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        const hasCachedProfile = !!localStorage.getItem('userProfile');
        if (!hasCachedProfile) {
          setIsProfileLoading(true);
        }
        // Validate that we have a valid active Supabase Auth session first
        const { data: sessionData } = await api.getSession();
        if (!sessionData?.session) {
          console.warn('[Auth] No active Supabase session found on startup. Logging out.');
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('userProfile');
          setUserId(null);
          setRole(null);
          setUserProfileState(null);
          setScreenStack(['landing']);
          setIsProfileLoading(false);
          return;
        }

        const { data } = await api.fetchProfile(userId);
        if (data) {
          const activeRole = localStorage.getItem('activeRole') || data.role || 'tasker';
          const updatedProfile = parseProfileData(data, activeRole);

          setUserProfileState(updatedProfile);
          // Sync with local cache
          localStorage.setItem('userProfile', JSON.stringify(updatedProfile));

          if (data.bird) setSelectedBird(data.bird);
          setIsAdmin(data.is_admin === true);
          // Always force online status in the database and frontend
          setIsOnlineState(true);
          localStorage.setItem('isOnline', 'true');
          if (data.is_online !== true) {
            api.updateProfile(data.id, { is_online: true }).catch(console.error);
          }
          setRole(activeRole);
          localStorage.setItem('activeRole', activeRole);
          trackEvent(EVENTS.LOGIN, { userId: data.id, role: activeRole });
        } else {
          // Profile not found in DB (zombie state), clear local storage
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('userProfile');
          setUserId(null);
          setRole(null);
          setUserProfileState(null);
          setScreenStack(['landing']);
        }
        setIsProfileLoading(false);
      };
      fetchProfile();
    } else {
      setIsProfileLoading(false);
    }
  }, [userId]);






  const setUserProfile = async (profileData) => {
    const roleSpecificUpdates = {};
    if (profileData.verifiedPhone) {
      const currentVerified = userProfile?.verifiedPhones || [];
      if (!currentVerified.includes(profileData.verifiedPhone)) {
        roleSpecificUpdates.verifiedPhones = [...currentVerified, profileData.verifiedPhone];
      }
    }
    
    const currentUserId = userId || localStorage.getItem('userId');

    // Check phone number uniqueness
    if (profileData.phone && profileData.phone !== userProfile?.phone) {
      const { data: existingProfile } = await api.findProfileByPhone(profileData.phone);
      if (existingProfile && existingProfile.id !== currentUserId) {
        return { success: false, error: 'An account already exists with this phone number. Please log in.' };
      }
    }

    // Save previous state for rollback on failure
    const previousProfile = userProfile ? { ...userProfile } : null;
    const previousBird = selectedBird;

    // Parse coordinates if locationStr is explicitly passed
    const parsedLoc = profileData.locationStr ? parseEWKBPoint(profileData.locationStr) : null;
    const locUpdates = profileData.locationStr !== undefined ? {
      serviceAreaLat: parsedLoc?.lat || null,
      serviceAreaLng: parsedLoc?.lng || null
    } : {};

    // Optimistic update so UI reflects immediately
    setUserProfileState(prev => prev ? { ...prev, ...profileData, ...roleSpecificUpdates, ...locUpdates } : { id: currentUserId || null, ...profileData, ...roleSpecificUpdates, ...locUpdates });
    if (profileData.bird !== undefined) {
      setSelectedBird(profileData.bird);
    }

    if (currentUserId) {
      const updatesPayload = {
        name: profileData.name !== undefined ? profileData.name : userProfile?.name,
        email: profileData.email !== undefined ? profileData.email : userProfile?.email,
        phone: profileData.phone !== undefined ? profileData.phone : userProfile?.phone,
        upi_id: profileData.upiId !== undefined ? profileData.upiId : userProfile?.upiId,
        skills: profileData.skills || userProfile?.skills || [],
        bird: profileData.bird !== undefined ? profileData.bird : selectedBird,
        coverage_radius: profileData.coverageRadius !== undefined ? profileData.coverageRadius : userProfile?.coverageRadius,
        category_coverage: profileData.categoryCoverage !== undefined ? profileData.categoryCoverage : userProfile?.categoryCoverage,
        coverage_level: profileData.coverageLevel !== undefined ? profileData.coverageLevel : userProfile?.coverageLevel,
        service_area_name: profileData.serviceAreaName !== undefined ? profileData.serviceAreaName : userProfile?.serviceAreaName,
        verified_phones: roleSpecificUpdates.verifiedPhones !== undefined ? roleSpecificUpdates.verifiedPhones : (profileData.verifiedPhones || userProfile?.verifiedPhones || [])
      };

      if (profileData.locationStr !== undefined) {
        updatesPayload.location = profileData.locationStr;
      }

      const { data, error } = await api.updateProfile(currentUserId, updatesPayload);

      if (error) {
        // Rollback optimistic update on failure
        console.error('setUserProfile: DB update failed, rolling back', error);
        if (previousProfile) {
          setUserProfileState(previousProfile);
        }
        setSelectedBird(previousBird);
        return { success: false, error: 'Failed to save. Please try again.' };
      }

      if (data) {
        const dbLoc = data.location ? parseEWKBPoint(data.location) : null;
        setUserProfileState(prev => ({
          ...prev,
          ...profileData,
          ...roleSpecificUpdates,
          verifiedPhones: data.verified_phones || prev?.verifiedPhones || [],
          serviceAreaLat: dbLoc ? dbLoc.lat : prev?.serviceAreaLat,
          serviceAreaLng: dbLoc ? dbLoc.lng : prev?.serviceAreaLng
        }));
        if (data.bird) {
          setSelectedBird(data.bird);
        }
      }
      return { success: true };
    }
    return { success: false, error: 'User is not logged in.' };
  };

  const [activeTab, setActiveTabState] = useState('home'); // For tasker: 'home' | 'profile'
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    activeTabRef.current = tab;
  };
  
  // Profile Action Interceptor
  const [profileActionCallback, setProfileActionCallback] = useState(null);

  const requireProfile = (callback, isLocationSequence = false) => {
    const currentName = userProfile?.name;
    const currentPhone = userProfile?.phone;
    
    const hasValidName = currentName && currentName !== 'Guest User' && currentName !== 'New User';
    const hasValidPhone = currentPhone && currentPhone !== 'Add Phone';
    
    if (hasValidName && hasValidPhone) {
      callback();
    } else {
      setProfileActionCallback(() => callback);
    }
  };

  const requireLocation = async (requiredRole, callback) => {
    if (realLocation) {
      callback();
      return;
    }
    
    if (!navigator.geolocation) {
      callback();
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          try {
            const loc = await getCurrentLocation();
            setRealLocation(loc);
          } catch(e) {
            console.error(e);
          }
          callback();
          return;
        } else if (result.state === 'denied') {
          showToast('Location permission is blocked. Please enable it in browser settings for automatic location detection.', 'warning');
          callback();
          return;
        }
      } catch (e) {
        console.error("Permissions query error", e);
      }
    }
    
    setLocationActionRole(requiredRole);
    setLocationActionCallback(() => callback);
  };

  const completeLocationAction = async () => {
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
    } catch(e) {
      console.error("Location access denied or failed", e);
      showToast('Location permission denied. You can still proceed manually.', 'warning');
    }
    if (locationActionCallback) {
      const cb = locationActionCallback;
      setLocationActionCallback(null);
      Promise.resolve().then(() => cb()).catch(console.error);
    }
  };

  const cancelLocationAction = () => {
    if (locationActionCallback) {
      const cb = locationActionCallback;
      setLocationActionCallback(null);
      Promise.resolve().then(() => cb()).catch(console.error);
    }
  };

  const completeProfileAction = async (name, phone) => {
    console.log('completeProfileAction: starting', name, phone);
    try {
      console.log('completeProfileAction: before setUserProfile');
      const res = await setUserProfile({ name, phone, verifiedPhone: phone });
      console.log('completeProfileAction: after setUserProfile, res:', res);
      if (res && res.success === false) {
        return res;
      }
      if (profileActionCallback) {
        console.log('completeProfileAction: executing profileActionCallback asynchronously');
        const cb = profileActionCallback;
        setProfileActionCallback(null);
        
        // Execute the callback without blocking the return
        // This ensures the modal closes immediately once the DB is updated!
        Promise.resolve().then(() => cb()).catch(err => {
          console.error("Error in profile action callback:", err);
        });
      }
      return { success: true };
    } catch (e) {
      console.error('completeProfileAction: caught error', e);
      throw e;
    }
  };

  const cancelProfileAction = () => {
    setProfileActionCallback(null);
  };

  // Tasker-specific states
  const [acceptedJob, setAcceptedJob] = useState(null); 
  const [otpEntered, setOtpEntered] = useState('');

  const setIsOnline = async (online) => {
    // Force always online status
    setIsOnlineState(true);
    localStorage.setItem('isOnline', 'true');
    const currentUserId = userId || localStorage.getItem('userId');
    if (currentUserId) {
      await api.updateProfile(currentUserId, { is_online: true });
    }
  };
  
  // Poster-specific states
  const [currentPostedJob, setCurrentPostedJob] = useState(null); 
  const [crewTaskers, setCrewTaskers] = useState([]);
  const [liveStatus, setLiveStatus] = useState('posted'); // 'posted', 'crew_set', 'completed'
  const [otpGenerated, setOtpGenerated] = useState('');
  const [editJobData, setEditJobData] = useState(null);
  const [editAddressData, setEditAddressData] = useState(null);
  const [jobHistoryTab, setJobHistoryTab] = useState('active'); // 'active', 'unfulfilled', 'completed'

  // Synchronize acceptedJob with the latest state from the jobs list
  useEffect(() => {
    if (acceptedJob) {
      const latest = jobs.find(j => j.id === acceptedJob.id);
      if (latest) {
        if (
          latest.status !== acceptedJob.status ||
          latest.v2_status !== acceptedJob.v2_status ||
          latest.taskerId !== acceptedJob.taskerId ||
          latest.taskerCurrentLocation?.lat !== acceptedJob.taskerCurrentLocation?.lat ||
          latest.taskerCurrentLocation?.lng !== acceptedJob.taskerCurrentLocation?.lng ||
          latest.lat !== acceptedJob.lat ||
          latest.lng !== acceptedJob.lng ||
          latest.otpVerified !== acceptedJob.otpVerified
        ) {
          setAcceptedJob(latest);
        }
      } else {
        setAcceptedJob(null);
      }
    }
  }, [jobs, acceptedJob]);

  // Synchronize currentPostedJob with the latest state from the jobs list
  useEffect(() => {
    if (currentPostedJob) {
      const latest = jobs.find(j => j.id === currentPostedJob.id);
      if (latest) {
        if (
          latest.status !== currentPostedJob.status ||
          latest.v2_status !== currentPostedJob.v2_status ||
          latest.taskerId !== currentPostedJob.taskerId ||
          latest.taskerCurrentLocation?.lat !== currentPostedJob.taskerCurrentLocation?.lat ||
          latest.taskerCurrentLocation?.lng !== currentPostedJob.taskerCurrentLocation?.lng ||
          latest.lat !== currentPostedJob.lat ||
          latest.lng !== currentPostedJob.lng
        ) {
          setCurrentPostedJob(latest);
        }
      } else {
        setCurrentPostedJob(null);
      }
    }
  }, [jobs, currentPostedJob]);

  const deleteJob = async (jobId) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (userId) {
      await api.deleteJob(jobId);
    }
  };

  const expireJob = async (jobId) => {
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'cancelled', v2_status: 'expired' } : j)
    );
    if (userId) {
      await api.updateJob(jobId, { status: 'cancelled', v2_status: 'expired' });
    }
  };
  
  // Live Tracking state (30 seconds map pin animation)
  const [trackingTaskerPos, setTrackingTaskerPos] = useState(null); // { lat, lng }
  const [animationTick, setAnimationTick] = useState(0);
  const trackingIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  // Email notifications for coming soon
  const [leadNotifications, setLeadNotifications] = useState([]);

  // ── Navigation: push, pop, and browser history sync ──────────────────
  // Use refs so the popstate handler always reads the latest values
  // without needing to re-register the listener on every state change.
  const screenStackRef = useRef(screenStack);
  const activeTabRef = useRef('home');
  useEffect(() => { screenStackRef.current = screenStack; }, [screenStack]);

  const pushScreen = useCallback((screen, replaceStack = false, params = null) => {
    const currentActiveScreen = screenStackRef.current[screenStackRef.current.length - 1];
    if (screen === currentActiveScreen) return;

    setRouteParams(params);
    if (screen === 'landing' || screen === 'tasker_home' || screen === 'poster_home') {
      // Reset stack to base screen
      setScreenStack([screen]);
      // Replace current history entry so base screen becomes the floor
      window.history.replaceState({ screen, base: true }, '', window.location.pathname);
    } else if (replaceStack) {
      const base = role === 'tasker' ? 'tasker_home' : 'poster_home';
      setScreenStack([base, screen]);
      window.history.replaceState({ screen }, '', window.location.pathname);
    } else {
      setScreenStack(prev => [...prev, screen]);
      window.history.pushState({ screen }, '', window.location.pathname);
    }
  }, [role]);

  const popScreen = useCallback(() => {
    setRouteParams(null);
    const firstScreens = ['landing', 'tasker_home', 'poster_home'];
    if (firstScreens.includes(currentScreen) || screenStack.length <= 1) {
      return; // Block accidental exits from home screens
    }
    window.history.back(); // Triggers popstate → handled below
  }, [currentScreen, screenStack.length]);

  const refreshProfile = async () => {
    if (!userId) return;
    const { data } = await api.fetchProfile(userId);
    if (data) {
      const activeRole = localStorage.getItem('activeRole') || role || data.role || 'tasker';
      const parsedProfile = parseProfileData(data, activeRole);
      setUserProfileState(parsedProfile);
      localStorage.setItem('userProfile', JSON.stringify(parsedProfile));
    }
  };

  const switchRole = async (newRole) => {
    if (!userId) {
      setScreenStack(['landing']);
      return;
    }

    setRole(newRole);
    localStorage.setItem('activeRole', newRole);
    
    setUserProfileState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        rating: newRole === 'tasker' ? prev.taskerRating : prev.posterRating,
        tasksCompleted: newRole === 'tasker' ? prev.taskerTasksCompleted : prev.posterTasksCompleted,
        badges: newRole === 'tasker' ? prev.taskerBadges : prev.posterBadges,
        reviews: newRole === 'tasker' ? prev.taskerReviews : prev.posterReviews
      };
    });

    api.updateProfile(userId, { role: newRole }).then();
    trackEvent(EVENTS.ROLE_SWITCH, { userId, role: newRole });

    if (newRole === 'tasker') {
      pushScreen('tasker_home');
    } else {
      pushScreen('poster_home');
    }
  };

  // Sync browser back button with custom history stack (PWA-safe)
  useEffect(() => {
    // Establish a "floor" history entry so the browser always has somewhere to go
    // without leaving the app. We push TWO entries: the floor + the current screen.
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState({ screen: '__floor__', floor: true }, '', currentUrl);
    window.history.pushState({ screen: screenStackRef.current[screenStackRef.current.length - 1] || 'landing' }, '', currentUrl);

    const handlePopState = (e) => {
      const stack = screenStackRef.current;
      const tab = activeTabRef.current;

      if (e.state && e.state.floor) {
        // User hit back and landed on our floor entry — they're trying to exit.
        // If they're on a home screen with the home tab active, allow exit.
        // Otherwise, push them back into the app.
        const currentScr = stack[stack.length - 1];
        const isHome = ['landing', 'tasker_home', 'poster_home'].includes(currentScr);
        
        if (isHome && tab === 'home') {
          // Actually let them exit: go back once more to leave the app
          window.history.back();
          return;
        }
        // Not on home — push them back into the app
        window.history.pushState({ screen: currentScr }, '', window.location.pathname);

        if (!isHome && stack.length > 1) {
          // Pop from screen stack
          setScreenStack(prev => prev.slice(0, -1));
        } else if (tab !== 'home') {
          // On home screen but not home tab (e.g., profile) — switch to home tab
          setActiveTab('home');
        }
        return;
      }

      // Normal popstate (not the floor) — pop from screen stack
      if (stack.length > 1) {
        setScreenStack(prev => prev.slice(0, -1));
      } else if (tab !== 'home') {
        setActiveTab('home');
        window.history.pushState({ screen: stack[stack.length - 1] }, '', window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Empty deps — uses refs for latest values

  // Listen for navigation messages from the Service Worker (e.g. when clicking a push notification while the app is open)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          // Extract target screen from relative URL or path
          const targetUrl = event.data.url;
          if (targetUrl) {
            const targetScreen = targetUrl.replace(/^\/+/g, '').replace(/\/+$/g, '');
            pushScreen(targetScreen);
            fetchJobs(); // Force feed refresh when notification triggers navigation
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [pushScreen, fetchJobs]);

  // Refresh jobs when app becomes visible (e.g. returning to app after clicking a notification or resuming)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Visibility] App became visible, refreshing jobs...');
        fetchJobs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchJobs]);

  // Change user location helper
  const changeLocation = async (area) => {
    setUserLocation(area);
    if (area?.lat && area?.lng) {
      setRealLocation({ lat: area.lat, lng: area.lng });
    } else {
      setRealLocation(null);
    }
    
    // Save to local storage
    localStorage.setItem('userLocation', JSON.stringify(area));

    // Save to backend if user is logged in
    if (userId && area) {
      // Extract city from the area name (comma-separated formatting)
      const parts = area.name.split(',');
      const city = parts.length > 1 ? parts[parts.length - 2].trim() : 'Pan India';

      await api.upsertUserLocation({
        user_id: userId,
        area_name: area.name,
        city: city,
        latitude: area.lat || 0,
        longitude: area.lng || 0,
        updated_at: new Date().toISOString()
      });
    }

    setShowBlinkitPrompt(false);
  };

  // Radius Logic for Job Feeds
  const getJobsInRadius = () => {
    const openJobs = (jobs || []).filter(j => j?.status === 'open' && !j?.isAcceptedByMe);
    
    // Decouple tasker distance calculation: use tasker's serviceAreaLat/Lng if active role is tasker, falling back to realLocation
    const referenceCenter = (role === 'tasker')
      ? (userProfile?.serviceAreaLat && userProfile?.serviceAreaLng ? { lat: userProfile.serviceAreaLat, lng: userProfile.serviceAreaLng } : realLocation)
      : realLocation;
    
    let enrichedJobs = openJobs.map(job => {
      let distanceVal = 5.0; // fallback radius max
      if (referenceCenter && job?.lat && job?.lng) {
        distanceVal = calculateDistance(referenceCenter.lat, referenceCenter.lng, job.lat, job.lng);
      } else if (job?.distanceVal) {
        distanceVal = job.distanceVal || 5.0;
      }
      return {
        ...(job || {}),
        distanceVal
      };
    });

    // If active role is tasker, filter jobs by tasker's coverageRadius (bypass if it's a pending priority offer or a remote task)
    if (role === 'tasker' && userProfile?.coverageRadius) {
      const radiusKm = userProfile.coverageRadius / 1000;
      enrichedJobs = enrichedJobs.filter(j => {
        const skill = SKILLS.find(s => s.id === j.skillId || s.id === j.skill_id);
        const isRemote = skill?.type === 'remote';
        return j.isPendingOffer || isRemote || j.distanceVal <= radiusKm;
      });
    }

    if (referenceCenter) {
      enrichedJobs.sort((a, b) => (a?.distanceVal || 0) - (b?.distanceVal || 0));
    }

    return {
      jobsList: enrichedJobs,
      radius: (role === 'tasker' && userProfile?.coverageRadius) ? userProfile.coverageRadius / 1000 : 5,
      message: 'Showing results in your area'
    };
  };

  const acceptJob = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    const tName = userProfile?.taskerName || userProfile?.name || 'Tasker';
    const tBird = userProfile?.bird || 'falcon';

    // Call V2 RPC first to ensure atomic acceptance safety
    const { data: success } = await api.acceptJobOffer(jobId, tId);
    if (!success) {
      if (showToast) showToast('This job is no longer available.', 'error');
      // Force refresh of jobs
      const { data } = await api.fetchJobs();
      if (data) setJobs(data);
      return;
    }

    // Fetch latest job details directly from DB to get the true status (waiting room or accepted)
    const { data: updatedJobs } = await api.fetchJobs();
    let latestJob = null;
    if (updatedJobs) {
      setJobs(updatedJobs);
      latestJob = updatedJobs.find(j => j.id === jobId);
      if (latestJob) {
        setAcceptedJob(latestJob);
      }
    }

    const job = latestJob || jobs.find(j => j.id === jobId) || {};
    
    trackEvent(EVENTS.TASK_ACCEPTANCE, { userId: tId, role, entityId: jobId });

    // Send Notification to Hirer
    if (job.posterId) {
      api.sendNotification(
        job.posterId,
        "Job Accepted!",
        `${tName} has accepted your job and is on their way.`,
        'crew_confirmed',
        'job_accepted',
        'poster'
      );
    }

    // Start tracking simulation
    const startLat = (job.lat !== undefined && job.lat !== 0) ? job.lat + 0.012 : 31.2560 + 0.012; // Start roughly 1.5km away
    const startLng = (job.lng !== undefined && job.lng !== 0) ? job.lng - 0.012 : 75.7051 - 0.012;
    setTrackingTaskerPos({ lat: startLat, lng: startLng });
    setAnimationTick(0);

    // Save initial coordinates to database instantly to prevent poster/tasker mismatch
    api.updateJob(jobId, {
      tasker_current_location: `POINT(${startLng} ${startLat})`
    }).catch(err => console.error("Failed to upload initial tracking position", err));

    pushScreen('tasker_accepted_job', true);
  };

  const declineJob = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    await api.declineJobOffer(jobId, tId);
    setJobs(prevJobs => prevJobs.filter(j => j.id !== jobId));
    trackEvent(EVENTS.TASK_REJECTION, { userId: tId, role, entityId: jobId });
  };

  const cancelTaskerAssignment = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    const { data: success } = await api.cancelAcceptedJobOffer(jobId, tId);
    if (success) {
      if (showToast) showToast('You have cancelled your assignment for this task.', 'info');
      const { data } = await api.fetchJobs();
      if (data) setJobs(data);
      setAcceptedJob(null);
      pushScreen('tasker_home', true);
    } else {
      if (showToast) showToast('Could not cancel assignment.', 'error');
    }
  };

  const acceptPartialCrew = async (jobId) => {
    const posterId = userProfile?.id || userId || localStorage.getItem('userId');
    const { data: success } = await api.commitPartialCrew(jobId, posterId);
    if (success) {
      if (showToast) showToast('Crew finalized. Proceeding with active helper(s)!', 'success');
      // Update local job states
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'accepted', v2_status: 'accepted' } : j));
      const { data: crew } = await api.fetchJobCrew(jobId);
      setCrewTaskers(crew || []);
      setLiveStatus('crew_set');
      pushScreen('crew_confirmed', true);
    } else {
      if (showToast) showToast('No taskers have accepted this job yet.', 'error');
    }
  };

  // Tasker completes a job
  const completeJob = async (jobId) => {
    const originalJobs = [...jobs];
    const originalAcceptedJob = acceptedJob ? { ...acceptedJob } : null;

    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'completed', v2_status: 'completed' } : j)
    );
    if (acceptedJob && acceptedJob.id === jobId) {
      setAcceptedJob(prev => ({ ...prev, status: 'completed', v2_status: 'completed' }));
    }

    try {
      const { error } = await api.updateJob(jobId, { status: 'completed', v2_status: 'completed' });
      if (error) throw error;

      const job = originalJobs.find(j => j.id === jobId);
      trackEvent(EVENTS.TASK_COMPLETION, { userId, role, entityId: jobId });

      // Send Notification to Hirer
      if (job && job.posterId) {
        api.sendNotification(
          job.posterId,
          "Job Completed!",
          "Your tasker has marked the job as complete. Please review and pay.",
          'rating_screen',
          'job_completed',
          'poster'
        );
      }

      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      pushScreen('tasker_rating', true);
    } catch (err) {
      console.error("Failed to complete job", err);
      if (showToast) showToast('Failed to complete job. Please try again.', 'error');
      // Rollback optimistic state
      setJobs(originalJobs);
      if (originalAcceptedJob) setAcceptedJob(originalAcceptedJob);
    }
  };

  // Poster posts a job
  const postJob = async (newJobData) => {
    if (newJobData.amount === undefined || newJobData.amount === null || isNaN(newJobData.amount) || newJobData.amount < 0) {
      console.error('Failed to post job: Payout amount must be greater than or equal to ₹0');
      return { success: false, error: 'Payout amount must be greater than or equal to ₹0' };
    }

    let locationStr = null;
    if (newJobData.lng !== undefined && newJobData.lat !== undefined) {
      locationStr = `POINT(${newJobData.lng} ${newJobData.lat})`;
    } else if (userLocation) {
      locationStr = `POINT(${userLocation.lng} ${userLocation.lat})`;
    }

    // Calculate expiration timestamp (the selected date and time)
    const dateObj = new Date(newJobData.day);
    const [timeStr, ampmStr] = newJobData.time.split(' ');
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (ampmStr === 'PM' && hours < 12) hours += 12;
    if (ampmStr === 'AM' && hours === 12) hours = 0;
    dateObj.setHours(hours, minutes, 0, 0);
    const expiresAt = dateObj.toISOString();

    const dbDescription = `${newJobData.description || 'Quick task'}\n[Time: ${expiresAt}]`;

    // Remove old job if reposting
    if (editJobData) {
      await deleteJob(editJobData.id);
      setEditJobData(null);
    }

    const currentUserId = userId || localStorage.getItem('userId');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const { data, error } = await api.postJob({
      posterId: currentUserId,
      skillId: newJobData.skillId,
      description: dbDescription,
      peopleNeeded: newJobData.peopleNeeded || 1,
      amount: newJobData.amount,
      locationStr: locationStr,
      primaryAddressId: newJobData.address?.id || null,
      otp: otp,
      scheduledFor: expiresAt
    });

    if (newJobData.address?.id) {
      updateSavedAddress(newJobData.address.id, { lastUsedAt: new Date().toISOString() });
    }

    if (data) {
      const dbJob = {
        ...data,
        ...newJobData,
        id: data.id,
        description: newJobData.description || 'Quick task',
        posterId: data.poster_id,
        posterName: userProfile?.posterName || userProfile?.name || 'Unknown Hirer',
        posterBird: selectedBird || 'robin',
        skillId: data.skill_id,
        timePosted: data.created_at,
        expiresAt,
        lng: newJobData.lng !== undefined ? newJobData.lng : (userLocation?.lng || 0),
        lat: newJobData.lat !== undefined ? newJobData.lat : (userLocation?.lat || 0)
      };
      setJobs(prev => [dbJob, ...prev]);
      setCurrentPostedJob(dbJob);
      trackEvent(EVENTS.TASK_CREATION, { userId: currentUserId, role, entityId: data.id, metadata: { amount: newJobData.amount } });
      api.notifyAdmin('New Job Posted', `A new job was just posted for ₹${newJobData.amount}!`);
      
      // OTP state update
      setOtpGenerated(otp);

      // Reset crew state from any previous job session
      setCrewTaskers([]);
      setLiveStatus('posted');

      pushScreen('live_status', true);
      showToast('Job posted successfully!', 'success');
      return { success: true, data: dbJob };
    }

    return { success: false, error: error?.message || 'Failed to post job' };
  };



  // Map Pin static position and live tracking
  useEffect(() => {
    const targetJob = acceptedJob || currentPostedJob;
    const targetJobId = targetJob?.id || null;
    const isJobActive = (currentScreen === 'tasker_accepted_job' && acceptedJob) || 
                        (currentScreen === 'crew_confirmed' && crewTaskers.length > 0 && currentPostedJob);

    if (isJobActive && targetJobId) {
      // If we are already running the interval for this exact jobId, do not recreate it!
      if (activeJobIdRef.current === targetJobId && trackingIntervalRef.current) {
        if (role !== 'tasker') {
          setTrackingTaskerPos(currentPostedJob?.taskerCurrentLocation || { lat: targetJob.lat, lng: targetJob.lng });
        }
        return;
      }

      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
      activeJobIdRef.current = targetJobId;
      
      // If tasker role, fetch real location every 5 seconds to update map and DB
      if (role === 'tasker') {
        // Start interval
        trackingIntervalRef.current = setInterval(async () => {
          try {
            const loc = await getCurrentLocation();
            setTrackingTaskerPos(loc);
            // Save to database
            await api.updateJob(targetJobId, {
              tasker_current_location: `POINT(${loc.lng} ${loc.lat})`
            });
            // Save to user_locations database table (scales to multiple taskers)
            await api.upsertUserLocation({
              user_id: userId,
              latitude: loc.lat,
              longitude: loc.lng,
              updated_at: new Date().toISOString()
            });
          } catch(err) {
            console.error("Live tracking location failed", err);
          }
        }, 5000);
      } else {
        // For poster view, use the live tasker location from currentPostedJob
        setTrackingTaskerPos(currentPostedJob?.taskerCurrentLocation || { lat: targetJob.lat, lng: targetJob.lng });
      }
    } else {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      activeJobIdRef.current = null;
    }
  }, [currentScreen, acceptedJob?.id, currentPostedJob?.id, crewTaskers?.length, role, currentPostedJob?.taskerCurrentLocation]);

  // Clean up live tracking interval on AppProvider unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  // Track the taskerId that was already on the job when we entered live_status.
  // This prevents stale DB data (e.g. a previous session's accepted tasker) from
  // immediately triggering crew_confirmed on the new job broadcast.
  const liveStatusInitialTaskerIdRef = useRef(null);

  useEffect(() => {
    if (currentScreen === 'live_status' && currentPostedJob) {
      // Snapshot the current taskerId whenever we arrive at live_status
      const currentJob = jobs.find(j => j.id === currentPostedJob.id);
      if (liveStatusInitialTaskerIdRef.current === null) {
        liveStatusInitialTaskerIdRef.current = currentJob?.taskerId || '';
      }
    } else {
      // Reset snapshot when leaving live_status
      liveStatusInitialTaskerIdRef.current = null;
    }
  }, [currentScreen, currentPostedJob]);

  useEffect(() => {
    if (currentScreen === 'live_status' && currentPostedJob) {
      const updatedJob = jobs.find(j => j.id === currentPostedJob.id);
      
      // Only navigate if taskerId is genuinely NEW (not the one that existed at mount)
      const isNewTasker = updatedJob?.taskerId &&
        updatedJob.taskerId !== liveStatusInitialTaskerIdRef.current;

      if (updatedJob && isNewTasker && updatedJob.status === 'accepted') {
        api.fetchJobCrew(updatedJob.id).then(({ data }) => {
          if (data && data.length > 0) {
            setCrewTaskers(data);
          } else {
            setCrewTaskers([{
              id: updatedJob.taskerId,
              name: updatedJob.taskerName || 'Helper',
              rating: updatedJob.taskerRating,
              tasksCompleted: updatedJob.taskerTasksCompleted || 0,
              bird: updatedJob.taskerBird || 'falcon',
              upiId: updatedJob.taskerUpi
            }]);
          }
          setLiveStatus('crew_set');
          pushScreen('crew_confirmed', true);
        });
      }
    }
  }, [jobs, currentScreen, currentPostedJob, pushScreen]);

  // Reset helper
  const resetApp = async () => {
    if (userId) trackEvent(EVENTS.LOGOUT, { userId, role });
    
    // Fire and forget the logout API call so the UI updates immediately
    api.logout().catch(e => console.warn('[Auth] Error during logout API call:', e));
    
    setRole(null);
    setUserLocation(null);
    localStorage.removeItem('userLocation');
    localStorage.removeItem('userProfile');
    setLocationPermission('prompt');
    setUserProfileState(null);
    setUserId(null);
    setSelectedBird('falcon');
    setIsAdmin(false);
    localStorage.removeItem('activeRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('isOnline');
    localStorage.removeItem('helphive_addresses_v2');
    pushScreen('landing', true);
    setAcceptedJob(null);
    setCurrentPostedJob(null);
    setCrewTaskers([]);
    setOtpEntered('');
    setOtpGenerated('');
    setLiveStatus('posted');
    setActiveTab('home');
    setProfileActionCallback(null);
    setTrackingTaskerPos(null);
    setAnimationTick(0);
    setRealLocation(null);
    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
  };

  // Listen to Supabase Auth State Changes for Magic Link / OAuth
  const authProcessingRef = useRef(false);

  const handleSignIn = async (session) => {
    if (!session?.user) return;
    if (authProcessingRef.current) return;
    authProcessingRef.current = true;

    try {
      const email = session.user.email;
      const authId = session.user.id;

      let profile = null;

      // 1. Try to find by auth_id
      const { data: profileByAuth, error: authErr } = await api.findProfileByAuthId(authId);
      if (authErr && authErr.code !== 'PGRST116') {
        console.error('[Auth] Error finding profile by auth_id:', authErr);
      }

      if (profileByAuth) {
        profile = profileByAuth;
        
        // Update name from Google if it is still 'New User'
        if (profile.name === 'New User' && session.user.user_metadata?.full_name) {
          const googleName = session.user.user_metadata.full_name;
          await api.updateProfile(profile.id, { name: googleName });
          profile.name = googleName;
        }

        // Update email if it's missing or set to 'Add Email'
        if ((!profile.email || profile.email === 'Add Email' || profile.email.trim() === '') && email) {
          await api.updateProfile(profile.id, { email: email });
          profile.email = email;
        }
      } else if (email) {
        // 2. Try to find by email
        const { data: profileByEmail, error: emailErr } = await api.findProfileByEmail(email);
        if (emailErr && emailErr.code !== 'PGRST116') {
          console.error('[Auth] Error finding profile by email:', emailErr);
        }

        if (profileByEmail) {
          // Link auth_id to existing email-based profile
          await api.updateProfile(profileByEmail.id, { auth_id: authId });
          profile = profileByEmail;
        } else {
          // 3. New user — create profile
          const activeRole = localStorage.getItem('activeRole') || 'tasker';
          const { data: newProfile, error: createErr } = await api.createProfile({
            name: session.user.user_metadata?.full_name || 'New User',
            email: email,
            auth_id: authId,
            role: activeRole,
            rating: null,
            tasks_completed: 0,
            bird: selectedBird || 'falcon'
          });

          if (createErr) {
            console.error('[Auth] Error creating profile:', createErr);
            // If insert failed due to unique constraint (duplicate), try finding again
            const { data: retryProfile } = await api.findProfileByAuthId(authId);
            profile = retryProfile;
          } else {
            profile = newProfile;
          }

          if (profile) {
            api.notifyAdmin('New User Registration', `A new user (${email}) just signed up!`);
            trackEvent(EVENTS.SIGNUP, { userId: profile.id, role: activeRole });
          }
        }
      }

      if (profile) {
        const isAlreadyLoggedIn = localStorage.getItem('userId') === profile.id;
        setUserId(profile.id);
        localStorage.setItem('userId', profile.id);
        const finalRole = localStorage.getItem('activeRole') || profile.role || 'tasker';
        setRole(finalRole);
        localStorage.setItem('activeRole', finalRole);

        if (profile.role !== finalRole) {
          api.updateProfile(profile.id, { role: finalRole }).then();
        }

        const parsedProfile = parseProfileData(profile, finalRole);
        setUserProfileState(parsedProfile);

        if (profile.bird) setSelectedBird(profile.bird);
        setIsAdmin(profile.is_admin === true);
        // Force always online status on OAuth/magic-link sign-in
        setIsOnlineState(true);
        localStorage.setItem('isOnline', 'true');
        if (profile.is_online !== true) {
          api.updateProfile(profile.id, { is_online: true }).catch(console.error);
        }

        pushScreen(finalRole === 'tasker' ? 'tasker_home' : 'poster_home');
        if (!isAlreadyLoggedIn) {
          showToast('Welcome back!', 'success');
        }
        fetchJobs();
        
        if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);

          // Force the browser to re-evaluate the viewport meta tag.
          // After an OAuth redirect, some mobile browsers (especially Chrome on
          // Android) cache the initial viewport calculation from the redirect URL
          // and fail to apply the correct mobile scaling until a full page reload.
          // Toggling the viewport content forces a layout recalculation without a
          // reload, which fixes the "desktop view on mobile" issue.
          requestAnimationFrame(() => {
            const vp = document.querySelector('meta[name="viewport"]');
            if (vp) {
              const original = vp.getAttribute('content');
              vp.setAttribute('content', 'width=device-width, initial-scale=0.99');
              requestAnimationFrame(() => {
                vp.setAttribute('content', original);
              });
            }
          });
        }
      } else {
        console.error('[Auth] Could not find or create a profile for auth user:', authId);
        showToast('Login failed: Could not load user profile.', 'error');
        resetApp();
      }
    } catch (err) {
      console.error('[Auth] Unexpected error in handleSignIn:', err);
      showToast('Login failed due to unexpected error.', 'error');
      resetApp();
    } finally {
      authProcessingRef.current = false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = api.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (localStorage.getItem('userId')) {
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('isOnline');
          localStorage.removeItem('userProfile');
          setUserId(null);
          setRole(null);
          setUserProfileState(null);
          setScreenStack(['landing']);
          setActiveTab('home');
        }
        return;
      }

      // Only handle sign-in events, ignore token refreshes etc.
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return;
      if (!session?.user) return;

      handleSignIn(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Guard stuck auth_loading screens and proactively handle invalid magic links
  useEffect(() => {
    if (currentScreen === 'auth_loading') {
      let isMounted = true;
      let timer;

      const checkAuthStatus = async () => {
        try {
          // getSession awaits the URL code exchange if detectSessionInUrl is true
          const { data, error } = await api.getSession();
          if (isMounted) {
            if (error || !data?.session) {
              console.warn('[Auth] Code exchange failed or no session found. Resetting stack.', error);
              showToast('Login link is invalid or has expired. Please request a new one.', 'error');
              resetApp();
            } else {
              // Session exists! Code exchange succeeded.
              clearTimeout(timer);
              // Proactively log the user in using the retrieved session
              handleSignIn(data.session);
            }
          }
        } catch (e) {
          if (isMounted) {
            console.error('[Auth] Error checking session:', e);
            showToast('Login failed due to network error.', 'error');
            resetApp();
          }
        }
      };

      // Fallback timeout in case the network completely drops
      timer = setTimeout(() => {
        if (isMounted && currentScreen === 'auth_loading') {
          console.warn('[Auth] Auth loading timed out. Resetting stack.');
          showToast('Login timed out. Please check your connection.', 'error');
          resetApp();
        }
      }, 10000);

      checkAuthStatus();

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [currentScreen]);

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        locationPermission,
        setLocationPermission,
        userLocation,
        setUserLocation,
        changeLocation,
        manualLocationInput,
        setManualLocationInput,
        savedAddresses,
        addSavedAddress,
        updateSavedAddress,
        removeSavedAddress,
        setDefaultAddress,
        userProfile,
        setUserProfile,
        currentScreen,
        routeParams,
        pushScreen,
        popScreen,
        switchRole,
        refreshProfile,
        screenStack,
        jobs,
        setJobs,
        fetchJobs,
        taskers,
        activeTab,
        setActiveTab,
        acceptedJob,
        setAcceptedJob,
        acceptJob,
        declineJob,
        cancelTaskerAssignment,
        acceptPartialCrew,
        completeJob,
        currentPostedJob,
        setCurrentPostedJob,
        postJob,
        editJobData,
        setEditJobData,
        editAddressData,
        setEditAddressData,
        jobHistoryTab,
        setJobHistoryTab,
        taskerActivityScrollTarget,
        setTaskerActivityScrollTarget,
        deleteJob,
        expireJob,
        crewTaskers,
        setCrewTaskers,
        liveStatus,
        setLiveStatus,
        otpGenerated,
        setOtpGenerated,
        otpEntered,
        setOtpEntered,
        resetApp,
        getJobsInRadius,
        trackingTaskerPos,
        setTrackingTaskerPos,
        realLocation,
        setRealLocation,
        isLocationModalOpen,
        setLocationModalOpen,
        showBlinkitPrompt,
        setShowBlinkitPrompt,
        
        selectedBird,
        setSelectedBird,
        isOnline,
        setIsOnline,
        
        // Interceptors
        profileActionCallback,
        requireProfile,
        cancelProfileAction,
        completeProfileAction,
        locationActionCallback,
        locationActionRole,
        requireLocation,
        completeLocationAction,
        cancelLocationAction,
        

        isAdmin,
        userId,
        isProfileLoading
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
