import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { api } from '../services/api';
import { SKILLS, GOATED_GUEST_PROFILE } from '../config/constants';
import { trackEvent, EVENTS } from '../utils/eventTracker';
import { ToastContext } from './ToastContext';
import { parseEWKBPoint, getCurrentLocation } from '../utils/location';
import { reverseGeocode } from '../utils/geocoding';
import { detectUserCurrency, setUserCurrency as saveUserCurrency, resetUserCurrency as clearUserCurrency } from '../utils/currency';

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

  const allRatings = feedbacks.map(f => f.rating);
  const overallRating = allRatings.length > 0
    ? parseFloat((allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length).toFixed(1))
    : (data.rating || null);

  const taskerTasks = taskerFeedbacks.length;
  const posterTasks = posterFeedbacks.length;
  const totalCompleted = taskerTasks + posterTasks;

  const repBadges = data.reputation_badges || [];
  const taskerBadges = repBadges.filter(b => b.role_context === 'tasker').map(b => b.badge_type);
  const posterBadges = repBadges.filter(b => b.role_context === 'poster').map(b => b.badge_type);
  const allBadges = repBadges.map(b => b.badge_type);

  const xp = data.xp !== undefined && data.xp !== null ? parseInt(data.xp, 10) : 0;
  const calculatedLevel = Math.min(99, Math.max(1, Math.floor(Math.sqrt(totalCompleted * 4)) + 1));
  const playerLevel = data.player_level || calculatedLevel;

  return {
    id: data.id,
    name: data.name,
    handle: data.handle || (data.name ? `@${data.name.toLowerCase().replace(/\s+/g, '_')}` : '@operative'),
    title: data.title || 'Rookie Scout',
    xp,
    playerLevel,
    level: playerLevel,
    streakDays: data.streak_days || 0,
    currency: data.currency || 'INR',
    email: data.email,
    phone: data.phone,
    posterName: data.posterName || data.name,
    posterPhone: data.posterPhone || data.phone,
    taskerName: data.taskerName || data.name,
    taskerPhone: data.taskerPhone || data.phone,
    verifiedPhones: verifiedPhones,
    skills: data.skills || [],
    
    // Real Database Ratings and Badges
    overallRating,
    taskerRating,
    posterRating,
    taskerTasksCompleted: taskerTasks,
    posterTasksCompleted: posterTasks,
    allBadges,
    taskerBadges,
    posterBadges,
    taskerReviews: taskerFeedbacks,
    posterReviews: posterFeedbacks,

    // Compatibility fields
    rating: currentRole === 'tasker' ? (taskerRating || overallRating) : (posterRating || overallRating),
    tasksCompleted: currentRole === 'tasker' ? taskerTasks : posterTasks,
    badges: currentRole === 'tasker' ? taskerBadges : posterBadges,
    reviews: currentRole === 'tasker' ? taskerFeedbacks : posterFeedbacks,

    bird: data.bird,
    upiId: data.upi_id || '',
    unpaidCommissionDues: parseFloat(data.unpaid_commission_dues || 0),
    referredBy: data.referred_by || null,
    totalTasksCompletedCount: parseInt(data.total_tasks_completed_count || 0, 10),
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

  // Global Currency State & Switcher
  const [currency, setCurrencyState] = useState(() => detectUserCurrency());
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const setCurrency = useCallback((currencyCode) => {
    const updated = saveUserCurrency(currencyCode);
    setCurrencyState(updated);
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
      api.updateProfile(savedUserId, { currency: updated.code }).catch(e => console.warn('Currency profile sync error:', e));
    }
    if (showToast) showToast(`Currency set to ${updated.code} (${updated.symbol})`, 'success');
  }, [showToast]);

  const resetCurrency = useCallback(() => {
    const updated = clearUserCurrency();
    setCurrencyState(updated);
    if (showToast) showToast(`Currency reset to auto-detect (${updated.code} ${updated.symbol})`, 'info');
  }, [showToast]);

  useEffect(() => {
    const handleCurrencyChange = (e) => {
      if (e.detail) {
        setCurrencyState(e.detail);
      }
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  // Global State for role & profiles
  const [role, setRole] = useState(localStorage.getItem('activeRole') || 'tasker');
  
  // Location Action Interceptor
  const [locationActionCallback, setLocationActionCallback] = useState(null);
  const [locationActionRole, setLocationActionRole] = useState('poster');
  const [userProfile, setUserProfileState] = useState(() => {
    const hasUserId = localStorage.getItem('userId');
    if (hasUserId) {
      const saved = localStorage.getItem('userProfile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse cached userProfile", e);
        }
      }
      return null;
    }
    // Guest mode: always use GOATED_GUEST_PROFILE for peak preview
    return GOATED_GUEST_PROFILE;
  }); // { name, phone, skills, rating, tasksCompleted }
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const loginCallbackRef = useRef(null);
  const acceptingJobIdsRef = useRef(new Set());

  const openLoginModal = (callback = null) => {
    loginCallbackRef.current = callback;
    setShowLoginModal(true);
  };
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

  // Availability status (ON/OFF)
  const [isOnline, setIsOnlineState] = useState(() => {
    const saved = localStorage.getItem('isOnline');
    return saved === null ? true : saved === 'true';
  });
  
  // Navigation stack state
  const [screenStack, setScreenStack] = useState(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('access_token') || search.includes('code=')) {
      return ['auth_loading'];
    }
    const activeRole = localStorage.getItem('activeRole') || 'tasker';
    const path = window.location.pathname.replace(/^\/+/g, '').replace(/\/+$/g, '');
    const validScreens = ['notifications', 'tasker_activity', 'my_profile', 'about_us', 'need_help', 'job_history', 'address_book', 'operations', 'post_job'];
    if (validScreens.includes(path)) {
      return [activeRole === 'tasker' ? 'tasker_home' : 'poster_home', path];
    }
    return [activeRole === 'tasker' ? 'tasker_home' : 'poster_home'];
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

  // Persist realLocation to localStorage whenever it is granted/updated
  useEffect(() => {
    if (realLocation?.lat && realLocation?.lng) {
      const stored = localStorage.getItem('userLocation');
      let updated = { lat: realLocation.lat, lng: realLocation.lng };
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          updated = { ...parsed, lat: realLocation.lat, lng: realLocation.lng };
        } catch (e) {
          // ignore
        }
      }
      localStorage.setItem('userLocation', JSON.stringify(updated));
    }
  }, [realLocation]);
  
  const [isLocationModalOpen, setLocationModalOpen] = useState(false);
  const [showBlinkitPrompt, setShowBlinkitPrompt] = useState(false);
  
  // Saved Addresses
  const [savedAddresses, setSavedAddressesState] = useState(() => {
    const saved = localStorage.getItem('helphive_addresses_v2');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  });

  const hasMigratedLocalAddressesRef = useRef(false);

  // Sync addresses with DB when user logs in
  useEffect(() => {
    const syncAddresses = async () => {
      if (!userId) return;
      const { data } = await api.fetchAddresses(userId);
      if (data) {
        if (data.length > 0) {
          setSavedAddressesState(data);
          hasMigratedLocalAddressesRef.current = true; // Don't migrate if DB already has addresses
        } else if (!hasMigratedLocalAddressesRef.current) {
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
          hasMigratedLocalAddressesRef.current = true;
        }
      }
    };
    syncAddresses();
  }, [userId]);

  // Apply default address to active header location on startup/login when addresses load
  useEffect(() => {
    if (savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find(a => a.isDefault);
      if (defaultAddr) {
        const storedLoc = localStorage.getItem('userLocation');
        const shouldOverride = !storedLoc || (() => {
          try {
            const parsed = JSON.parse(storedLoc);
            return parsed.id === 'detected' || parsed.id === 'default' || !parsed.id;
          } catch {
            return true;
          }
        })();

        if (shouldOverride) {
          const loc = {
            id: defaultAddr.id,
            name: defaultAddr.landmark || defaultAddr.completeAddress?.split(',')[0] || defaultAddr.type || 'Home',
            lat: defaultAddr.lat,
            lng: defaultAddr.lng
          };
          setUserLocation(loc);
          localStorage.setItem('userLocation', JSON.stringify(loc));
          setRealLocation({ lat: defaultAddr.lat, lng: defaultAddr.lng });
        }
      }
    }
  }, [savedAddresses]);

  // Keep local storage in sync for offline/guest
  useEffect(() => {
    localStorage.setItem('helphive_addresses_v2', JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  // On startup or login, manage user location detection
  useEffect(() => {
    const initLocation = async () => {
      // 1. If logged in, check database location / user profile location first
      if (userId) {
        try {
          const { data } = await api.fetchUserLocation(userId);
          if (data && data.area_name && data.latitude && data.longitude) {
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

      // 2. If we already have a userLocation from state/local storage, keep it
      if (userLocation) {
        if (!realLocation && userLocation.lat && userLocation.lng) {
          setRealLocation({ lat: userLocation.lat, lng: userLocation.lng });
        }
        return;
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
    const hasDefault = savedAddresses.some(a => a.isDefault);
    const isFirst = savedAddresses.length === 0 || !hasDefault;
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
    const targetAddress = savedAddresses.find(a => a.id === addressId);
    const wasDefault = targetAddress?.isDefault;
    
    if (userId) {
      await api.deleteAddress(addressId);
    }
    
    const remaining = savedAddresses.filter(a => a.id !== addressId);
    if (wasDefault && remaining.length > 0) {
      // Set the first remaining address as default
      const newDefault = remaining[0];
      if (userId) {
        await api.updateAddress(newDefault.id, { isDefault: true, lastUsedAt: new Date().toISOString() });
        const { data } = await api.fetchAddresses(userId);
        if (data) setSavedAddressesState(data);
      } else {
        setSavedAddressesState(
          remaining.map((a, i) => i === 0 ? { ...a, isDefault: true, lastUsedAt: new Date().toISOString() } : a)
          .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0))
        );
      }
    } else {
      setSavedAddressesState(remaining);
    }
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
  const jobsRef = useRef(jobs);
  const lastFetchTimeRef = useRef(0);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  
  const [taskers, setTaskers] = useState([]);

  // Fetch jobs from API
  const fetchJobs = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 15000) {
      console.log('[FetchJobs] Skipped API fetch, retrieved recently.');
      return;
    }
    lastFetchTimeRef.current = now;

    const { data, error } = await api.fetchJobs(userId, role);
    if (data) {
      const mappedJobs = data.map(j => {
        let expiresAt = j.expiresAt || j.scheduled_for || j.scheduledFor || null;
        let cleanDesc = j.description || '';
        const match = cleanDesc.match(/\s*\[Time: ([^\]]+)\]/);
        if (match) {
          if (!expiresAt) expiresAt = match[1];
          cleanDesc = cleanDesc.replace(/\s*\[Time: [^\]]+\]/, '');
        }
        if (!expiresAt) {
          expiresAt = new Date(j.created_at || j.timePosted || Date.now()).toISOString();
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
              // Only override locally in state, database expiration is handled by backend auto-dispatch cron
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
    }, 120000); // 2 minutes (120s) fallback polling — realtime sync channel handles live updates

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
        // Validate that we have a valid active Supabase Auth session first (bypassed on localhost for testing)
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        let sessionData = null;
        if (!isLocalDev) {
          const { data } = await api.getSession();
          sessionData = data;
        } else {
          sessionData = { session: { user: { id: userId } } };
        }

        if (!sessionData?.session) {
          console.warn('[Auth] No active Supabase session found on startup. Logging out.');
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('userProfile');
          setUserId(null);
          setRole('tasker');
          setUserProfileState(GOATED_GUEST_PROFILE);
          setScreenStack(['tasker_home']);
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

          // Sync active userLocation and realLocation with DB profile location
          if (updatedProfile.serviceAreaLat && updatedProfile.serviceAreaLng) {
            const locName = updatedProfile.serviceAreaName || `${updatedProfile.serviceAreaLat.toFixed(4)}, ${updatedProfile.serviceAreaLng.toFixed(4)}`;
            const profileLoc = {
              id: 'profile_saved',
              name: locName,
              lat: updatedProfile.serviceAreaLat,
              lng: updatedProfile.serviceAreaLng
            };
            setUserLocation(profileLoc);
            localStorage.setItem('userLocation', JSON.stringify(profileLoc));
            setRealLocation({ lat: updatedProfile.serviceAreaLat, lng: updatedProfile.serviceAreaLng });
          }

          if (data.bird) setSelectedBird(data.bird);
          setIsAdmin(data.is_admin === true);
          // Sync with database profile availability status
          const profileOnline = data.is_online ?? true;
          setIsOnlineState(profileOnline);
          localStorage.setItem('isOnline', profileOnline ? 'true' : 'false');
          setRole(activeRole);
          localStorage.setItem('activeRole', activeRole);
          trackEvent(EVENTS.LOGIN, { userId: data.id, role: activeRole });
        } else {
          // Profile not found in DB (zombie state), clear local storage
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('userProfile');
          setUserId(null);
          setRole('tasker');
          setUserProfileState(GOATED_GUEST_PROFILE);
          setScreenStack(['tasker_home']);
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
        return { success: false, error: 'An account already exists with this phone number. Please sign in.' };
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
        handle: profileData.handle !== undefined ? profileData.handle : userProfile?.handle,
        title: profileData.title !== undefined ? profileData.title : userProfile?.title,
        currency: profileData.currency !== undefined ? profileData.currency : userProfile?.currency,
        email: profileData.email !== undefined ? profileData.email : userProfile?.email,
        phone: profileData.phone !== undefined ? profileData.phone : userProfile?.phone,
        upi_id: profileData.upiId !== undefined ? profileData.upiId : userProfile?.upiId,
        skills: profileData.skills !== undefined ? profileData.skills : (userProfile?.skills || []),
        bird: profileData.bird !== undefined ? profileData.bird : selectedBird,
        coverage_radius: profileData.coverageRadius !== undefined ? profileData.coverageRadius : userProfile?.coverageRadius,
        category_coverage: profileData.categoryCoverage !== undefined ? profileData.categoryCoverage : userProfile?.categoryCoverage,
        coverage_level: profileData.coverageLevel !== undefined ? profileData.coverageLevel : userProfile?.coverageLevel,
        service_area_name: profileData.serviceAreaName !== undefined ? profileData.serviceAreaName : userProfile?.serviceAreaName,
        verified_phones: roleSpecificUpdates.verifiedPhones !== undefined ? roleSpecificUpdates.verifiedPhones : (profileData.verifiedPhones || userProfile?.verifiedPhones || [])
      };

      if (profileData.xp !== undefined) updatesPayload.xp = profileData.xp;
      if (profileData.player_level !== undefined || profileData.playerLevel !== undefined) {
        updatesPayload.player_level = profileData.player_level || profileData.playerLevel;
      }

      const pendingRef = localStorage.getItem('helphive_referred_by');
      if (pendingRef && pendingRef !== currentUserId && !userProfile?.referredBy) {
        const { data: resolvedId } = await api.resolveReferralCode(pendingRef);
        if (resolvedId && resolvedId !== currentUserId) {
          updatesPayload.referred_by = resolvedId;
        }
      }

      if (profileData.locationStr !== undefined) {
        updatesPayload.location = profileData.locationStr;
        updatesPayload.locationStr = profileData.locationStr;
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
        const targetLat = dbLoc?.lat || parsedLoc?.lat || profileData.serviceAreaLat;
        const targetLng = dbLoc?.lng || parsedLoc?.lng || profileData.serviceAreaLng;
        const targetAreaName = data.service_area_name || profileData.serviceAreaName;

        setUserProfileState(prev => ({
          ...prev,
          ...profileData,
          ...roleSpecificUpdates,
          verifiedPhones: data.verified_phones || prev?.verifiedPhones || [],
          serviceAreaLat: targetLat !== undefined ? targetLat : prev?.serviceAreaLat,
          serviceAreaLng: targetLng !== undefined ? targetLng : prev?.serviceAreaLng
        }));

        if (targetLat && targetLng) {
          const locName = targetAreaName || `${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`;
          const newLoc = {
            id: 'user_set',
            name: locName,
            lat: targetLat,
            lng: targetLng
          };
          setUserLocation(newLoc);
          localStorage.setItem('userLocation', JSON.stringify(newLoc));
          setRealLocation({ lat: targetLat, lng: targetLng });

          api.upsertUserLocation({
            user_id: currentUserId,
            area_name: locName,
            city: data.city || 'Pan India',
            latitude: targetLat,
            longitude: targetLng,
            updated_at: new Date().toISOString()
          }).catch(err => console.warn('Failed to upsert user_location:', err));
        }

        if (data.bird) {
          setSelectedBird(data.bird);
        }
      }
      return { success: true };
    } else {
      // Guest mode: save to local storage cache
      try {
        const guestSaved = localStorage.getItem('helphive_guest_profile');
        const guestProfile = guestSaved ? JSON.parse(guestSaved) : {};
        const updatedGuest = {
          ...guestProfile,
          ...profileData,
          ...roleSpecificUpdates,
          ...locUpdates
        };
        localStorage.setItem('helphive_guest_profile', JSON.stringify(updatedGuest));
        setUserProfileState(updatedGuest);
        if (profileData.bird !== undefined) {
          setSelectedBird(profileData.bird);
        }
        return { success: true };
      } catch (err) {
        console.error('Error saving guest profile:', err);
        return { success: false, error: 'Failed to save guest profile.' };
      }
    }
  };

  const [activeTab, setActiveTabState] = useState('home'); // For tasker: 'home' | 'profile'
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    activeTabRef.current = tab;
  };
  
  // Onboarding Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardOnComplete, setWizardOnComplete] = useState(null);

  const openOnboardingWizard = (onCompleteCallback = null) => {
    setWizardOnComplete(() => onCompleteCallback);
    setShowWizard(true);
  };

  const closeOnboardingWizard = (completed = false) => {
    setShowWizard(false);
    if (completed && wizardOnComplete) {
      const cb = wizardOnComplete;
      setWizardOnComplete(null);
      // Run callback in the next tick to ensure state updates settle down
      setTimeout(() => {
        try {
          cb();
        } catch (e) {
          console.error('[Onboarding] Error executing complete callback:', e);
        }
      }, 0);
    } else {
      setWizardOnComplete(null);
    }
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
    setIsOnlineState(online);
    localStorage.setItem('isOnline', online ? 'true' : 'false');
    const currentUserId = userId || localStorage.getItem('userId');
    if (currentUserId) {
      await api.updateProfile(currentUserId, { is_online: online }).catch(console.error);
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
  const [trackingLocationError, setTrackingLocationError] = useState(false);
  const [animationTick, setAnimationTick] = useState(0);
  const trackingIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);
  const lastWrittenLocationRef = useRef(null);

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

  const switchRole = async (newRole, fromProfile = false) => {
    if (!userId) {
      setRole(newRole);
      localStorage.setItem('activeRole', newRole);
      setUserProfileState(GOATED_GUEST_PROFILE);
      if (fromProfile) {
        if (newRole === 'tasker') {
          setActiveTab('profile');
          pushScreen('tasker_home');
        } else {
          pushScreen('my_profile');
        }
      } else {
        pushScreen(newRole === 'tasker' ? 'tasker_home' : 'poster_home');
      }
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

    if (fromProfile) {
      if (newRole === 'tasker') {
        setActiveTab('profile');
        pushScreen('tasker_home');
      } else {
        pushScreen('my_profile');
      }
    } else {
      if (newRole === 'tasker') {
        pushScreen('tasker_home');
      } else {
        pushScreen('poster_home');
      }
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
      const handleServiceWorkerMessage = async (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          const targetUrl = event.data.url;
          const metadata = event.data.metadata;
          const jobId = metadata?.job_id || metadata?.jobId;

          if (jobId) {
            let currentJobs = jobsRef.current;
            if (!currentJobs || currentJobs.length === 0) {
              const { data } = await api.fetchJobs();
              if (data) {
                setJobs(data);
                currentJobs = data;
              }
            }
            const job = currentJobs.find(j => j.id === jobId);
            if (job) {
              if (role === 'tasker') {
                setAcceptedJob(job);
              } else {
                setCurrentPostedJob(job);
              }
            }
          }

          if (targetUrl) {
            // Strip query params for routing
            const cleanUrl = targetUrl.split('?')[0];
            const targetScreen = cleanUrl.replace(/^\/+/g, '').replace(/\/+$/g, '');
            pushScreen(targetScreen);
            fetchJobs(true); // Force feed refresh when notification triggers navigation
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [pushScreen, fetchJobs, role]);

  // Parse URL parameters on initial mount to resolve and navigate from deep links / push notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlJobId = params.get('jobId') || params.get('job_id');

    if (urlJobId && userId) {
      const resolveUrlJob = async () => {
        try {
          const { data } = await api.fetchJobs();
          if (data) {
            setJobs(data);
            const job = data.find(j => j.id === urlJobId);
            if (job) {
              // Get clean path without query params
              const cleanUrl = window.location.pathname.split('?')[0].replace(/^\/+/g, '').replace(/\/+$/g, '');
              const targetScreen = cleanUrl || (role === 'tasker' ? 'tasker_accepted_job' : (job.status === 'open' || job.v2_status === 'searching' ? 'live_status' : 'crew_confirmed'));

              if (role === 'tasker') {
                setAcceptedJob(job);
              } else {
                setCurrentPostedJob(job);
              }
              pushScreen(targetScreen);

              // Clear search params from URL so reloading doesn't re-trigger navigation
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        } catch (e) {
          console.error("Failed to resolve URL jobId:", e);
        }
      };
      resolveUrlJob();
    }
  }, [userId, role]);

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
  const getJobsInRadius = useCallback(() => {
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
  }, [jobs, role, userProfile, realLocation]);

  const acceptJob = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    const tName = userProfile?.taskerName || userProfile?.name || 'Tasker';
    const tBird = userProfile?.bird || 'falcon';

    if (acceptingJobIdsRef.current.has(jobId)) {
      console.warn('[AppContext] Already accepting job:', jobId);
      return;
    }
    acceptingJobIdsRef.current.add(jobId);

    // 1. Prepare job update details
    const originalJobs = [...jobs];
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) {
      acceptingJobIdsRef.current.delete(jobId);
      return;
    }

    const optimisticJob = {
      ...targetJob,
      status: 'accepted',
      v2_status: 'accepted',
      isAcceptedByMe: true,
      taskerId: tId,
      taskerName: tName,
      taskerBird: tBird
    };

    // 2. Execution Phase: Await database confirmation BEFORE navigating screens to prevent UI jumping
    try {
      const { data: success } = await api.acceptJobOffer(jobId, tId);
      if (!success) {
        throw new Error('not_available');
      }

      // Successfully confirmed by database: Update state and navigate
      setAcceptedJob(optimisticJob);
      setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? optimisticJob : j));
      pushScreen('tasker_accepted_job', true);

      // Fetch latest job details directly from DB to get the true status
      const { data: updatedJobs } = await api.fetchJobs();
      if (updatedJobs) {
        setJobs(updatedJobs);
        const latestJob = updatedJobs.find(j => j.id === jobId);
        if (latestJob) {
          setAcceptedJob(latestJob);
        }
      }

      trackEvent(EVENTS.TASK_ACCEPTANCE, { userId: tId, role, entityId: jobId });

      // Send Notification to Hirer
      if (targetJob.posterId) {
        const currentJobInDB = updatedJobs?.find(j => j.id === jobId) || targetJob;
        const isCrewFullySet = currentJobInDB.peopleNeeded ? (currentJobInDB.v2_status === 'accepted') : true;
        const actionUrl = isCrewFullySet ? 'crew_confirmed' : 'live_status';

        api.sendNotification(
          targetJob.posterId,
          "Task Accepted!",
          `${tName} has accepted your task and is on their way.`,
          actionUrl,
          'job_accepted',
          'poster',
          { job_id: jobId }
        );
      }

      // Start tracking simulation
      let jobLat = targetJob.lat;
      let jobLng = targetJob.lng;
      if (!jobLat || jobLat === 0) {
        if (userProfile?.serviceAreaLat && userProfile?.serviceAreaLng) {
          jobLat = userProfile.serviceAreaLat;
          jobLng = userProfile.serviceAreaLng;
        } else {
          jobLat = 31.2560;
          jobLng = 75.7051;
        }
      }

      const startLat = jobLat + 0.012; // Start roughly 1.5km away
      const startLng = jobLng - 0.012;
      setTrackingTaskerPos({ lat: startLat, lng: startLng });
      setAnimationTick(0);

      // Save initial coordinates to database instantly to prevent poster/tasker mismatch
      api.updateJob(jobId, {
        tasker_current_location: `POINT(${startLng} ${startLat})`
      }).catch(err => console.error("Failed to upload initial tracking position", err));

    } catch (err) {
      console.warn("Accept failed:", err);
      if (showToast) {
        if (err.message === 'not_available') {
          showToast('This task is no longer available.', 'error');
        } else {
          showToast('Could not accept task. Please check your connection.', 'error');
        }
      }
    } finally {
      acceptingJobIdsRef.current.delete(jobId);
    }
  };

  const declineJob = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    
    // Optimistic Update
    const originalJobs = [...jobs];
    setJobs(prevJobs => prevJobs.filter(j => j.id !== jobId));

    if (!tId) return;

    try {
      await api.declineJobOffer(jobId, tId);
      trackEvent(EVENTS.TASK_REJECTION, { userId: tId, role, entityId: jobId });
    } catch (err) {
      console.warn("Decline job failed on server:", err);
      // Fail silently for user experience, or keep deleted locally
    }
  };

  const cancelTaskerAssignment = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId');
    const job = jobs.find(j => j.id === jobId);
    const { data: success } = await api.cancelAcceptedJobOffer(jobId, tId);
    if (success) {
      if (showToast) showToast('You have cancelled your assignment for this task.', 'info');
      
      // Notify Hirer
      if (job && job.posterId) {
        api.sendNotification(
          job.posterId,
          "Helper Left Task",
          `${userProfile?.name || 'A helper'} has left the task "${job.description || 'Task'}".`,
          'crew_confirmed',
          'helper_left',
          'poster',
          { job_id: jobId, tasker_id: tId }
        );
      }

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
      if (showToast) showToast('No taskers have accepted this task yet.', 'error');
    }
  };

  // Tasker completes a job
  const completeJob = async (jobId) => {
    const originalJobs = [...jobs];
    const originalAcceptedJob = acceptedJob ? { ...acceptedJob } : null;
    const tId = userProfile?.id || userId || localStorage.getItem('userId');

    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, completedByMe: true } : j)
    );
    if (acceptedJob && acceptedJob.id === jobId) {
      setAcceptedJob(prev => ({ ...prev, completedByMe: true }));
    }

    try {
      const { error } = await api.completeTaskerOffer(jobId, tId);
      if (error) throw error;

      const job = originalJobs.find(j => j.id === jobId);
      trackEvent(EVENTS.TASK_COMPLETION, { userId, role, entityId: jobId });

      // Send Notification to Hirer
      if (job && job.posterId) {
        api.sendNotification(
          job.posterId,
          "Helper Marked Complete",
          `${userProfile?.name || 'A helper'} has marked the task as complete.`,
          'crew_confirmed',
          'job_completed',
          'poster',
          { job_id: jobId, tasker_id: tId }
        );
      }

      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      pushScreen('tasker_rating', true);
    } catch (err) {
      console.error("Failed to complete job", err);
      if (showToast) showToast('Failed to complete task. Please try again.', 'error');
      // Rollback optimistic state
      setJobs(originalJobs);
      if (originalAcceptedJob) setAcceptedJob(originalAcceptedJob);
    }
  };

  // Poster posts a job
  const postJob = async (newJobData) => {
    if (newJobData.amount === undefined || newJobData.amount === null || isNaN(newJobData.amount) || newJobData.amount < 0) {
      console.error('Failed to post job: Payout amount must be greater than or equal to 0');
      return { success: false, error: 'Payout amount must be greater than or equal to 0' };
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

    const dbDescription = newJobData.description || 'Quick task';

    // Remove old job if editing (and not reposting)
    if (editJobData) {
      if (editJobData.id && !editJobData.isRepost) {
        await deleteJob(editJobData.id);
      }
      setEditJobData(null);
    }

    const currentUserId = userId || localStorage.getItem('userId');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const { data, error } = await api.postJob({
      posterId: currentUserId,
      skillId: newJobData.skillId,
      specificSkillId: newJobData.specificSkillId || null,
      skillTags: newJobData.skillTags || [],
      questRarity: newJobData.questRarity || 'standard',
      currency: newJobData.currency || currency?.code || 'INR',
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
      
      // Resolve category name
      const skillName = SKILLS.find(s => s.id === newJobData.skillId)?.label || 'General';
      
      // Format location just like on taskers feed
      const jobLocation = newJobData.address?.completeAddress?.startsWith('Location at') && newJobData.address.landmark 
        ? newJobData.address.landmark 
        : (newJobData.address?.completeAddress || 'Not specified');

      // Construct a detailed admin notification body
      const adminMessageBody = 
        `Category: ${skillName}\n` +
        `Payout: ${formatCurrency(newJobData.amount, newJobData.currency || userCurrencyState?.code)}\n` +
        `Location: ${jobLocation}\n\n` +
        `Details: ${newJobData.description || 'Quick task'}`;

      api.notifyAdmin('New Job Posted', adminMessageBody);
      
      // OTP state update
      setOtpGenerated(otp);

      // Reset crew state from any previous job session
      setCrewTaskers([]);
      setLiveStatus('posted');

      pushScreen('live_status', true);
      showToast('Task posted successfully!', 'success');
      return { success: true, data: dbJob };
    }

    return { success: false, error: error?.message || 'Failed to post task' };
  };



  // Map Pin static position and live tracking
  useEffect(() => {
    const targetJob = acceptedJob || currentPostedJob;
    const targetJobId = targetJob?.id || null;
    const skill = targetJob ? SKILLS.find(s => s.id === targetJob.skillId || s.id === targetJob.skill_id) : null;
    const isRemote = skill?.type === 'remote';

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
      
      // If tasker role, fetch real location
      if (role === 'tasker') {
        if (isRemote) {
          // For remote tasks, we don't query GPS location. Just use the service area location.
          const sAreaLat = userProfile?.serviceAreaLat || targetJob?.lat || 31.2560;
          const sAreaLng = userProfile?.serviceAreaLng || targetJob?.lng || 75.7051;
          setTrackingTaskerPos({ lat: sAreaLat, lng: sAreaLng });
          setTrackingLocationError(false);
        } else {
          // Fetch location immediately, then setup interval
          const updateLocation = async () => {
            try {
              const loc = await getCurrentLocation();
              setTrackingTaskerPos(loc);
              setTrackingLocationError(false); // Success, clear error

              // Throttling: only update database if tasker has moved > 15m (0.015 km)
              const lastLoc = lastWrittenLocationRef.current;
              const distanceKm = lastLoc ? calculateDistance(loc.lat, loc.lng, lastLoc.lat, lastLoc.lng) : 999;

              if (distanceKm >= 0.015) {
                lastWrittenLocationRef.current = loc;
                // Save only to user_locations database table (scales to multiple taskers, avoids redundant heavy job table writes/realtime syncs)
                await api.upsertUserLocation({
                  user_id: userId,
                  latitude: loc.lat,
                  longitude: loc.lng,
                  updated_at: new Date().toISOString()
                });
              }
            } catch(err) {
              console.error("Live tracking location failed", err);
              setTrackingLocationError(true); // Failed, set error flag
            }
          };

          updateLocation();
          trackingIntervalRef.current = setInterval(updateLocation, 20000);
        }
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
      lastWrittenLocationRef.current = null;
      setTrackingLocationError(false); // Reset error state
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
    setUserProfileState(GOATED_GUEST_PROFILE);
    setUserId(null);
    setRole('tasker');
    setSelectedBird('falcon');
    setIsAdmin(false);
    localStorage.removeItem('activeRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('isOnline');
    localStorage.removeItem('helphive_addresses_v2');
    pushScreen('tasker_home', true);
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
        
        // Update name from Google if it is missing, empty, or default 'New User' / 'Guest User'
        if ((!profile.name || profile.name === 'New User' || profile.name === 'Guest User' || profile.name.trim() === '') && session.user.user_metadata?.full_name) {
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

          let isNewSignup = false;
          if (createErr) {
            console.error('[Auth] Error creating profile:', createErr);
            // If insert failed due to unique constraint (duplicate), try finding again
            const { data: retryProfile } = await api.findProfileByAuthId(authId);
            profile = retryProfile;
          } else {
            profile = newProfile;
            isNewSignup = true;
          }

          if (profile && isNewSignup) {
            trackEvent(EVENTS.SIGNUP, { userId: profile.id, role: activeRole });
          }
        }
      }

      if (profile) {
        // Check if we have cached guest details to merge
        const guestSaved = localStorage.getItem('helphive_guest_profile');
        if (guestSaved) {
          try {
            const guestProfile = JSON.parse(guestSaved);
            const updatesPayload = {
              name: (guestProfile.name && guestProfile.name !== 'New User' && guestProfile.name !== 'Guest User') ? guestProfile.name : profile.name,
              phone: (guestProfile.phone && guestProfile.phone !== 'Add Phone') ? guestProfile.phone : profile.phone,
              upi_id: guestProfile.upiId || profile.upi_id,
              skills: guestProfile.skills || profile.skills || [],
              bird: guestProfile.bird || profile.bird || 'falcon',
              coverage_radius: guestProfile.coverageRadius || profile.coverage_radius,
              service_area_name: guestProfile.serviceAreaName || profile.service_area_name,
              coverage_level: guestProfile.coverageLevel || profile.coverage_level
            };

            if (guestProfile.serviceAreaLat && guestProfile.serviceAreaLng) {
              updatesPayload.location = `POINT(${guestProfile.serviceAreaLng} ${guestProfile.serviceAreaLat})`;
            }

            const { data: updatedDbProfile } = await api.updateProfile(profile.id, updatesPayload);
            if (updatedDbProfile) {
              profile = updatedDbProfile;
            }
            localStorage.removeItem('helphive_guest_profile');

            // Migrate wizard completion states
            const guestWizardTasker = localStorage.getItem('helphive_wizard_completed_tasker_null') || localStorage.getItem('helphive_wizard_completed_tasker_undefined');
            if (guestWizardTasker) {
              localStorage.setItem(`helphive_wizard_completed_tasker_${profile.id}`, guestWizardTasker);
              localStorage.removeItem('helphive_wizard_completed_tasker_null');
              localStorage.removeItem('helphive_wizard_completed_tasker_undefined');
            }
            const guestWizardPoster = localStorage.getItem('helphive_wizard_completed_poster_null') || localStorage.getItem('helphive_wizard_completed_poster_undefined');
            if (guestWizardPoster) {
              localStorage.setItem(`helphive_wizard_completed_poster_${profile.id}`, guestWizardPoster);
              localStorage.removeItem('helphive_wizard_completed_poster_null');
              localStorage.removeItem('helphive_wizard_completed_poster_undefined');
            }
          } catch (mergeErr) {
            console.error('[Auth] Error merging guest profile:', mergeErr);
          }
        }

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
        // Sync with database profile availability status on OAuth/magic-link sign-in
        const profileOnline = profile.is_online ?? true;
        setIsOnlineState(profileOnline);
        localStorage.setItem('isOnline', profileOnline ? 'true' : 'false');

        if (loginCallbackRef.current) {
          const callback = loginCallbackRef.current;
          loginCallbackRef.current = null;
          setShowLoginModal(false);
          callback();
        } else {
          const currentStack = screenStackRef.current;
          const currentScr = currentStack[currentStack.length - 1];
          const isBaseOrAuthScreen = currentScr === 'landing' || currentScr === 'auth_loading';
          
          if (!isAlreadyLoggedIn || isBaseOrAuthScreen) {
            pushScreen(finalRole === 'tasker' ? 'tasker_home' : 'poster_home');
          }
        }

        if (!isAlreadyLoggedIn) {
          showToast('Welcome back!', 'success');
        }
        fetchJobs(true);
        
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
          setRole('tasker');
          setUserProfileState(GOATED_GUEST_PROFILE);
          setScreenStack(['tasker_home']);
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
        logout: resetApp,
        getJobsInRadius,
        trackingTaskerPos,
        setTrackingTaskerPos,
        trackingLocationError,
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
        
        showWizard,
        openOnboardingWizard,
        closeOnboardingWizard,

        showLoginModal,
        setShowLoginModal,
        openLoginModal,

        isAdmin,
        userId,
        isGuest: !userId,
        isProfileLoading,

        // Currency State & Switcher
        currency,
        setCurrency,
        resetCurrency,
        showCurrencyPicker,
        setShowCurrencyPicker
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
