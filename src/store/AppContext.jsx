import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { SERVICE_AREAS } from '../config/serviceAreas';
import { api } from '../services/api';
import { trackEvent, EVENTS } from '../utils/eventTracker';
import { ToastContext } from './ToastContext';
import { parseEWKBPoint, getCurrentLocation } from '../utils/location';

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

export const AppProvider = ({ children }) => {
  const { showToast } = useContext(ToastContext);


  // State to track scroll target for tasker activity screen
  const [taskerActivityScrollTarget, setTaskerActivityScrollTarget] = useState(null);

  // Global State for role & profiles
  const [role, setRole] = useState(() => localStorage.getItem('activeRole')); // 'tasker' | 'poster'
  const [userProfile, setUserProfileState] = useState(null); // { name, phone, skills, rating, tasksCompleted }
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [selectedBird, setSelectedBird] = useState('falcon'); // Bird avatar selection
  const [isAdmin, setIsAdmin] = useState(false); // Admin dashboard access
  
  // Navigation stack state
  const [screenStack, setScreenStack] = useState(() => {
    const activeRole = localStorage.getItem('activeRole');
    const storedUserId = localStorage.getItem('userId');
    if (activeRole && storedUserId) {
      return [activeRole === 'tasker' ? 'tasker_home' : 'poster_home'];
    }
    return ['landing'];
  });
  const currentScreen = screenStack[screenStack.length - 1];

  // Location States
  const [locationPermission, setLocationPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [userLocation, setUserLocation] = useState(SERVICE_AREAS[0]); // Always default to LPU
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [realLocation, setRealLocation] = useState(null); // Actual GPS coordinates {lat, lng}
  
  // Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState(() => {
    const saved = localStorage.getItem('helphive_addresses_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Effect to persist savedAddresses
  useEffect(() => {
    localStorage.setItem('helphive_addresses_v2', JSON.stringify(savedAddresses));
  }, [savedAddresses]);
  
  // Job and tasker registers
  const [jobs, setJobs] = useState([]);
  const [taskers, setTaskers] = useState([]);

  // Fetch jobs from API
  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await api.fetchJobs();
      if (data) {
        const mappedJobs = data.map(j => {
          const coords = parseEWKBPoint(j.location) || { lng: j.lng || 0, lat: j.lat || 0 };
          return {
            ...j,
            posterId: j.posterId || j.poster_id,
            taskerId: j.taskerId || j.tasker_id,
            skillId: j.skillId || j.skill_id,
            peopleNeeded: j.peopleNeeded || j.people_needed,
            timePosted: j.timePosted || j.created_at,
            lng: coords.lng,
            lat: coords.lat,
          };
        });
        setJobs(mappedJobs);
      }
    };
    fetchJobs();

    const sub = api.subscribeToJobs(() => {
        fetchJobs();
      });

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
    };
  }, []);

  // Fetch profile if returning user
  useEffect(() => {
    if (userId && !userProfile) {
      const fetchProfile = async () => {
        const { data } = await api.fetchProfile(userId);
        if (data) {
          setUserProfileState({
            id: data.id,
            name: data.name,
            phone: data.phone,
            posterName: data.posterName || data.name,
            posterPhone: data.posterPhone || data.phone,
            taskerName: data.taskerName || data.name,
            taskerPhone: data.taskerPhone || data.phone,
            verifiedPhones: data.verifiedPhones || [],
            skills: data.skills || [],
            rating: data.rating,
            tasksCompleted: data.tasks_completed,
            bird: data.bird,
            upiId: data.upi_id || ''
          });
          setIsAdmin(data.is_admin === true);
          if (data.is_online !== undefined && data.is_online !== null) {
            setIsOnlineState(data.is_online);
            localStorage.setItem('isOnline', JSON.stringify(data.is_online));
          }
          const activeRole = localStorage.getItem('activeRole') || data.role;
          setRole(activeRole);
          localStorage.setItem('activeRole', activeRole);
          trackEvent(EVENTS.LOGIN, { userId: data.id, role: activeRole });
        } else {
          // Profile not found in DB (zombie state), clear local storage
          localStorage.removeItem('userId');
          localStorage.removeItem('activeRole');
          setUserId(null);
          setRole(null);
          setScreenStack(['landing']);
        }
      };
      fetchProfile();
    }
  }, [userId]);

  const loginWithPhone = async (phone) => {
    try {
      const { data, error } = await api.findProfileByPhone(phone);
      
      if (error) {
        if (error.code === 'PGRST116') {
          // 0 rows returned - account not found
          return { success: false, reason: 'not_found' };
        }
        // Other errors (timeout, connection, etc.)
        console.error("Login DB error:", error);
        return { success: false, reason: 'network' };
      }

      if (data) {
        setUserId(data.id);
        localStorage.setItem('userId', data.id);
        setUserProfileState({
          id: data.id,
          name: data.name,
          phone: data.phone,
          posterName: data.posterName || data.name,
          posterPhone: data.posterPhone || data.phone,
          taskerName: data.taskerName || data.name,
          taskerPhone: data.taskerPhone || data.phone,
          verifiedPhones: data.verifiedPhones || [],
          skills: data.skills || [],
          rating: data.rating,
          tasksCompleted: data.tasks_completed,
          bird: data.bird,
          upiId: data.upi_id || ''
        });
        setIsAdmin(data.is_admin === true);
        if (data.is_online !== undefined && data.is_online !== null) {
          setIsOnlineState(data.is_online);
          localStorage.setItem('isOnline', JSON.stringify(data.is_online));
        }
        const activeRole = data.role || 'tasker';
        setRole(activeRole);
        localStorage.setItem('activeRole', activeRole);
        trackEvent(EVENTS.LOGIN, { userId: data.id, role: activeRole });
        
        pushScreen(activeRole === 'tasker' ? 'tasker_home' : 'poster_home');
        showToast('Welcome back!', 'success');
        return { success: true };
      }
      
      return { success: false, reason: 'not_found' };
    } catch (err) {
      console.error("Login throw:", err);
      return { success: false, reason: 'network' };
    }
  };

  const setUserProfile = async (profileData) => {
    let locationStr = null;
    if (userLocation) {
      locationStr = `POINT(${userLocation.lng} ${userLocation.lat})`;
    }
    
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

    // Optimistic update so UI reflects immediately
    setUserProfileState(prev => prev ? { ...prev, ...profileData, ...roleSpecificUpdates } : { id: currentUserId || 'demo-id', ...profileData, ...roleSpecificUpdates });

    if (currentUserId) {
      const { data, error } = await api.updateProfile(currentUserId, {
        name: profileData.name !== undefined ? profileData.name : userProfile?.name,
        phone: profileData.phone !== undefined ? profileData.phone : userProfile?.phone,
        upi_id: profileData.upiId !== undefined ? profileData.upiId : userProfile?.upiId,
        skills: profileData.skills || userProfile?.skills || [],
        bird: selectedBird,
        location: locationStr
      });

      if (error) {
        // Rollback optimistic update on failure
        console.error('setUserProfile: DB update failed, rolling back', error);
        if (previousProfile) {
          setUserProfileState(previousProfile);
        }
        return { success: false, error: 'Failed to save. Please try again.' };
      }

      if (data) {
        setUserProfileState(prev => ({
          ...prev,
          ...profileData,
          ...roleSpecificUpdates
        }));
      }
      return { success: true };
    } else if (profileData.phone) {
      const { data, error } = await api.createProfile({
        name: profileData.name || 'Guest User',
        phone: profileData.phone,
        role: role,
        city_id: userLocation?.id,
        rating: profileData.rating || 5.0,
        tasks_completed: profileData.tasksCompleted || 0,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr,
        upi_id: profileData.upiId || null
      });

      if (error) {
        console.error('setUserProfile: DB create failed, rolling back', error);
        if (previousProfile) {
          setUserProfileState(previousProfile);
        }
        return { success: false, error: 'Failed to create profile. Please try again.' };
      }

      if (data) {
        setUserId(data.id);
        localStorage.setItem('userId', data.id);
        setUserProfileState(prev => ({
          ...prev,
          id: data.id
        }));
        trackEvent(EVENTS.SIGNUP, { userId: data.id, role: role });
      }
      return { success: true };
    }
    return { success: true };
  };

  const [activeTab, setActiveTabState] = useState('home'); // For tasker: 'home' | 'profile'
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    activeTabRef.current = tab;
  };
  
  // Profile Action Interceptor
  const [profileActionCallback, setProfileActionCallback] = useState(null);

  const requireProfile = (callback) => {
    const currentName = userProfile?.name;
    const currentPhone = userProfile?.phone;
    
    // Validate if the user actually has a real name and phone set
    // This ensures both Tasker and Hirer use the same unified profile data
    const hasValidName = currentName && currentName !== 'Guest User' && currentName !== 'New User';
    const hasValidPhone = currentPhone && currentPhone !== 'Add Phone';
    
    if (hasValidName && hasValidPhone) {
      callback();
    } else {
      setProfileActionCallback(() => callback);
    }
  };

  const completeProfileAction = async (name, phone) => {
    const res = await setUserProfile({ name, phone, verifiedPhone: phone });
    if (res && res.success === false) {
      return res;
    }
    if (profileActionCallback) {
      // Await in case the callback is async (e.g. saving skills)
      await profileActionCallback();
      setProfileActionCallback(null);
    }
    return { success: true };
  };

  const cancelProfileAction = () => {
    setProfileActionCallback(null);
  };

  // Tasker-specific states
  const [acceptedJob, setAcceptedJob] = useState(null); 
  const [otpEntered, setOtpEntered] = useState('');
  
  const [isOnline, setIsOnlineState] = useState(() => {
    const saved = localStorage.getItem('isOnline');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const setIsOnline = async (online) => {
    setIsOnlineState(online);
    localStorage.setItem('isOnline', JSON.stringify(online));
    const currentUserId = userId || localStorage.getItem('userId');
    if (currentUserId) {
      await api.updateProfile(currentUserId, { is_online: online });
    }
  };
  
  // Poster-specific states
  const [currentPostedJob, setCurrentPostedJob] = useState(null); 
  const [crewTaskers, setCrewTaskers] = useState([]);
  const [liveStatus, setLiveStatus] = useState('posted'); // 'posted', 'crew_set', 'completed'
  const [otpGenerated, setOtpGenerated] = useState('');
  const [editJobData, setEditJobData] = useState(null);
  const [jobHistoryTab, setJobHistoryTab] = useState('active'); // 'active', 'unfulfilled', 'completed'

  const deleteJob = async (jobId) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (userId) {
      await api.deleteJob(jobId);
    }
  };

  const expireJob = async (jobId) => {
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'expired' } : j)
    );
    if (userId) {
      await api.updateJob(jobId, { status: 'expired' });
    }
  };
  
  // Live Tracking state (30 seconds map pin animation)
  const [trackingTaskerPos, setTrackingTaskerPos] = useState(null); // { lat, lng }
  const [animationTick, setAnimationTick] = useState(0);
  const trackingIntervalRef = useRef(null);

  // Email notifications for coming soon
  const [leadNotifications, setLeadNotifications] = useState([]);

  // ── Navigation: push, pop, and browser history sync ──────────────────
  // Use refs so the popstate handler always reads the latest values
  // without needing to re-register the listener on every state change.
  const screenStackRef = useRef(screenStack);
  const activeTabRef = useRef('home');
  useEffect(() => { screenStackRef.current = screenStack; }, [screenStack]);

  const pushScreen = (screen, replaceStack = false) => {
    if (screen === 'landing' || screen === 'tasker_home' || screen === 'poster_home') {
      // Reset stack to base screen
      setScreenStack([screen]);
      // Replace current history entry so base screen becomes the floor
      window.history.replaceState({ screen, base: true }, '', window.location.pathname);
    } else if (replaceStack) {
      const base = role === 'tasker' ? 'tasker_home' : 'poster_home';
      setScreenStack([base, screen]);
      window.history.pushState({ screen }, '', window.location.pathname);
    } else {
      setScreenStack(prev => [...prev, screen]);
      window.history.pushState({ screen }, '', window.location.pathname);
    }
  };

  const popScreen = () => {
    const firstScreens = ['landing', 'tasker_home', 'poster_home'];
    if (firstScreens.includes(currentScreen) || screenStack.length <= 1) {
      return; // Block accidental exits from home screens
    }
    window.history.back(); // Triggers popstate → handled below
  };

  const switchRole = async (newRole) => {
    setRole(newRole);
    localStorage.setItem('activeRole', newRole);
    
    if (userId) {
      api.updateProfile(userId, { role: newRole }).then();
      trackEvent(EVENTS.ROLE_SWITCH, { userId, role: newRole });
    }

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
    window.history.replaceState({ screen: '__floor__', floor: true }, '', window.location.pathname);
    window.history.pushState({ screen: screenStackRef.current[screenStackRef.current.length - 1] || 'landing' }, '', window.location.pathname);

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

  // Change user location helper (kept for future expansion, currently defaults to LPU)
  const changeLocation = async (area) => {
    setUserLocation(area);
    
    // Save to local storage
    localStorage.setItem('userLocation', JSON.stringify(area));

    // Save to backend if user is logged in
    if (userId) {
      await api.upsertUserLocation({
        user_id: userId,
        area_name: area.name,
        city: 'LPU',
        latitude: 0,
        longitude: 0,
        updated_at: new Date().toISOString()
      });
    }
  };

  // Radius Logic for Job Feeds
  const getJobsInRadius = () => {
    const openJobs = (jobs || []).filter(j => j?.status === 'open');
    
    let enrichedJobs = openJobs.map(job => {
      let distanceVal = 5.0; // fallback radius max
      if (realLocation && job?.lat && job?.lng) {
        distanceVal = calculateDistance(realLocation.lat, realLocation.lng, job.lat, job.lng);
      } else if (job?.distanceVal) {
        distanceVal = job.distanceVal; // fallback for mock data
      }
      return {
        ...(job || {}),
        distanceVal
      };
    });

    if (realLocation) {
      enrichedJobs.sort((a, b) => (a?.distanceVal || 0) - (b?.distanceVal || 0));
    }

    return {
      jobsList: enrichedJobs,
      radius: 5,
      message: 'Showing results in your area'
    };
  };

  // Tasker accepts a job
  const acceptJob = async (jobId) => {
    const tId = userProfile?.id || userId || localStorage.getItem('userId') || 'demo-id';
    const tName = userProfile?.taskerName || userProfile?.name || 'Tasker';
    const tBird = userProfile?.bird || 'falcon';
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'accepted', taskerId: tId, taskerName: tName, taskerBird: tBird } : j)
    );
    const job = jobs.find(j => j.id === jobId);
    const updatedJob = { ...job, status: 'accepted', taskerId: tId, taskerName: tName, taskerBird: tBird };
    setAcceptedJob(updatedJob);
    
    // Backend update (removed tasker_name since it is not in DB schema)
    await api.updateJob(jobId, { status: 'accepted', tasker_id: tId });
    trackEvent(EVENTS.TASK_ACCEPTANCE, { userId: tId, role, entityId: jobId });

    // Send Notification to Hirer
    if (job.posterId) {
      api.sendNotification(
        job.posterId,
        "Job Accepted!",
        `${tName} has accepted your job and is on their way.`,
        'crew_confirmed',
        'job_accepted'
      );
    }

    // Start tracking simulation
    const startLat = job.lat + 0.012; // Start roughly 1.5km away
    const startLng = job.lng - 0.012;
    setTrackingTaskerPos({ lat: startLat, lng: startLng });
    setAnimationTick(0);

    pushScreen('tasker_accepted_job', true);
  };

  // Tasker completes a job
  const completeJob = async (jobId) => {
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'completed' } : j)
    );
    const job = jobs.find(j => j.id === jobId);
    await api.updateJob(jobId, { status: 'completed' });
    trackEvent(EVENTS.TASK_COMPLETION, { userId, role, entityId: jobId });

    // Send Notification to Hirer
    if (job && job.posterId) {
      api.sendNotification(
        job.posterId,
        "Job Completed!",
        "Your tasker has marked the job as complete. Please review and pay.",
        'rating_screen',
        'job_completed'
      );
    }

    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    pushScreen('tasker_rating', true);
  };

  // Poster posts a job
  const postJob = async (newJobData) => {
    if (newJobData.amount === undefined || newJobData.amount === null || isNaN(newJobData.amount) || newJobData.amount < 0) {
      console.error('Failed to post job: Payout amount must be greater than or equal to ₹0');
      return;
    }

    let locationStr = null;
    if (userLocation) {
      locationStr = `POINT(${userLocation.lng} ${userLocation.lat})`;
    }

    // Calculate expiration timestamp
    const dateObj = new Date(newJobData.day);
    const [timeStr, ampmStr] = newJobData.time.split(' ');
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (ampmStr === 'PM' && hours < 12) hours += 12;
    if (ampmStr === 'AM' && hours === 12) hours = 0;
    dateObj.setHours(hours, minutes, 0, 0);
    const expiresAt = dateObj.toISOString();

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
      description: newJobData.description || 'Quick task',
      peopleNeeded: newJobData.peopleNeeded || 1,
      amount: newJobData.amount,
      locationStr: locationStr,
      otp: otp
    });

    if (data) {
      const dbJob = {
        ...data,
        ...newJobData,
        id: data.id,
        posterId: data.poster_id,
        posterName: userProfile?.posterName || userProfile?.name || 'Unknown Hirer',
        posterBird: selectedBird || 'robin',
        skillId: data.skill_id,
        timePosted: data.created_at,
        expiresAt,
        lng: userLocation?.lng || 0,
        lat: userLocation?.lat || 0
      };
      setJobs(prev => [dbJob, ...prev]);
      setCurrentPostedJob(dbJob);
      trackEvent(EVENTS.TASK_CREATION, { userId: currentUserId, role, entityId: data.id, metadata: { amount: newJobData.amount } });
      // OTP state update
      setOtpGenerated(otp);

      pushScreen('live_status');
      showToast('Job posted successfully!', 'success');
    } else {
      console.error('Failed to post job:', error);
      showToast('Failed to post job. Please try again.', 'error');
    }
  };

  const saveDraftJob = (draftData) => {
    setJobs(prev => {
      const withoutDrafts = prev.filter(j => j.id !== draftData.id && j.status !== 'draft');
      return [{
        ...draftData,
        id: draftData.id || ('draft_' + Date.now()),
        posterId: userId || 'demo_poster',
        posterName: userProfile?.posterName || userProfile?.name || 'Unknown Hirer',
        timePosted: new Date().toISOString(),
        status: 'draft'
      }, ...withoutDrafts];
    });
  };

  // Map Pin static position and live tracking
  useEffect(() => {
    const targetJob = acceptedJob || currentPostedJob;
    const isJobActive = (currentScreen === 'tasker_accepted_job' && acceptedJob) || 
                        (currentScreen === 'crew_confirmed' && crewTaskers.length > 0 && currentPostedJob);

    if (isJobActive && targetJob) {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
      
      // If tasker role, fetch real location every 5 seconds to update map
      if (role === 'tasker') {
        // Start interval
        trackingIntervalRef.current = setInterval(async () => {
          try {
            const loc = await getCurrentLocation();
            setTrackingTaskerPos(loc);
          } catch(err) {
            console.error("Live tracking location failed", err);
          }
        }, 5000);
      } else {
        // For poster view without real-time backend updates in this demo,
        // we just show the destination pin.
        setTrackingTaskerPos({ lat: targetJob.lat, lng: targetJob.lng });
      }
    } else {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    }

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [currentScreen, acceptedJob, currentPostedJob, crewTaskers, role]);

  // Listen for real job acceptance via Supabase
  useEffect(() => {
    if (currentScreen === 'live_status' && currentPostedJob) {
      const updatedJob = jobs.find(j => j.id === currentPostedJob.id);
      
      if (updatedJob && updatedJob.taskerId && updatedJob.status === 'accepted') {
        const taskerInfo = {
          id: updatedJob.taskerId,
          name: updatedJob.taskerName || 'Helper',
          rating: 5.0, // Should be fetched from profile
          tasksCompleted: 1,
          bird: updatedJob.taskerBird || 'falcon',
          upiId: updatedJob.taskerUpi
        };
        
        setCrewTaskers([taskerInfo]);
        setLiveStatus('crew_set');
        pushScreen('crew_confirmed', true);
      }
    }
  }, [jobs, currentScreen, currentPostedJob, pushScreen]);

  // Reset helper
  const resetApp = () => {
    if (userId) trackEvent(EVENTS.LOGOUT, { userId, role });
    setRole(null);
    setUserLocation(SERVICE_AREAS[0]);
    setLocationPermission('prompt');
    setUserProfileState(null);
    setUserId(null);
    setSelectedBird('falcon');
    setIsAdmin(false);
    localStorage.removeItem('activeRole');
    localStorage.removeItem('userId');
    setScreenStack(['landing']);
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
        setSavedAddresses,
        userProfile,
        setUserProfile,
        currentScreen,
        pushScreen,
        popScreen,
        switchRole,
        screenStack,
        jobs,
        setJobs,
        taskers,
        activeTab,
        setActiveTab,
        acceptedJob,
        setAcceptedJob,
        acceptJob,
        completeJob,
        currentPostedJob,
        setCurrentPostedJob,
        postJob,
        editJobData,
        setEditJobData,
        jobHistoryTab,
        setJobHistoryTab,
        taskerActivityScrollTarget,
        setTaskerActivityScrollTarget,
        deleteJob,
        expireJob,
        saveDraftJob,
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
        
        selectedBird,
        setSelectedBird,
        isOnline,
        setIsOnline,
        
        profileActionCallback,
        requireProfile,
        completeProfileAction,
        cancelProfileAction,
        loginWithPhone,
        isAdmin,
        userId
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
