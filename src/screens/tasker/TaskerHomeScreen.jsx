import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Inbox, Users, AlertCircle, RefreshCw, Briefcase } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import JobCard from '../../components/JobCard';
import Tooltip from '../../components/Tooltip';
import { SKILLS } from '../../config/constants';
import { getCurrentLocation } from '../../utils/location';
import { api } from '../../services/api';
import SetupWizardModal from '../../components/SetupWizardModal';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';


const TaskerHomeScreen = () => {
  const { 
    userProfile, 
    getJobsInRadius, 
    selectedBird,
    jobs,
    setAcceptedJob,
    pushScreen,
    requireProfile,
    realLocation,
    setRealLocation,
    setActiveTab,
    fetchJobs,
    declineJob,
    userId,
    openOnboardingWizard
  } = useContext(AppContext);

  const { missingItems } = useProfileCompletion();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchJobs();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchJobs();
    const retryTimer = setTimeout(() => fetchJobs(), 1500);
    return () => clearTimeout(retryTimer);
  }, [fetchJobs]);

  const [declinedJobIds, setDeclinedJobIds] = useState([]);

  const handleDeclineJob = async (jobId) => {
    setDeclinedJobIds(prev => [...prev, jobId]);
    await declineJob(jobId);
  };

  const visibleJobs = useMemo(() => {
    const { jobsList = [] } = getJobsInRadius() || {};
    return jobsList.filter(job => 
      !declinedJobIds.includes(job?.id) && 
      job?.posterId !== userProfile?.id
    );
  }, [getJobsInRadius, declinedJobIds, userProfile?.id]);

  const matchingSkillsJobs = useMemo(() => {
    return visibleJobs.filter(job => 
      userProfile?.skills && Array.isArray(userProfile.skills) ? userProfile.skills.includes(job?.skillId) : false
    );
  }, [visibleJobs, userProfile]);

  const otherLocalJobs = useMemo(() => {
    return visibleJobs.filter(job => 
      userProfile?.skills && Array.isArray(userProfile.skills) ? !userProfile.skills.includes(job?.skillId) : true
    );
  }, [visibleJobs, userProfile]);

  const displayActiveTasks = useMemo(() => {
    return (jobs || []).filter(job => 
      job?.isAcceptedByMe &&
      (job?.v2_status === 'searching' || job?.v2_status === 'accepted' || job?.v2_status === 'in_progress')
    );
  }, [jobs]);

  const isProfileReady = useMemo(() => {
    const hasSkills = userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0;
    const hasServiceArea = !!(userProfile?.serviceAreaLat && userProfile?.serviceAreaLng);
    return !!userId && hasSkills && hasServiceArea;
  }, [userId, userProfile]);

  useEffect(() => {
    if (!userProfile?.id) return;
    
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
  }, [visibleJobs, userProfile?.id]);

  return (
    <div className="flex-1 flex flex-col bg-white h-full select-none">
      
      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-6 pb-28 space-y-6 max-w-md mx-auto w-full">
        {/* Start Earning Button */}
        {(!userId || missingItems.length > 0) && (
          <div className="flex justify-center w-full">
            <Tooltip text="Complete configuration to start accepting jobs">
              <button
                onClick={() => openOnboardingWizard()}
                className="flex items-center justify-center bg-primary hover:bg-[#D94F0A] text-white px-6 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer font-bold text-sm tracking-wide"
              >
                <Briefcase className="w-4 h-4 mr-1.5 stroke-[2.5]" />
                <span>Start Earning</span>
              </button>
            </Tooltip>
          </div>
        )}


        {/* My Active Tasks Section */}
        {displayActiveTasks.length > 0 && (
          <div className="space-y-3 pb-4">
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
                  className="glass-card rounded-2xl p-4 relative overflow-hidden cursor-pointer active-scale transition-all duration-300 hover:!border-blue-400/60"
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

        {!isProfileReady ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-12 px-6 glass-card rounded-[32px] my-4 max-w-md mx-auto w-full">
            <div className="p-4.5 bg-primary/10 text-primary rounded-full shrink-0">
              <Briefcase className="w-10 h-10 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-dark tracking-tight">Complete Helper Profile</h3>
              <p className="text-xs font-semibold text-gray-400 max-w-[280px] mx-auto leading-normal">
                To start getting task notifications and browsing open tasks nearby, please select your skills and define your service range.
              </p>
            </div>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-20 glass-card rounded-3xl p-6">
            <div className="p-4 bg-orange-50 rounded-full text-primary">
              <Inbox className="w-10 h-10" />
            </div>
            <h3 className="text-base font-black text-dark">No Open Tasks Right Now</h3>
            <p className="text-xs font-semibold text-gray-400 max-w-[220px]">
              No tasks posted on campus yet. Check back soon!
            </p>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="mt-2 flex items-center space-x-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/15 text-primary disabled:opacity-75 active-scale transition-all rounded-xl text-xs font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {/* Section 1: Matching Skills */}
            {matchingSkillsJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                      Tasks Matching Your Skills
                    </span>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
                      title="Refresh tasks"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {matchingSkillsJobs.length} Live
                  </span>
                </div>
                {matchingSkillsJobs.map((job, idx) => (
                  <JobCard
                    key={job?.id || idx}
                    job={{ ...job, distance: `${job?.distanceVal || 0} km` }}
                    onDecline={handleDeclineJob}
                  />
                ))}
              </div>
            )}

            {/* Section 2: Other Local Fallback Tasks */}
            {otherLocalJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                      Other Tasks in Your Area
                    </span>
                    {matchingSkillsJobs.length === 0 && (
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
                        title="Refresh tasks"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {otherLocalJobs.length} Live
                  </span>
                </div>
                {otherLocalJobs.map((job, idx) => (
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
    </div>
  );
};

export default TaskerHomeScreen;
