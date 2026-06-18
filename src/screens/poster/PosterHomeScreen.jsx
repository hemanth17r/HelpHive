import React, { useContext, useEffect, useState } from 'react';
import { PlusCircle, MapPin, User, Clock, Users, ArrowRight, MoreVertical } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { getCurrentLocation } from '../../utils/location';
import ActionItemsCarousel from '../../components/ActionItemsCarousel';
import SetupWizardModal from '../../components/SetupWizardModal';

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
    expireJob,
    setEditJobData,
    realLocation,
    setRealLocation,
    fetchJobs
  } = useContext(AppContext);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handlePostJobClick = () => {
    requireProfile(() => {
      requireLocation('poster', () => {
        pushScreen('post_job');
      });
    });
  };

  // Filter jobs for the current user
  const posterJobs = jobs.filter(j => j.posterName === userProfile?.name || j.posterName === 'You' || j.posterId === userProfile?.id);
  const activeJobs = posterJobs.filter(j => j.status !== 'expired' && j.status !== 'completed' && j.status !== 'draft' && j.status !== 'cancelled');
  const draftJobs = posterJobs.filter(j => j.status === 'draft');
  const completedJobs = posterJobs.filter(j => j.status === 'completed');

  const displayActiveJobs = activeJobs;
  const displayDraftJobs = draftJobs;

  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const EXAMPLE_TASKS = [
    "Need someone to pick up urgent medicines and deliver to my parents - ₹150",
    "Need 2 people to help shift heavy furniture during house moving - ₹500",
    "Need someone to stand in queue for a hospital OPD token early morning - ₹250",
    "Need urgent help to fix a leaking tap in my kitchen - ₹300"
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
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-6 max-w-md lg:max-w-2xl lg:px-8 mx-auto w-full">
        
        {/* Action Items Carousel for missing permissions/profile details */}
        <ActionItemsCarousel />

        {/* Post a Job Prominent Button */}
        <Tooltip text="Create a new task request">
          <button
            onClick={handlePostJobClick}
            className="w-full bg-primary hover:bg-primary/95 text-white flex flex-row items-center px-6 py-4 md:py-5 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden text-left"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
            <PlusCircle className="w-8 h-8 md:w-9 md:h-9 mr-4 shrink-0" />
            <div className="flex flex-col">
              <h2 className="text-lg md:text-xl font-black leading-tight">Post a Job</h2>
              <p className="text-[11px] md:text-xs font-bold text-white/80 mt-0.5">Get local help in seconds</p>
            </div>
          </button>
        </Tooltip>

        {/* My Active Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
              My Active Jobs
            </span>
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
                                expireJob(job.id);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Move to unfulfilled
                            </button>
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
                            {job.address.completeAddress}
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

        {/* Draft Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-500">
              Drafts
            </span>
          </div>
          {displayDraftJobs.length === 0 ? (
            <p className="text-xs font-semibold text-gray-400 px-2 pb-2">
              No drafts.
            </p>
          ) : (
            <div className="space-y-3">
              {displayDraftJobs.map(job => {
                const skill = SKILLS.find(s => s.id === job.skillId);
                const Icon = skill ? skill.icon : SKILLS[0].icon;
                
                return (
                  <div 
                    key={job.id} 
                    onClick={() => {
                      setEditJobData(job);
                      pushScreen('post_job');
                    }}
                    className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-orange-50 text-orange-500 rounded-xl shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">
                            {skill?.label || 'Task'}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-orange-500 bg-orange-50 border-orange-200">
                            Draft
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
                      <p className="text-xs font-bold text-gray-400 line-clamp-2">
                        {job.description}
                      </p>
                      {job.address?.completeAddress && (
                        <div className="flex items-start mt-1.5 space-x-1 opacity-70">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-[10px] font-bold text-gray-400 leading-snug line-clamp-1">
                            {job.address.completeAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 border-t border-dashed border-border pt-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Needed: {job.peopleNeeded}</span>
                      </div>
                      <span className="text-gray-400 font-black text-xs">₹{job.amount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
              Completed Jobs
            </span>
          </div>
          {completedJobs.length === 0 ? (
            <p className="text-xs font-semibold text-gray-400 px-2 pb-2">
              No completed jobs.
            </p>
          ) : (
            <div className="space-y-3">
              {completedJobs.map(job => {
                const skill = SKILLS.find(s => s.id === job.skillId);
                const Icon = skill ? skill.icon : SKILLS[0].icon;
                
                return (
                  <div 
                    key={job.id} 
                    onClick={() => handleJobClick(job)}
                    className="bg-white border border-border hover:border-primary/30 rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-all shadow-2xs hover:shadow-md group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-gray-100 text-gray-500 rounded-xl shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">
                            {skill?.label || 'Task'}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-gray-500 bg-gray-50 border-gray-200">
                            Completed
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs font-bold text-gray-600 line-clamp-2">
                        {job.description}
                      </p>
                      {job.address?.completeAddress && (
                        <div className="flex items-start mt-1.5 space-x-1 opacity-70">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-[10px] font-bold text-gray-400 leading-snug line-clamp-1">
                            {job.address.completeAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 border-t border-dashed border-border pt-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Completed by {job.peopleNeeded} {job.peopleNeeded > 1 ? 'helpers' : 'helper'}</span>
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
      <SetupWizardModal />
    </div>
  );
};

export default PosterHomeScreen;
