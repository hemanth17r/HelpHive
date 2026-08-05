import React, { useContext, useEffect, useState, useMemo } from 'react';
import { PlusCircle, MapPin, User, Clock, Users, ArrowRight, MoreVertical, RefreshCw } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import BirdAvatar from '../../components/BirdAvatars';

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
    userId
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
  const EXAMPLE_TASKS = [
    "Need someone to pick up urgent medicines and deliver to my parents - ₹150",
    "Need 2 people to help shift heavy furniture during house moving - ₹500",
    "Need someone to stand in queue for a hospital OPD token early morning - ₹250",
    "Need 3 helpers to distribute snacks and water bottles at a community event - ₹200 each"
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
    <div className="flex-1 flex flex-col bg-white h-full select-none">
      


      {/* Main Content Feed */}
      <div className={`flex-1 overflow-y-auto no-scrollbar ${displayActiveJobs.length === 0 ? 'flex flex-col' : ''}`}>
        <div className={`px-4 pt-6 pb-24 space-y-6 max-w-md mx-auto w-full ${displayActiveJobs.length === 0 ? 'flex-1 flex flex-col' : ''}`}>
        
        {/* My Active Jobs Section */}
        <div className={`space-y-4 ${displayActiveJobs.length === 0 ? 'flex-1 flex flex-col' : ''}`}>
          <div className="flex justify-end px-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1 text-gray-500 hover:text-primary active:scale-[0.98] transition-all cursor-pointer text-xs font-medium"
              title="Refresh tasks list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {displayActiveJobs.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="flex flex-col items-center justify-center text-center space-y-3 py-6 px-4 bg-transparent w-full shrink-0 h-[200px] relative">
                <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-full shrink-0">
                  <PlusCircle className="w-5 h-5" />
                </div>
                
                <div className="space-y-1 shrink-0">
                  <span className="text-xs font-semibold text-primary px-2 py-0.5">
                    Try posting something like:
                  </span>
                </div>
                
                <div className="h-[54px] flex items-center justify-center px-4 w-full shrink-0">
                  <p className={`text-xs font-medium text-gray-600 italic leading-relaxed transition-opacity duration-300 ${fadeState === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}>
                    "{EXAMPLE_TASKS[exampleIndex]}"
                  </p>
                </div>

                <div className="flex justify-center space-x-1.5 pt-1 shrink-0">
                  {EXAMPLE_TASKS.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === exampleIndex ? 'bg-orange-500 w-3' : 'bg-orange-200'}`}
                    ></div>
                  ))}
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
                            {skill?.label || 'Task'}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${statusInfo.color}`}>
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
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Delete
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
                        <span>Needed: {job.peopleNeeded}</span>
                      </div>
                      <span className="text-dark font-semibold text-xs">₹{job.amount}</span>
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
