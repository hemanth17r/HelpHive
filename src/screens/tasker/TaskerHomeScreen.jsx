import React, { useState, useContext, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Wifi, WifiOff, Inbox, Users, RefreshCw } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import JobCard from '../../components/JobCard';
import Tooltip from '../../components/Tooltip';
import { SKILLS } from '../../config/constants';
import { getCurrentLocation } from '../../utils/location';
import ActionItemsCarousel from '../../components/ActionItemsCarousel';
import { api } from '../../services/api';

const TaskerHomeScreen = () => {
  const { 
    userProfile, 
    getJobsInRadius, 
    selectedBird,
    isOnline,
    setIsOnline,
    jobs,
    setAcceptedJob,
    pushScreen,
    requireProfile,
    realLocation,
    setRealLocation,
    setActiveTab
  } = useContext(AppContext);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
    } catch (err) {
      console.error("Failed to refresh location", err);
    }
    setIsRefreshing(false);
  };

  const [declinedJobIds, setDeclinedJobIds] = useState([]);

  const handleDeclineJob = (jobId) => {
    setDeclinedJobIds(prev => [...prev, jobId]);
  };

  const { jobsList = [] } = getJobsInRadius() || {};

  const visibleJobs = jobsList.filter(job => 
    !declinedJobIds.includes(job?.id) && 
    job?.posterId !== userProfile?.id
  );

  const matchingSkillsJobs = visibleJobs.filter(job => 
    userProfile?.skills && Array.isArray(userProfile.skills) ? userProfile.skills.includes(job?.skillId) : false
  );

  const displayActiveTasks = (jobs || []).filter(job => 
    (job?.taskerId === userProfile?.id || job?.taskerName === userProfile?.name) &&
    (job?.status === 'active' || job?.status === 'in_progress')
  );

  useEffect(() => {
    if (!isOnline || !userProfile?.id) return;
    
    // Log views for visible jobs
    const jobsToLog = visibleJobs.filter(job => job?.status === 'open');
    if (jobsToLog.length === 0) return;
    
    // Use sessionStorage to remember which jobs we've already logged as viewed in this session
    const viewedJobs = JSON.parse(sessionStorage.getItem('viewedJobs') || '[]');
    let updated = false;
    
    jobsToLog.forEach(job => {
      if (!viewedJobs.includes(job.id)) {
        api.logEvent('job_viewed', { 
          userId: userProfile.id, 
          role: 'tasker', 
          entityId: job.id 
        });
        viewedJobs.push(job.id);
        updated = true;
      }
    });
    
    if (updated) {
      sessionStorage.setItem('viewedJobs', JSON.stringify(viewedJobs));
    }
  }, [visibleJobs, isOnline, userProfile?.id]);

  return (
    <div className="flex-1 flex flex-col bg-light-gray h-full select-none">
      
      {/* Top sticky block */}
      <div className="sticky top-0 z-40 bg-white shadow-xs lg:hidden">
        {/* Header bar with Online toggle & Radius */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center space-x-3">
            <span 
              onClick={() => setActiveTab('profile')}
              className="text-sm font-black text-dark cursor-pointer hover:text-primary transition-colors"
            >
              Hi, {userProfile?.name?.split(' ')[0] || 'Tasker'}
            </span>
            <div className="text-[9px] font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 shrink-0 max-w-[120px] truncate" title={userProfile?.serviceAreaName || 'No service area selected'}>
              {userProfile?.serviceAreaName ? userProfile.serviceAreaName.split(',')[0].trim() : 'No service area selected'}
            </div>
            <button 
              onClick={handleRefreshFeed} 
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>

          {/* Active Status Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 select-none">
            <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-600">Active</span>
          </div>
        </div>
      </div>

      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-md lg:max-w-2xl lg:px-8 mx-auto w-full">
        {/* Action Items Carousel for missing permissions/profile details */}
        <ActionItemsCarousel />

        {/* My Active Tasks Section */}
        {displayActiveTasks.length > 0 && (
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-500">
                My Active Tasks
              </span>
            </div>
            {displayActiveTasks.map((job) => {
              const skill = SKILLS.find(s => s.id === job.skillId) || SKILLS[0];
              const Icon = skill.icon;
              
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    requireProfile(() => {
                      setAcceptedJob(job);
                      pushScreen('tasker_accepted_job');
                    });
                  }}
                  className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl shrink-0 bg-blue-50 text-blue-500">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">
                          {skill?.label || 'Task'}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-blue-500 bg-blue-50 border-blue-200">
                          Active
                        </span>
                      </div>
                    </div>
                    <span className="text-dark font-black text-sm">₹{job.amount}</span>
                  </div>
                  
                  <p className="text-xs font-bold text-dark line-clamp-2 mb-3">
                    {job.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 border-t border-dashed border-gray-100 pt-3">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Booked: {job.peopleNeeded}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400">
                      <span>Hirer: <span className="text-gray-600 font-extrabold">{job.posterName || 'Unknown'}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-20 bg-white rounded-3xl p-6 border border-border">
            <div className="p-4 bg-orange-50 rounded-full text-primary">
              <Inbox className="w-10 h-10" />
            </div>
            <h3 className="text-base font-black text-dark">No Open Tasks Right Now</h3>
            <p className="text-xs font-semibold text-gray-400 max-w-[220px]">
              No tasks posted on campus yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-20">


            {/* Section 1: Matching Skills or All Open Tasks */}
            {(((userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0) ? matchingSkillsJobs : visibleJobs).length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                    {(userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0) ? 'Jobs Matching Your Skills' : 'Open Tasks Nearby'}
                  </span>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {((userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0) ? matchingSkillsJobs : visibleJobs).length} Live
                  </span>
                </div>
                {((userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0) ? matchingSkillsJobs : visibleJobs).map((job, idx) => (
                  <JobCard
                    key={job?.id || idx}
                    job={{ ...job, distance: `${job?.distanceVal || 0} km` }}
                    onDecline={handleDeclineJob}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskerHomeScreen;
