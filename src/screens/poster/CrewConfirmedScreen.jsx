import React, { useState, useContext, useEffect } from 'react';
import { Sparkles, Star, ShieldCheck, KeyRound, ArrowRight, ArrowLeft, Phone, Check, MapPin, Compass, ShieldAlert } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import Tooltip from '../../components/Tooltip';
import MapView from '../../components/MapView';
import BirdAvatar from '../../components/BirdAvatars';
import { api } from '../../services/api';
import { SKILLS } from '../../config/constants';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const CrewConfirmedScreen = () => {
  const { 
    currentPostedJob, 
    setCurrentPostedJob,
    setJobs,
    crewTaskers, 
    setCrewTaskers,
    otpGenerated, 
    pushScreen, 
    popScreen,
    trackingTaskerPos, 
    userId,
    userProfile
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const skill = SKILLS.find(s => s.id === currentPostedJob?.skillId || s.id === currentPostedJob?.skill_id);
  const isRemote = skill?.type === 'remote';
  
  const [localCrewTaskers, setLocalCrewTaskers] = useState(crewTaskers || []);
  const [isLoadingCrew, setIsLoadingCrew] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [paymentOption, setPaymentOption] = useState('online'); // 'online' or 'offline'
  const [paymentInitiated, setPaymentInitiated] = useState(() => {
    return localStorage.getItem(`payment_initiated_${currentPostedJob?.id}`) === 'true';
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentsTracker, setPaymentsTracker] = useState({});
  const [hasDecidedToContinue, setHasDecidedToContinue] = useState(false);

  const [crewLocations, setCrewLocations] = useState({});
  const activeCrew = localCrewTaskers.filter(t => t.status === 'accepted');
  const allHelpersVerified = activeCrew.length > 0 && activeCrew.every(t => t.otpVerified);
  const verifiedCount = activeCrew.filter(t => t.otpVerified).length;

  // Poll the crew members from the API periodically to capture accepts/cancels in real-time
  useEffect(() => {
    if (!currentPostedJob?.id) return;
    
    let isMounted = true;
    const loadCrew = async () => {
      try {
        const { data } = await api.fetchJobCrew(currentPostedJob.id);
        if (data && isMounted) {
          setLocalCrewTaskers(data);
          setCrewTaskers(data);
        }
      } catch (err) {
        console.error('[CrewConfirmedScreen] Failed to load crew:', err);
      }
    };

    loadCrew();
    
    // Focused Supabase Realtime Subscription replacing the 5-second polling loop
    const channel = api.supabase
      .channel(`crew-confirmed-${currentPostedJob.id}-${Math.random().toString(36).substring(2, 10)}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'job_offers', 
        filter: `job_id=eq.${currentPostedJob.id}` 
      }, () => {
        if (isMounted) loadCrew();
      })
      .subscribe();

    return () => {
      isMounted = false;
      api.supabase.removeChannel(channel);
    };
  }, [currentPostedJob?.id]);

  // Fetch and update live coordinates of all crew taskers from user_locations table
  const crewIdsString = localCrewTaskers.map(t => t.id).filter(Boolean).join(',');

  useEffect(() => {
    if (!crewIdsString) return;
    const ids = crewIdsString.split(',');
    
    const fetchLocations = async () => {
      try {
        const { data, error } = await api.fetchUserLocations(ids);
        if (data) {
          const locs = {};
          data.forEach(loc => {
            locs[loc.user_id] = { lat: loc.latitude, lng: loc.longitude };
          });
          setCrewLocations(prev => ({ ...prev, ...locs }));
        }
      } catch (err) {
        console.error('[CrewConfirmedScreen] Failed to fetch tasker locations:', err);
      }
    };

    // Initial fetch
    fetchLocations();

    // Setup Supabase Real-time listener for user_locations changes (very resource efficient)
    const channel = api.supabase
      .channel(`crew-locations-${currentPostedJob.id}-${Math.random().toString(36).substring(2, 10)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_locations'
      }, (payload) => {
        const newLoc = payload.new;
        if (newLoc && ids.includes(newLoc.user_id)) {
          setCrewLocations(prev => ({
            ...prev,
            [newLoc.user_id]: { lat: newLoc.latitude, lng: newLoc.longitude }
          }));
        }
      })
      .subscribe();

    // Slow safety polling loop (20 seconds fallback)
    const interval = setInterval(fetchLocations, 20000);
    
    return () => {
      api.supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [crewIdsString]);

  // Real-time synchronization redirect loop
  useEffect(() => {
    if (!currentPostedJob) {
      pushScreen('poster_home', true);
      return;
    }
    // Bug 2.5 fix: redirect to rating screen when job is marked completed
    if (currentPostedJob.status === 'completed') {
      pushScreen('rating_screen', true);
    } else if (currentPostedJob.status === 'open') {
      showToast('Your helper has cancelled. Redirecting back to search...', 'info');
      pushScreen('live_status', true);
    } else if (currentPostedJob.status === 'cancelled') {
      showToast('Task cancelled.', 'info');
      pushScreen('poster_home', true);
    }
  }, [currentPostedJob, pushScreen, showToast]);

  const handlePayOnlineForTasker = (tasker) => {
    const taskerUpi = tasker?.upiId || 'helphive@upi';
    const amount = currentPostedJob?.amount || 0;
    const taskTitle = currentPostedJob?.description || 'Task';
    
    // Construct UPI Deep Link
    const upiLink = `upi://pay?pa=${taskerUpi}&pn=${encodeURIComponent(tasker?.name || 'Helper')}&am=${amount}&cu=INR&tn=${encodeURIComponent('HelpHive Task: ' + taskTitle.substring(0, 20))}`;
    
    // Save to localStorage
    if (currentPostedJob?.id) {
      localStorage.setItem(`payment_initiated_${currentPostedJob.id}_${tasker.id}`, 'true');
      setPaymentsTracker(prev => ({ ...prev, [tasker.id]: true }));
    }

    // Open link
    window.location.assign(upiLink);
  };

  const handleCompleteTask = async () => {
    if (!currentPostedJob) return;
    setIsCompleting(true);

    try {
      const jobId = currentPostedJob.id;
      
      // Optimistic UI updates
      setJobs(prevJobs => 
        prevJobs.map(j => j.id === jobId ? { ...j, status: 'completed', v2_status: 'completed' } : j)
      );
      setCurrentPostedJob(prev => prev ? { ...prev, status: 'completed', v2_status: 'completed' } : null);

      // Database update
      await api.updateJob(jobId, { status: 'completed', v2_status: 'completed' });

      // Analytics: V2 Marketplace Metric
      if (!userProfile?.posterTasksCompleted) {
        api.logEvent('first_job_completed', { userId, role: 'poster', entityId: jobId });
      }

      // Clean up local storage
      localCrewTaskers.forEach(tasker => {
        localStorage.removeItem(`payment_initiated_${jobId}_${tasker.id}`);
      });
      localStorage.removeItem(`payment_initiated_${jobId}`);

      setShowConfirmModal(false);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleWhatsAppSupport = () => {
    const skill = SKILLS.find(s => s.id === currentPostedJob?.skillId);
    const taskTitle = skill?.label || 'General Task';
    
    const message = `Hi HelpHive Support,\n\nI need help with a task.\n\nTask ID: ${currentPostedJob?.id || 'N/A'}\nTask Title: ${taskTitle}\nAmount: ₹${currentPostedJob?.amount || 0}\nStatus: ${currentPostedJob?.status || 'N/A'}\n\nHirer ID: ${currentPostedJob?.posterId || userId || 'N/A'}\nTasker ID(s): ${localCrewTaskers.map(t => t.id).join(', ') || 'N/A'}\n\nIssue: `;

    const whatsappUrl = `https://wa.me/919347442426?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleWhatsAppHelper = (tasker) => {
    if (!tasker) return;
    const taskTitle = currentPostedJob?.description || 'Task';
    const message = `Hi ${tasker?.name || 'Helper'},\n\nI'm contacting you regarding our HelpHive task.\n\nTask ID: ${currentPostedJob?.id || 'N/A'}\nTask: ${taskTitle}\n\nMessage: `;
    const taskerPhone = tasker?.phone;
    
    if (!taskerPhone) {
      showToast('Helper phone number is unavailable.', 'error');
      return;
    }

    let cleanPhone = taskerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCancelTask = () => {
    setShowCancelModal(true);
  };

  const allOnlinePaymentsInitiated = activeCrew.every(tasker => {
    return paymentsTracker[tasker.id] || localStorage.getItem(`payment_initiated_${currentPostedJob?.id}_${tasker.id}`) === 'true';
  });

  const handleConfirmPaymentsClick = () => {
    if (paymentOption === 'online' && currentPostedJob?.amount > 0 && !allOnlinePaymentsInitiated) {
      showToast('Please initiate online payment for all crew helpers first.', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-6 overflow-y-auto select-none">
      
      {/* Header */}
      <div className="relative text-center shrink-0">
        <button 
          onClick={() => pushScreen('poster_home')} 
          className="absolute left-0 top-0 p-2 -ml-2 text-dark hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-gray-400">
          {currentPostedJob?.status === 'in_progress' ? 'Your helper is working...' : 'Your crew is set!'}
        </span>
      </div>

      {/* Main Content scrollable container */}
      <div className="flex-1 space-y-4.5 my-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left">
        
        {/* Connection / Real-time Tracking Map */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400">
            <span>{isRemote ? 'Remote Connection' : 'Live Location'}</span>
            <span className="text-primary animate-pulse uppercase tracking-wider">
              Active
            </span>
          </div>

          <MapView 
            jobLocation={{ lat: currentPostedJob?.lat || 31.2560, lng: currentPostedJob?.lng || 75.7051 }}
            taskers={activeCrew.map(tasker => {
              const jobLat = currentPostedJob?.lat || 31.2560;
              const jobLng = currentPostedJob?.lng || 75.7051;
              const isJobInPunjab = Math.abs(jobLat - 31.2560) < 0.5 && Math.abs(jobLng - 75.7051) < 0.5;

              let loc = crewLocations[tasker.id] || null;
              
              // If real-time location is Punjab default but job is not in Punjab (meaning a drift/reset default)
              const isLocPunjabDefault = loc && Math.abs(loc.lat - 31.2560) < 0.001 && Math.abs(loc.lng - 75.7051) < 0.001;
              const isDriftingToPunjab = !isJobInPunjab && isLocPunjabDefault;

              if (!loc || isDriftingToPunjab || isRemote) {
                if (tasker.serviceAreaLat && tasker.serviceAreaLng) {
                  loc = { lat: tasker.serviceAreaLat, lng: tasker.serviceAreaLng };
                } else {
                  loc = { lat: jobLat + 0.012, lng: jobLng - 0.012 };
                }
              }

              return {
                id: tasker.id,
                bird: tasker.bird || 'falcon',
                location: loc
              };
            })}
            taskerLocation={null}
            taskerBirdName={activeCrew[0]?.bird || 'falcon'}
            height="180px"
          />
        </div>

        {/* Crew List Card */}
        {isLoadingCrew && localCrewTaskers.length === 0 && (
          <div className="flex items-center justify-center py-6 bg-gray-50 border border-border rounded-2xl">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
            <span className="text-xs font-semibold text-gray-400">Loading helpers...</span>
          </div>
        )}
        {localCrewTaskers.map((tasker) => (
          <div key={tasker.id} className="flex items-center justify-between bg-gray-50 border border-border p-4 rounded-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full border border-primary/20 overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                <BirdAvatar birdName={tasker.bird || 'falcon'} size={48} />
              </div>
              <div>
                <h3 className="text-sm font-black text-dark leading-tight">{tasker.name}</h3>
                
                {/* OTP Verification Badge */}
                <div className="mt-1 flex flex-wrap gap-1 items-center">
                  {tasker.status === 'rejected' ? (
                    <span className="inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-md border text-red-600 bg-red-50 border-red-200">
                      Cancelled
                    </span>
                  ) : (
                    <>
                      <span className={`inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        tasker.otpVerified 
                          ? 'text-green-600 bg-green-50 border-green-200' 
                          : 'text-amber-600 bg-amber-50 border-amber-200'
                      }`}>
                        {tasker.otpVerified ? 'OTP Verified' : 'Awaiting OTP'}
                      </span>
                      {tasker.completedByTasker && (
                        <span className="inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-md border text-green-600 bg-green-50 border-green-200">
                          Marked Complete
                        </span>
                      )}
                    </>
                  )}
                </div>
                {tasker.rating && tasker.tasksCompleted > 0 ? (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex items-center text-primary text-[11px] font-bold">
                      <Star className="w-3 h-3 fill-primary text-primary mr-0.5" />
                      <span>{Number(tasker.rating).toFixed(1)}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold">
                      • {tasker.tasksCompleted} tasks completed
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center mt-1 text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                    New Helper
                  </div>
                )}
              </div>
            </div>

            <Tooltip text="WhatsApp Helper">
              <button onClick={() => handleWhatsAppHelper(tasker)} className="p-3 rounded-full bg-white border border-border text-green-600 hover:bg-green-50 hover:border-green-200 cursor-pointer transition-colors">
                <WhatsAppIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        ))}

        {/* Verification Progress Tracker */}
        {localCrewTaskers.length > 0 && (
          <div className="bg-gray-50 border border-border rounded-3xl p-5 text-center w-full shadow-xs space-y-3">
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-dark">
              <span>Task Starting Progress</span>
            </div>
            
            <div className="text-2xl font-black text-green-600 tracking-tight">
              {verifiedCount} / {localCrewTaskers.length} {localCrewTaskers.length === 1 ? 'Helper' : 'Helpers'} Started Work
            </div>

            {/* Custom progress bar */}
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-green-600 h-full transition-all duration-500 ease-out" 
                style={{ width: `${Math.min(100, (verifiedCount / (localCrewTaskers.length || 1)) * 100)}%` }} 
              />
            </div>

            <p className="text-[10px] text-gray-400 font-semibold leading-normal max-w-[240px] mx-auto pt-1">
              {allHelpersVerified 
                ? "All crew members have verified the OTP and started work."
                : "Helpers must ask you for the OTP and enter it on their screens to start."}
            </p>
          </div>
        )}

        {/* OTP Section (Only show if not all helpers are verified) */}
        {!allHelpersVerified ? (
          <div className="bg-orange-50/50 border border-primary/10 rounded-3xl p-5 space-y-3 text-center">
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-dark">
              <KeyRound className="w-4.5 h-4.5 text-primary" />
              <span>Reveal Start OTP</span>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold leading-normal max-w-[240px] mx-auto">
              Provide this code to your helper(s) to authorize and start the task.
            </p>

            {otpVisible ? (
              <div className="bg-white border border-primary/20 rounded-2xl py-3 px-6 inline-block shadow-xs animate-scale-up">
                <span className="text-2xl font-black text-primary tracking-widest">{currentPostedJob?.otp || otpGenerated || '----'}</span>
              </div>
            ) : (
              <Tooltip text="Show verification OTP code">
                <button
                  onClick={() => setOtpVisible(true)}
                  className="bg-primary hover:bg-primary/95 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer inline-flex items-center space-x-1.5 transition-all"
                >
                  <span>Reveal OTP</span>
                </button>
              </Tooltip>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-3xl p-5 flex flex-col items-center justify-center space-y-2">
             <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-1">
               <Check className="w-6 h-6" />
             </div>
             <span className="text-sm font-black text-green-700">All Helpers Verified!</span>
             <span className="text-[10px] text-green-600/80 font-bold text-center">The OTP was verified successfully by all crew members. The task is currently in progress.</span>
          </div>
        )}

        {/* Payment Options */}
        <div className="bg-gray-50 border border-border rounded-2xl p-5 space-y-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
            Payment Method
          </label>
          
          <div className="space-y-2.5">
            {/* Pay Online Card */}
            <button
              onClick={() => setPaymentOption('online')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                paymentOption === 'online'
                  ? 'border-green-600 bg-green-50/30'
                  : 'border-border bg-white hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'online' ? 'border-green-600' : 'border-gray-300'
                }`}>
                  {paymentOption === 'online' && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                </div>
                <div>
                  <span className="text-xs font-black text-dark block">Pay Online</span>
                  <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">Pay instantly using PhonePe, GPay, Paytm, etc.</span>
                </div>
              </div>
            </button>

            {/* Pay Offline Card */}
            <button
              onClick={() => setPaymentOption('offline')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                paymentOption === 'offline'
                  ? 'border-green-600 bg-green-50/30'
                  : 'border-border bg-white hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'offline' ? 'border-green-600' : 'border-gray-300'
                }`}>
                  {paymentOption === 'offline' && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                </div>
                <div>
                  <span className="text-xs font-black text-dark block">Pay Offline</span>
                  <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">Pay cash directly or through other offline methods.</span>
                </div>
              </div>
            </button>
          </div>

          <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 pt-2">
            Payment & Completion
          </label>

          {paymentOption === 'online' ? (
            activeCrew.map((tasker) => {
              const hasInitiated = paymentsTracker[tasker.id] || localStorage.getItem(`payment_initiated_${currentPostedJob?.id}_${tasker.id}`) === 'true';
              return (
                <div key={tasker.id} className="bg-white border border-border p-4 rounded-xl mb-3 flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold">Helper</span>
                    <span className="text-sm font-black text-dark">{tasker.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold">UPI ID</span>
                    <span className="text-xs font-bold text-gray-600">{tasker.upiId || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm font-bold text-dark">Amount</span>
                    <span className="text-lg font-black text-primary">₹{currentPostedJob?.amount || 0}</span>
                  </div>
                  
                  {currentPostedJob?.amount > 0 && (
                    <div className="pt-2">
                      {hasInitiated ? (
                        <span className="text-xs text-green-600 font-extrabold flex items-center justify-center space-x-1 py-2">
                          <Check className="w-4.5 h-4.5" />
                          <span>Payment Initiated</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePayOnlineForTasker(tasker)}
                          className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-black py-2 rounded-xl active:scale-[0.99] transition-all cursor-pointer text-center text-xs"
                        >
                          Pay {tasker.name.split(' ')[0]} Online
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-border p-4 rounded-xl mb-3 flex flex-col space-y-2.5">
              <p className="text-xs font-bold text-gray-500 leading-relaxed">
                Please pay the helper(s) directly via Cash, personal UPI, or any other offline method once the task is completed.
              </p>
              <div className="border-t border-dashed border-border pt-2.5 mt-1">
                {activeCrew.map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs font-bold text-gray-500 mt-1">
                    <span>{t.name}</span>
                    <span className="text-dark">₹{currentPostedJob?.amount || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-2 flex justify-center w-full">
            {(currentPostedJob?.amount > 0) ? (
              <Tooltip text={paymentOption === 'online' && !allOnlinePaymentsInitiated ? "Please initiate payment for all helpers first" : "Confirm payment to complete the task"}>
                <button
                  onClick={handleConfirmPaymentsClick}
                  className={`w-full max-w-md flex items-center justify-center font-black py-4 px-6 rounded-2xl active:scale-[0.99] transition-all cursor-pointer text-center text-xs tracking-wide ${
                    paymentOption === 'online' && !allOnlinePaymentsInitiated
                      ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                  }`}
                >
                  Confirm Payments & Complete
                </button>
              </Tooltip>
            ) : (
              <Tooltip text="Complete the task and submit helper review">
                <button
                  onClick={handleCompleteTask}
                  disabled={isCompleting || isCancelling}
                  className="w-full max-w-md flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-green-600/20 active:scale-[0.99] transition-all cursor-pointer text-center text-xs tracking-wide disabled:opacity-70"
                >
                  {isCompleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  <span>{isCompleting ? 'Completing...' : 'Mark as Complete'}</span>
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex justify-center w-full">
            <button
              onClick={handleCancelTask}
              disabled={isCompleting || isCancelling}
              className="w-full max-w-md flex justify-center items-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer mt-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCancelling ? (
                <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
              ) : null}
              <span>{isCancelling ? 'Cancelling...' : 'Cancel Task'}</span>
            </button>
          </div>

          {/* Divider */}
          <hr className="border-border my-2" />

          {/* Need Help Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              Need Help?
            </h4>
            <button
              onClick={handleWhatsAppSupport}
              className="flex items-center space-x-2 text-xs font-bold text-gray-500 hover:text-green-600 transition-colors cursor-pointer bg-white border border-border hover:border-green-200 hover:bg-green-50/10 px-4 py-3 rounded-xl w-full"
            >
              <WhatsAppIcon className="w-4 h-4 text-green-600 shrink-0" />
              <span>Support</span>
            </button>
          </div>

        </div>

      </div>

      {/* Confirm Payment Modal */}
      {showConfirmModal && (
        <div 
          onClick={() => setShowConfirmModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-[90%] max-w-sm rounded-[32px] p-6 flex flex-col shadow-2xl scale-100 transition-transform duration-300"
          >
            <h3 className="text-base font-black text-dark text-center">Confirm Payment</h3>
            <p className="text-xs font-semibold text-gray-500 mt-3 text-center leading-relaxed">
              Have you completed the payment for this task?
            </p>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3.5 border border-border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTask}
                disabled={isCompleting}
                className="flex-1 flex justify-center items-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md shadow-green-600/20 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {isCompleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : null}
                <span>{isCompleting ? 'Wait...' : 'Complete Task'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Cancel Modal */}
      {showCancelModal && (
        <div 
          onClick={() => setShowCancelModal(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 modal-backdrop-open"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] flex flex-col overflow-hidden shadow-2xl p-6 space-y-6 modal-content-open"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-dark">Cancel Task?</h3>
              <p className="text-xs font-semibold text-gray-500 leading-relaxed max-w-xs mx-auto">
                Are you sure you want to cancel this task? This action is recorded and may affect your completion rate.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3.5 border border-border text-gray-600 hover:bg-gray-50 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                No, Keep Task
              </button>
              <button
                onClick={async () => {
                  setShowCancelModal(false);
                  setIsCancelling(true);
                  try {
                    api.logEvent('task_cancelled_by_poster', { userId, role: 'poster', entityId: currentPostedJob?.id });
                    
                    if (!userProfile?.posterTasksCompleted) {
                      api.logEvent('first_job_failed', { 
                        userId, 
                        role: 'poster', 
                        entityId: currentPostedJob?.id,
                        failure_reason: 'HIRER_CANCELLED'
                      });
                    }

                    await api.updateJob(currentPostedJob.id, { status: 'cancelled', v2_status: 'cancelled' });
                    setJobs(prevJobs =>
                      prevJobs.map(j => j.id === currentPostedJob.id ? { ...j, status: 'cancelled', v2_status: 'cancelled' } : j)
                    );
                    setCurrentPostedJob(null);
                    
                    if (localCrewTaskers && localCrewTaskers.length > 0) {
                      localCrewTaskers.forEach(tasker => {
                        api.sendNotification(
                          tasker.id,
                          "Task Cancelled",
                          `The customer cancelled the task.`,
                          'tasker_home',
                          'job_cancelled',
                          'tasker',
                          { job_id: currentPostedJob.id }
                        );
                      });
                    }
                    
                    showToast('Task cancelled successfully', 'info');
                    pushScreen('poster_home', true);
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Helper Cancelled Alert Modal */}
      {localCrewTaskers.some(t => t.status === 'rejected') && !hasDecidedToContinue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 flex flex-col shadow-2xl animate-scale-up">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-dark text-center">Helper Cancelled</h3>
            <p className="text-xs font-semibold text-gray-500 mt-3 text-center leading-relaxed">
              {localCrewTaskers.filter(t => t.status === 'rejected').map(t => t.name).join(', ')} has left this task. Do you want to continue with the remaining helper(s) or end this task entirely?
            </p>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={async () => {
                  try {
                    setIsCancelling(true);
                    await api.updateJob(currentPostedJob.id, { status: 'cancelled', v2_status: 'cancelled' });
                    setJobs(prevJobs =>
                      prevJobs.map(j => j.id === currentPostedJob.id ? { ...j, status: 'cancelled', v2_status: 'cancelled' } : j)
                    );
                    setCurrentPostedJob(null);
                    showToast('Task has been ended.', 'info');
                    pushScreen('poster_home', true);
                  } catch (err) {
                    showToast('Failed to cancel task.', 'error');
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                End Task
              </button>
              <button
                onClick={() => setHasDecidedToContinue(true)}
                className="flex-1 py-3 border border-border text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrewConfirmedScreen;
