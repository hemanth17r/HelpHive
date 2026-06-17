import React, { useState, useEffect, useContext, useRef } from 'react';
import { Radio, Users, Eye, ArrowRight, IndianRupee, Trash2, MapPin, ShieldAlert } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { SKILLS } from '../../config/constants';
import Tooltip from '../../components/Tooltip';
import { api } from '../../services/api';
const LiveStatusScreen = () => {
  const { currentPostedJob, crewTaskers, setCrewTaskers, setLiveStatus, pushScreen, setJobs, acceptPartialCrew } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const [viewers, setViewers] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Track the tasker_id that existed when this screen first mounted.
  // We only navigate to crew_confirmed if a NEW tasker_id appears after mount.
  const initialTaskerIdRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Snapshot the tasker_id that exists when this screen mounts.
    // Any tasker_id that was already present before this point is STALE —
    // we must not auto-navigate based on it.
    const snapshotInitialTaskerId = async () => {
      if (!currentPostedJob?.id) return;
      try {
        const { data } = await api.supabase
          .from('jobs')
          .select('tasker_id')
          .eq('id', currentPostedJob.id)
          .single();
        if (isMounted) {
          initialTaskerIdRef.current = data?.tasker_id || null;
        }
      } catch (e) {
        initialTaskerIdRef.current = null;
      }
    };
    snapshotInitialTaskerId();
    
    const fetchViewersCount = async () => {
      if (!currentPostedJob?.id) return;
      
      try {
        const { data, error } = await api.supabase
          .from('app_events')
          .select('user_id')
          .eq('event_type', 'job_viewed')
          .eq('entity_id', currentPostedJob.id);
          
        if (error) throw error;
        
        if (isMounted && data) {
          // Count unique user_ids
          const uniqueViewers = new Set(data.map(e => e.user_id).filter(Boolean));
          setViewers(uniqueViewers.size);
        }
      } catch (err) {
        console.error("Failed to fetch viewers count:", err);
      }
    };

    const fetchCrew = async () => {
      if (!currentPostedJob?.id) return;
      const { data } = await api.fetchJobCrew(currentPostedJob.id);
      if (data && isMounted) {
        setCrewTaskers(data);
      }
    };
    fetchCrew();
    fetchViewersCount();
    
    // Refresh count and job status every 5 seconds (not 1s — avoids test-simulation feel)
    const timer = setInterval(async () => {
      fetchViewersCount();
      fetchCrew();
      
      // Also poll job status just in case realtime subscription is delayed/missing
      if (currentPostedJob?.id && !hasNavigatedRef.current) {
        try {
          const { data } = await api.supabase
            .from('jobs')
            .select('status, tasker_id, v2_status')
            .eq('id', currentPostedJob.id)
            .single();

          if (data && (data.status === 'accepted' || data.v2_status === 'accepted')) {
            hasNavigatedRef.current = true;
            const { data: allJobs } = await api.fetchJobs();
            if (allJobs) {
              setJobs(allJobs);
              const updatedJob = allJobs.find(j => j.id === currentPostedJob.id);
              if (updatedJob) {
                const { data: crew } = await api.fetchJobCrew(currentPostedJob.id);
                setCrewTaskers(crew || []);
                setLiveStatus('crew_set');
                pushScreen('crew_confirmed', true);
              }
            }
          }
        } catch (e) {
          // ignore error
        }
      }
    }, 5000); // Polling every 5s — avoids simulated/test-like rapid triggering

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [currentPostedJob]);
  if (!currentPostedJob) return null;

  const skill = SKILLS.find(s => s.id === currentPostedJob.skillId);
  const Icon = skill ? skill.icon : SKILLS[SKILLS.length - 1].icon;


  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-6 overflow-y-auto">
      {/* Header */}
      <div className="text-center pb-3 border-b border-border shrink-0">
        <span className="text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase">
          Live Broadcast
        </span>
        <h2 className="text-base font-extrabold text-dark mt-2">Searching for Helpers...</h2>
      </div>

      {/* Main Status Area */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 my-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full">
        {/* Animated Radar Pulse */}
        <div className="relative flex items-center justify-center w-28 h-28 bg-primary/5 rounded-full">
          <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-60"></div>
          <div className="absolute w-20 h-20 bg-primary/20 rounded-full animate-pulse"></div>
          <div className="relative bg-primary text-white p-4.5 rounded-full shadow-lg shadow-primary/30">
            <Radio className="w-8 h-8" />
          </div>
        </div>

        {/* Counter Stats */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-gray-50 border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center space-x-1 text-gray-500 mb-1">
              <Eye className="w-4 h-4 shrink-0 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Viewers</span>
            </div>
            <span className="text-xl font-black text-dark">{viewers}</span>
          </div>

          <div className="bg-gray-50 border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center space-x-1 text-gray-500 mb-1">
              <Users className="w-4 h-4 shrink-0 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Accepted</span>
            </div>
            <span className="text-xl font-black text-dark">
              {crewTaskers.length} / {currentPostedJob.peopleNeeded}
            </span>
          </div>
        </div>

        {/* Job Details Card */}
        <div className="bg-gray-50 border border-border rounded-2xl p-4 w-full text-left space-y-2">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-gray-400">
            <Icon className="w-4 h-4 text-primary" />
            <span>{skill?.label}</span>
          </div>
          <div className="pb-2">
            <p className="text-xs font-bold text-dark leading-relaxed">
              {currentPostedJob.description}
            </p>
            {currentPostedJob.address?.completeAddress && (
              <div className="flex items-start mt-1.5 space-x-1">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs font-bold text-gray-500 leading-snug">
                  {currentPostedJob.address.completeAddress}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-dashed border-border text-xs font-bold text-gray-500">
            <div className="flex items-center space-x-1">
              <IndianRupee className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-dark">₹{currentPostedJob.amount} Payout</span>
            </div>
            <span>Need {currentPostedJob.peopleNeeded} helpers</span>
          </div>
        </div>

        {/* Waiting text */}
        <div className="text-center mt-6">
          <p className="text-xs font-semibold text-gray-400 animate-pulse">
            Waiting for a Tasker to accept this job...
          </p>
        </div>
      </div>

      {/* Bottom Action buttons */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 border-t border-border shrink-0 space-y-3">
        {currentPostedJob.peopleNeeded > 1 && crewTaskers.length > 0 && (
          <button
            onClick={() => acceptPartialCrew(currentPostedJob.id)}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Proceed with {crewTaskers.length} Helper{crewTaskers.length > 1 ? 's' : ''}</span>
          </button>
        )}
        <Tooltip text="Cancel this job broadcast" position="top">
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-500 font-bold py-3.5 px-6 rounded-2xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Cancel Broadcast</span>
          </button>
        </Tooltip>
      </div>

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
              <h3 className="text-lg font-black text-dark">Cancel Broadcast?</h3>
              <p className="text-xs font-semibold text-gray-500 leading-relaxed max-w-xs mx-auto">
                Are you sure you want to cancel this job search? This will expire all pending job offers.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="flex-1 py-3.5 border border-border text-gray-600 hover:bg-gray-50 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50"
              >
                No, Keep Searching
              </button>
              <button
                disabled={isCancelling}
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    await api.updateJob(currentPostedJob.id, { status: 'cancelled', v2_status: 'cancelled' });
                    await api.supabase
                      .from('job_offers')
                      .update({ status: 'expired' })
                      .eq('job_id', currentPostedJob.id)
                      .eq('status', 'pending');
                    showToast('Job broadcast cancelled.', 'info');
                    setShowCancelModal(false);
                    pushScreen('poster_home', true);
                  } catch (err) {
                    console.error("Failed to cancel broadcast:", err);
                    showToast('Failed to cancel broadcast.', 'error');
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStatusScreen;
