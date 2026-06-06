import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { SERVICE_AREAS } from '../config/serviceAreas';
import { api } from '../services/api';
import { trackEvent, EVENTS } from '../utils/eventTracker';
import { ToastContext } from './ToastContext';

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
        const mappedJobs = data.map(j => ({
          ...j,
          posterId: j.poster_id,
          taskerId: j.tasker_id,
          skillId: j.skill_id,
          peopleNeeded: j.people_needed,
          timePosted: j.created_at,
          lng: j.location ? j.location.coordinates[0] : 0,
          lat: j.location ? j.location.coordinates[1] : 0,
        }));
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
            bird: data.bird
          });
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
          bird: data.bird
        });
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
    
    // Optimistic update so UI reflects immediately, even in demo mode or if Supabase fails
    setUserProfileState(prev => prev ? { ...prev, ...profileData, ...roleSpecificUpdates } : { id: userId || 'demo-id', ...profileData, ...roleSpecificUpdates });

    if (userId) {
      const { data, error } = await api.updateProfile(userId, {
        name: profileData.name !== undefined ? profileData.name : userProfile?.name,
        phone: profileData.phone !== undefined ? profileData.phone : userProfile?.phone,
        ...roleSpecificUpdates,
        skills: profileData.skills || userProfile?.skills || [],
        bird: selectedBird,
        location: locationStr
      });

      if (data) {
        setUserProfileState(prev => ({
          ...prev,
          ...profileData,
          ...roleSpecificUpdates
        }));
      }
    } else if (profileData.phone) {
      const { data, error } = await api.createProfile({
        name: profileData.name || 'Guest User',
        phone: profileData.phone,
        ...roleSpecificUpdates,
        role: role,
        city_id: userLocation?.id,
        rating: profileData.rating || 5.0,
        tasks_completed: profileData.tasksCompleted || 0,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr
      });

      if (data) {
        setUserId(data.id);
        localStorage.setItem('userId', data.id);
        setUserProfileState(prev => ({
          ...prev,
          id: data.id
        }));
        trackEvent(EVENTS.SIGNUP, { userId: data.id, role: role });
      }
    }
  };

  const [activeTab, setActiveTab] = useState('home'); // For tasker: 'home' | 'profile'
  
  // Profile Action Interceptor
  const [profileActionCallback, setProfileActionCallback] = useState(null);

  const requireProfile = (callback) => {
    const currentName = userProfile?.name;
    const currentPhone = userProfile?.phone;
    
    if (currentName && currentPhone) {
      callback();
    } else {
      setProfileActionCallback(() => callback);
    }
  };

  const completeProfileAction = async (name, phone) => {
    await setUserProfile({ name, phone, verifiedPhone: phone });
    if (profileActionCallback) {
      profileActionCallback();
      setProfileActionCallback(null);
    }
  };

  const cancelProfileAction = () => {
    setProfileActionCallback(null);
  };

  // Tasker-specific states
  const [acceptedJob, setAcceptedJob] = useState(null); 
  const [otpEntered, setOtpEntered] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  
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

  // Navigation push & pop
  const pushScreen = (screen) => {
    // If base screen of a flow, reset history stack base
    if (screen === 'landing' || screen === 'tasker_home' || screen === 'poster_home') {
      setScreenStack([screen]);
    } else {
      setScreenStack(prev => [...prev, screen]);
      window.history.pushState({ screen }, '', window.location.pathname);
    }
  };

  const popScreen = () => {
    // Check if on first screen of a flow
    const firstScreens = ['landing', 'tasker_home', 'poster_home'];
    if (firstScreens.includes(currentScreen) || screenStack.length <= 1) {
      // Do nothing, block accidental exits
      return;
    }
    window.history.back();
  };

  const switchRole = async (newRole) => {
    setRole(newRole);
    localStorage.setItem('activeRole', newRole);
    
    if (userId) {
      // Async update to DB without blocking UI
      api.updateProfile(userId, { role: newRole }).then();
      trackEvent(EVENTS.ROLE_SWITCH, { userId, role: newRole });
    }

    if (newRole === 'tasker') {
      pushScreen('tasker_home');
    } else {
      pushScreen('poster_home');
    }
  };

  // Sync browser back button with custom history stack
  useEffect(() => {
    // Initialize history state on load
    window.history.replaceState({ screen: 'landing' }, '', window.location.pathname);

    const handlePopState = (e) => {
      // Prevent browser from navigating back further if stack is active
      if (screenStack.length > 1) {
        setScreenStack(prev => prev.slice(0, -1));
      } else {
        // Keep in current base screen
        window.history.pushState({ screen: currentScreen }, '', window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screenStack, currentScreen]);

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
    const openJobs = jobs.filter(j => j.status === 'open');
    
    let enrichedJobs = openJobs.map(job => {
      let distanceVal = 5.0; // fallback radius max
      if (realLocation && job.lat && job.lng) {
        distanceVal = calculateDistance(realLocation.lat, realLocation.lng, job.lat, job.lng);
      } else if (job.distanceVal) {
        distanceVal = job.distanceVal; // fallback for mock data
      }
      return {
        ...job,
        distanceVal
      };
    });

    if (realLocation) {
      enrichedJobs.sort((a, b) => a.distanceVal - b.distanceVal);
    }

    return {
      jobsList: enrichedJobs,
      radius: 5,
      message: 'Showing results in your area'
    };
  };

  // Tasker accepts a job
  const acceptJob = async (jobId) => {
    const tId = userProfileState?.id || userId || 'demo-id';
    const tName = userProfileState?.taskerName || userProfileState?.name || 'Tasker';
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'accepted', taskerId: tId, taskerName: tName } : j)
    );
    const job = jobs.find(j => j.id === jobId);
    const updatedJob = { ...job, status: 'accepted', taskerId: tId, taskerName: tName };
    setAcceptedJob(updatedJob);
    
    // Backend update
    await api.updateJob(jobId, { status: 'accepted', tasker_id: tId, tasker_name: tName });
    trackEvent(EVENTS.TASK_ACCEPTANCE, { userId: tId, role, entityId: jobId });

    // Send Notification to Hirer
    if (job.posterId) {
      api.sendNotification(
        job.posterId,
        "Job Accepted!",
        `${tName} has accepted your job and is on their way.`,
        'crew_confirmed'
      );
    }

    // Start tracking simulation
    const startLat = job.lat + 0.012; // Start roughly 1.5km away
    const startLng = job.lng - 0.012;
    setTrackingTaskerPos({ lat: startLat, lng: startLng });
    setAnimationTick(0);

    pushScreen('tasker_accepted_job');
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
        'rating_screen'
      );
    }

    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    pushScreen('tasker_rating');
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

    const { data, error } = await api.postJob({
      posterId: userId,
      skillId: newJobData.skillId,
      description: newJobData.description || 'Quick task',
      peopleNeeded: newJobData.peopleNeeded || 1,
      amount: newJobData.amount,
      locationStr: locationStr
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
      trackEvent(EVENTS.TASK_CREATION, { userId, role, entityId: data.id, metadata: { amount: newJobData.amount } });
    } else {
      console.error('Failed to post job:', error);
    }
    
    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setOtpGenerated(otp);

    pushScreen('live_status');
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

  // Map Pin static position
  useEffect(() => {
    const targetJob = acceptedJob || currentPostedJob;
    const isJobActive = (currentScreen === 'tasker_accepted_job' && acceptedJob) || 
                        (currentScreen === 'crew_confirmed' && crewTaskers.length > 0 && currentPostedJob);

    if (isJobActive && targetJob) {
      setTrackingTaskerPos({ lat: targetJob.lat, lng: targetJob.lng });
    }
  }, [currentScreen, acceptedJob, currentPostedJob, crewTaskers]);

  // Listen for real job acceptance via Supabase
  useEffect(() => {
    if (currentScreen === 'live_status' && currentPostedJob) {
      const updatedJob = jobs.find(j => j.id === currentPostedJob.id);
      
      if (updatedJob && updatedJob.taskerId && updatedJob.status === 'accepted') {
        const taskerInfo = {
          id: updatedJob.taskerId,
          name: updatedJob.taskerName,
          rating: 5.0, // Should be fetched from profile
          tasksCompleted: 1,
          bird: 'falcon'
        };
        
        setCrewTaskers([taskerInfo]);
        setLiveStatus('crew_set');
        pushScreen('crew_confirmed');
      }
    }
  }, [jobs, currentScreen, currentPostedJob, pushScreen]);

  // Reset helper
  const resetApp = () => {
    if (userId) trackEvent(EVENTS.LOGOUT, { userId, role });
    setRole(null);
    setUserLocation(null);
    setLocationPermission('prompt');
    setUserProfile(null);
    setSelectedBird('falcon');
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
        loginWithPhone
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
