import React, { useState, useEffect, useContext } from 'react';
import { Radio, Users, Eye, ArrowRight, IndianRupee, Trash2, MapPin } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../data/mockData';
import Tooltip from '../../components/Tooltip';
import { api } from '../../services/api';
const LiveStatusScreen = () => {
  const { currentPostedJob, crewTaskers, setCrewTaskers, setLiveStatus, pushScreen } = useContext(AppContext);
  const [viewers, setViewers] = useState(0);

  // Real viewers/taskers count logic
  useEffect(() => {
    let isMounted = true;
    
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

    fetchViewersCount();
    
    // Refresh count every 5 seconds to reflect newly viewed taskers
    const timer = setInterval(fetchViewersCount, 5000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);
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

      {/* Cancel Broadcast button */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 border-t border-border shrink-0">
        <Tooltip text="Cancel this job broadcast" position="top">
          <button
            onClick={() => pushScreen('post_job')}
            className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-500 font-bold py-3.5 px-6 rounded-2xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Cancel Broadcast</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default LiveStatusScreen;
