import React, { useContext, useEffect, useState } from 'react';
import { PlusCircle, MapPin, User, Clock, Users, ArrowRight, MoreVertical } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../data/mockData';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { getCurrentLocation } from '../../utils/location';
import ActionItemsCarousel from '../../components/ActionItemsCarousel';

const PosterHomeScreen = () => {
  const { 
    userLocation, 
    userProfile, 
    selectedBird,
    jobs,
    pushScreen,
    setCurrentPostedJob,
    requireProfile,
    deleteJob,
    expireJob,
    setEditJobData,
    realLocation,
    setRealLocation
  } = useContext(AppContext);

  const handlePostJobClick = () => {
    requireProfile(async () => {
      if (!realLocation && navigator.geolocation) {
        try {
          const loc = await getCurrentLocation();
          setRealLocation(loc);
        } catch(e) {
          console.error("Location access denied or failed", e);
        }
      }
      pushScreen('post_job');
    });
  };

  // Filter jobs for the current user
  const posterJobs = jobs.filter(j => j.posterName === userProfile?.name || j.posterName === 'You' || j.posterId === userProfile?.id);
  const activeJobs = posterJobs.filter(j => j.status !== 'expired' && j.status !== 'completed' && j.status !== 'draft');
  const unfulfilledJobs = posterJobs.filter(j => j.status === 'expired');
  const draftJobs = posterJobs.filter(j => j.status === 'draft');

  const displayActiveJobs = activeJobs;
  const displayUnfulfilledJobs = unfulfilledJobs;
  const displayDraftJobs = draftJobs;

  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getJobStatusLabel = (status, needed) => {
    switch(status) {
      case 'open': return { text: 'Searching for Helpers...', color: 'text-orange-500 bg-orange-50 border-orange-200' };
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
              <p className="text-[11px] md:text-xs font-bold text-white/80 mt-0.5">Get local helpers in seconds</p>
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
            <div className="flex flex-col items-center justify-center text-center space-y-3 py-10 bg-white rounded-3xl p-6 border border-border">
              <div className="p-4 bg-gray-50 rounded-full text-gray-300">
                <Clock className="w-8 h-8" />
              </div>
              <p className="text-xs font-semibold text-gray-400 max-w-[200px]">
                No active jobs. Post your first job.
              </p>
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


      </div>
    </div>
  );
};

export default PosterHomeScreen;
