import React, { useContext, useEffect, useState, useMemo } from 'react';
import { PlusCircle, MapPin, User, Clock, Users, ArrowRight, MoreVertical, RefreshCw, Zap } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import BirdAvatar from '../../components/BirdAvatars';
import GuestTourBanner from '../../components/GuestTourBanner';
import { formatCurrency } from '../../utils/currency';

const PosterHomeScreen = () => {
  const { 
    userLocation, 
    userProfile, 
    selectedBird,
    jobs,
    pushScreen,
    setCurrentPostedJob,
    requireProfile,
    requireLocation,
    deleteJob,
    realLocation,
    setRealLocation,
    fetchJobs,
    userId,
    openLoginModal,
    currency
  } = useContext(AppContext);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const start = Date.now();
    await fetchJobs(true);
    const elapsed = Date.now() - start;
    const minDelay = 800;
    if (elapsed < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);



  // Filter jobs for the current user
  const posterJobs = useMemo(() => {
    return jobs.filter(j => j.posterName === userProfile?.name || j.posterName === 'You' || j.posterId === userProfile?.id);
  }, [jobs, userProfile?.name, userProfile?.id]);

  const activeJobs = useMemo(() => {
    return posterJobs.filter(j => j.status !== 'expired' && j.status !== 'completed' && j.status !== 'draft' && j.status !== 'cancelled');
  }, [posterJobs]);



  const displayActiveJobs = activeJobs;
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    if (!activeDropdownId) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-dropdown-container]')) {
        setActiveDropdownId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveDropdownId(null);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdownId]);
  const EXAMPLE_TASKS = [
    "Quest: Pick up urgent grocery delivery for a neighbour",
    "Quest: Need 2 operatives to help assemble flatpack furniture",
    "Quest: Queue assistance for event passes early morning",
    "Community Quest: Help distribute water & snacks at local marathon (Volunteer)"
  ];

  const [exampleIndex, setExampleIndex] = useState(0);
  const [fadeState, setFadeState] = useState('fade-in');

  const fadeTimeoutRef = React.useRef(null);

  useEffect(() => {
    if (displayActiveJobs.length === 0) {
      const interval = setInterval(() => {
        setFadeState('fade-out');
        fadeTimeoutRef.current = setTimeout(() => {
          setExampleIndex(prev => (prev + 1) % EXAMPLE_TASKS.length);
          setFadeState('fade-in');
        }, 300);
      }, 2000);
      return () => {
        clearInterval(interval);
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      };
    }
  }, [displayActiveJobs.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getJobStatusLabel = (status, needed) => {
    switch(status) {
      case 'open': return { text: 'Scanning Sector Operators...', color: 'text-orange-500 bg-orange-50 border-orange-200' };
      case 'searching': return { text: 'Scanning Sector Operators...', color: 'text-orange-500 bg-orange-50 border-orange-200' };
      case 'in_progress': return { text: 'Contract In Execution', color: 'text-blue-500 bg-blue-50 border-blue-200' };
      case 'accepted': return { text: 'Operators Locked In', color: 'text-blue-500 bg-blue-50 border-blue-200' };
      case 'crew_set': return { text: 'Strike Team Assembled', color: 'text-green-500 bg-green-50 border-green-200' };
      case 'completed': return { text: 'Contract Fulfilled', color: 'text-gray-500 bg-gray-50 border-gray-200' };
      default: return { text: 'Active Bounty', color: 'text-gray-500 bg-gray-50 border-gray-200' };
    }
  };

  const handleJobClick = (job) => {
    setCurrentPostedJob(job);
    if (job.status === 'completed') {
      pushScreen('job_receipt');
    } else if (job.status === 'open' || job.v2_status === 'searching') {
      pushScreen('live_status', true);
    } else {
      pushScreen('crew_confirmed', true);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full select-none">
      
      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-1.5 pb-32 space-y-4 max-w-md lg:max-w-xl mx-auto w-full">

        {/* Header & Refresh */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Deployed Contracts
            </h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 text-slate-500 hover:text-primary active-scale transition-all cursor-pointer text-xs font-bold p-1.5 rounded-xl hover:bg-orange-50"
            title="Ping sector radar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{isRefreshing ? 'Pinging...' : 'Ping Radar'}</span>
          </button>
        </div>

        {displayActiveJobs.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center py-6">
            <div className="w-full text-center flex flex-col items-center space-y-4 max-w-sm mx-auto">
              <div className="w-16 h-16 bg-orange-500/10 text-primary rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
                <PlusCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <h3 className="text-base font-black text-slate-900">
                  No Active Bounties Deployed
                </h3>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                  Post a bounty to mobilize vetted operators and strike teams in your sector.
                </p>
              </div>

              <button
                onClick={() => pushScreen('post_job')}
                className="w-full max-w-xs py-3.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center space-x-2 cursor-pointer active-scale transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Deploy New Contract</span>
              </button>

              {/* Rotating Templates Deck */}
              <div className="w-full pt-4 space-y-2 max-w-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                  Hot Mission Ideas
                </span>
                <div className="min-h-[44px] flex items-center justify-center px-2">
                  <p className={`text-xs font-semibold text-slate-600 italic leading-relaxed transition-opacity duration-300 ${fadeState === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}>
                    "{EXAMPLE_TASKS[exampleIndex]}"
                  </p>
                </div>

                <div className="flex justify-center space-x-1.5 pt-0.5">
                  {EXAMPLE_TASKS.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${idx === exampleIndex ? 'bg-primary w-4' : 'bg-slate-300/80 w-1.5'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
            <div className="space-y-3">
              {displayActiveJobs.map(job => {
                const skill = SKILLS.find(s => s.id === job.skillId);
                const Icon = skill ? skill.icon : SKILLS[0].icon;
                const statusInfo = getJobStatusLabel(job.status, job.peopleNeeded);
                
                return (
                  <div 
                    key={job.id} 
                    onClick={() => handleJobClick(job)}
                    className="glass-card rounded-2xl p-4 cursor-pointer active-scale transition-all duration-300 hover:!border-primary/45 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-gray-500 block leading-none mb-1">
                            {skill?.label || 'Contract'}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </div>
                      <div className="relative" data-dropdown-container>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === job.id ? null : job.id);
                          }}
                          className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        
                        {activeDropdownId === job.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-border py-1 z-20 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteJob(job.id);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Abort Contract
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-dark line-clamp-2">
                        {job.description}
                      </p>
                      {job.address?.completeAddress && (
                        <div className="flex items-start mt-1.5 space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-[11px] font-normal text-gray-500 leading-snug line-clamp-1">
                            {job.address.completeAddress?.startsWith('Location at') && job.address.landmark 
                              ? job.address.landmark 
                              : job.address.completeAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 border-t border-dashed border-border pt-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Crew Size: {job.peopleNeeded}</span>
                      </div>
                      <span className="text-dark font-semibold text-xs">{formatCurrency(job.amount, job.currency)} Bounty</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosterHomeScreen;
