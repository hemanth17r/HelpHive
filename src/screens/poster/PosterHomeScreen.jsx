import React, { useContext, useEffect, useState, useMemo } from 'react';
import { PlusCircle, MapPin, User, Clock, Users, ArrowRight, MoreVertical, RefreshCw } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import SetupWizardModal from '../../components/SetupWizardModal';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import ProfileProgressBar from '../../components/ProfileProgressBar';

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
    openOnboardingWizard,
    userId,
    openLoginModal
  } = useContext(AppContext);

  const { missingWizardItems } = useProfileCompletion();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchJobs();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handlePostJobClick = () => {
    if (!userId) {
      openLoginModal(() => {
        handlePostJobClick();
      });
      return;
    }
    const isWizardCompleted = localStorage.getItem(`helphive_wizard_completed_poster_${userId}`) === 'true' && missingWizardItems.length === 0;
    if (!isWizardCompleted) {
      openOnboardingWizard(() => {
        pushScreen('post_job');
      });
    } else {
      pushScreen('post_job');
    }
  };

  // Filter jobs for the current user
  const posterJobs = useMemo(() => {
    return jobs.filter(j => j.posterName === userProfile?.name || j.posterName === 'You' || j.posterId === userProfile?.id);
  }, [jobs, userProfile?.name, userProfile?.id]);

  const activeJobs = useMemo(() => {
    return posterJobs.filter(j => j.status !== 'expired' && j.status !== 'completed' && j.status !== 'draft' && j.status !== 'cancelled');
  }, [posterJobs]);



  const displayActiveJobs = activeJobs;
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const EXAMPLE_TASKS = [
    "Need someone to pick up urgent medicines and deliver to my parents - ₹150",
    "Need 2 people to help shift heavy furniture during house moving - ₹500",
    "Need someone to stand in queue for a hospital OPD token early morning - ₹250",
    "Need someone to walk my dog around the neighborhood park for an hour - ₹200"
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
        // Bug 3.4 fix: also clear the nested timeout so it cannot fire
        // after the component has unmounted and trigger a state update warning.
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
      case 'open': return { text: 'Searching for Helpers...', color: 'text-orange-500 bg-orange-50 border-orange-200' };
      case 'searching': return { text: 'Searching for Helpers...', color: 'text-orange-500 bg-orange-50 border-orange-200' };
      case 'in_progress': return { text: 'In Progress', color: 'text-blue-500 bg-blue-50 border-blue-200' };
      case 'accepted': return { text: 'Taskers Responding', color: 'text-blue-500 bg-blue-50 border-blue-200' };
      case 'crew_set': return { text: 'Crew Confirmed', color: 'text-green-500 bg-green-50 border-green-200' };
      case 'completed': return { text: 'Completed', color: 'text-gray-500 bg-gray-50 border-gray-200' };
      default: return { text: 'Open', color: 'text-gray-500 bg-gray-50 border-gray-200' };
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
    <div className="flex-1 flex flex-col bg-light-gray h-full select-none">
      


      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-6 pb-24 space-y-6 max-w-md lg:max-w-2xl lg:px-8 mx-auto w-full">
        
        {/* Post a Job Prominent Button */}
        <Tooltip text="Create a new task request">
          <button
            onClick={handlePostJobClick}
            className="w-full bg-primary hover:bg-primary/95 text-white flex flex-row items-center px-5 py-3 md:py-3.5 rounded-2xl shadow-md shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden text-left"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
            <PlusCircle className="w-6 h-6 md:w-7 md:h-7 mr-3.5 shrink-0" />
            <div className="flex flex-col">
              <h2 className="text-base md:text-lg font-black leading-tight">Post a Job</h2>
              <p className="text-[10px] md:text-xs font-semibold text-white/85 mt-0.5">Get local help in seconds</p>
            </div>
          </button>
        </Tooltip>

        {/* Profile completion progress bar */}
        <ProfileProgressBar />

        {/* My Active Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
              My Active Jobs
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white border border-border text-gray-500 hover:text-primary hover:border-primary/30 hover:bg-orange-50/50 active:scale-[0.98] transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider"
              title="Refresh jobs list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {displayActiveJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-10 px-6 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-3xl border border-orange-100/50 shadow-xs relative overflow-hidden group">
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-orange-100/30 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
              
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-full animate-bounce duration-1000">
                <PlusCircle className="w-7 h-7" />
              </div>
              
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 bg-orange-100/50 px-2.5 py-1 rounded-full border border-orange-200/20">
                  Try Posting Something Like:
                </span>
              </div>
              
              <div className="min-h-[48px] flex items-center justify-center px-4 w-full">
                <p className={`text-sm font-extrabold text-gray-700 italic leading-relaxed transition-opacity duration-300 ${fadeState === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}>
                  "{EXAMPLE_TASKS[exampleIndex]}"
                </p>
              </div>

              <div className="flex justify-center space-x-1.5 pt-1">
                {EXAMPLE_TASKS.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === exampleIndex ? 'bg-orange-500 w-3' : 'bg-orange-200'}`}
                  ></div>
                ))}
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
                    className="bg-white border border-border hover:border-primary/50 rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-all shadow-2xs hover:shadow-md group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">
                            {skill?.label || 'Task'}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
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
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs font-bold text-dark line-clamp-2">
                        {job.description}
                      </p>
                      {job.address?.completeAddress && (
                        <div className="flex items-start mt-1.5 space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-[10px] font-bold text-gray-500 leading-snug line-clamp-1">
                            {job.address.completeAddress?.startsWith('Location at') && job.address.landmark 
                              ? job.address.landmark 
                              : job.address.completeAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 border-t border-dashed border-border pt-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Needed: {job.peopleNeeded}</span>
                      </div>
                      <span className="text-dark font-black text-xs">₹{job.amount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


        </div>
      </div>
    </div>
  );
};

export default PosterHomeScreen;
