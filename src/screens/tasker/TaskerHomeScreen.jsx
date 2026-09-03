import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Inbox, Users, AlertCircle, RefreshCw, Briefcase, Radio, Zap, Search, X, Crown, UserCheck, Filter, MapPin, Globe, Wifi } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import JobCard from '../../components/JobCard';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { SKILLS, GAME_SKILLS, HERO_DISCIPLINES, resolveUserSkills } from '../../config/constants';
import { getCurrentLocation } from '../../utils/location';
import { api } from '../../services/api';
import SetupWizardModal from '../../components/SetupWizardModal';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import { formatCurrency } from '../../utils/currency';


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
    openOnboardingWizard,
    isOnline,
    setIsOnline
  } = useContext(AppContext);

  const { missingItems, missingWizardItems } = useProfileCompletion();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [declinedJobIds, setDeclinedJobIds] = useState([]);
  const [radarSearchQuery, setRadarSearchQuery] = useState('');
  const [activeRadarFilter, setActiveRadarFilter] = useState('all'); // 'all' | 'matched' | 'physical' | 'remote'

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

  const equippedSkills = useMemo(() => {
    return resolveUserSkills(userProfile?.skills || [], userProfile?.taskerTasksCompleted || userProfile?.tasksCompleted || 0);
  }, [userProfile]);

  const equippedSpecificSkillIds = useMemo(() => {
    return new Set(equippedSkills.map(s => s.id));
  }, [equippedSkills]);

  const equippedCategoryIds = useMemo(() => {
    const ids = new Set();
    equippedSkills.forEach(s => {
      if (s.categoryId) ids.add(s.categoryId);
    });
    return ids;
  }, [equippedSkills]);

  const isJobSkillMatch = useCallback((job) => {
    if (!job) return false;
    // 1. If job specifies a granular skill, check exact equipped specific skills first
    if (job.specificSkillId) {
      if (equippedSpecificSkillIds.has(job.specificSkillId)) return true;
      if (job.skillTags && Array.isArray(job.skillTags)) {
        if (job.skillTags.some(tag => equippedSkills.some(es => es.label?.toLowerCase() === tag?.toLowerCase() || es.aliases?.some(a => a.toLowerCase() === tag?.toLowerCase())))) {
          return true;
        }
      }
      return false;
    }
    // 2. Legacy fallback for old jobs without specific_skill_id
    if (job.skillId && equippedCategoryIds.has(job.skillId)) return true;
    return false;
  }, [equippedSpecificSkillIds, equippedCategoryIds, equippedSkills]);

  const matchingSkillsJobs = useMemo(() => {
    return visibleJobs.filter(job => isJobSkillMatch(job));
  }, [visibleJobs, isJobSkillMatch]);

  const otherLocalJobs = useMemo(() => {
    return visibleJobs.filter(job => !isJobSkillMatch(job));
  }, [visibleJobs, isJobSkillMatch]);

  const filteredRadarJobs = useMemo(() => {
    return visibleJobs.filter(job => {
      if (activeRadarFilter === 'matched' && !isJobSkillMatch(job)) return false;
      const isRemoteJob = job.matchingBehavior === 'remote' || job.isRemote || ['video_editing', 'graphic_design', 'writing_translation', 'tech_support', 'others_remote'].includes(job.skillId);
      if (activeRadarFilter === 'remote' && !isRemoteJob) return false;
      if (activeRadarFilter === 'physical' && isRemoteJob) return false;

      if (radarSearchQuery.trim()) {
        const q = radarSearchQuery.trim().toLowerCase();
        const matchesDesc = job.description?.toLowerCase().includes(q);
        const matchesSkill = job.skillId?.toLowerCase().includes(q) || job.skillTags?.some(t => t.toLowerCase().includes(q));
        const matchesPoster = job.posterName?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesSkill && !matchesPoster) return false;
      }

      return true;
    });
  }, [visibleJobs, activeRadarFilter, radarSearchQuery, isJobSkillMatch]);

  const displayActiveTasks = useMemo(() => {
    return (jobs || []).filter(job => 
      job?.isAcceptedByMe && !job?.completedByMe &&
      (job?.v2_status === 'searching' || job?.v2_status === 'accepted' || job?.v2_status === 'in_progress')
    );
  }, [jobs]);

  const isProfileReady = useMemo(() => {
    if (!userId) return true; // In Guest Mode, user explores Goated Player Profile freely
    const hasSkills = userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0;
    const hasServiceArea = !!(userProfile?.serviceAreaLat && userProfile?.serviceAreaLng);
    return !!userId && hasSkills && hasServiceArea;
  }, [userId, userProfile]);

  useEffect(() => {
    fetchJobs();
    const retryTimer = setTimeout(() => fetchJobs(), 1500);
    return () => clearTimeout(retryTimer);
  }, [fetchJobs]);

  // Background GPS Fetch: triggers only when task cards are visible on the screen,
  // resolving accurate relative distances.
  useEffect(() => {
    if (isOnline && visibleJobs.length > 0 && !realLocation && navigator.geolocation) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((result) => {
            if (result.state === 'granted') {
              getCurrentLocation()
                .then((loc) => setRealLocation(loc))
                .catch((err) => console.log('Background GPS fetch paused/denied:', err));
            }
          })
          .catch((err) => console.log('Permission check for background GPS failed:', err));
      }
    }
  }, [isOnline, visibleJobs.length, realLocation, setRealLocation]);

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

  const isScreenEmpty = !isOnline || !isProfileReady || (visibleJobs.length === 0 && displayActiveTasks.length === 0);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full select-none">
      
      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-1.5 pb-32 space-y-3.5 max-w-md lg:max-w-xl mx-auto w-full">
        




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
                          {skill?.label || 'Contract'}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-blue-500 bg-blue-50 border-blue-200">
                          In Execution
                        </span>
                      </div>
                    </div>
                    <span className="text-dark font-black text-sm">{formatCurrency(job.amount, job.currency)} Bounty</span>
                  </div>
                  
                  <p className="text-xs font-bold text-dark line-clamp-2 mb-3">
                    {job.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 border-t border-dashed border-gray-100 pt-3">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Crew: {job.peopleNeeded}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400">
                      <span>Fixer: <span className="text-gray-600 font-extrabold">{job.posterName || 'Contractor'}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quest Radar Search & Filter Control Deck */}
        {isOnline && isProfileReady && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span>Live Quest Radar</span>
              </h2>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-xl text-slate-400 hover:text-primary hover:bg-orange-50 transition-colors flex items-center space-x-1 text-xs font-bold cursor-pointer"
                title="Ping radar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                <span>{isRefreshing ? 'Pinging...' : 'Ping'}</span>
              </button>
            </div>

            {/* Radar Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={radarSearchQuery}
                onChange={(e) => setRadarSearchQuery(e.target.value)}
                placeholder="Search live bounties by skill or keyword..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition-all shadow-inner"
              />
              {radarSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRadarSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Radar Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setActiveRadarFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center justify-center leading-none ${
                  activeRadarFilter === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                All ({visibleJobs.length})
              </button>
              <button
                onClick={() => setActiveRadarFilter('matched')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 leading-none ${
                  activeRadarFilter === 'matched'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-orange-50 text-orange-700 border border-orange-200/60 hover:bg-orange-100/70'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-none">Matched ({matchingSkillsJobs.length})</span>
              </button>
              <button
                onClick={() => setActiveRadarFilter('physical')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 leading-none ${
                  activeRadarFilter === 'physical'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-none">Nearby</span>
              </button>
              <button
                onClick={() => setActiveRadarFilter('remote')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 leading-none ${
                  activeRadarFilter === 'remote'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-none">Remote</span>
              </button>
            </div>
          </div>
        )}

        {!isOnline ? (
          <div className="flex flex-col items-center justify-center text-center space-y-2.5 py-12 px-6 bg-transparent w-full animate-scale-up">
            <div className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl shrink-0">
              <Radio className="w-7 h-7 stroke-[2.2] opacity-50" />
            </div>
            <span className="text-xs font-semibold text-slate-400 max-w-[220px] leading-relaxed">
              Radar offline. Switch online to discover live bounties.
            </span>
          </div>
        ) : !isProfileReady ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-10 px-6 bg-transparent w-full">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-full shrink-0 relative z-10">
              <Briefcase className="w-7 h-7" />
            </div>
            <span className="text-xs font-semibold text-dark relative z-10 max-w-[260px] leading-normal">
              Calibrate your Operator Dossier to unlock live sector bounties &amp; start earning.
            </span>
          </div>
        ) : (filteredRadarJobs.length === 0 && displayActiveTasks.length === 0) ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-10 px-6 bg-transparent w-full">
            <div className="p-4 bg-orange-500/10 rounded-full text-primary relative z-10">
              <Inbox className="w-8 h-8" />
            </div>
            <span className="text-xs font-semibold text-gray-400 max-w-[240px] relative z-10 leading-normal">
              {radarSearchQuery ? `No active quests matching "${radarSearchQuery}".` : 'Sector Quiet. No open bounties within your radar perimeter right now.'}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="mt-2 flex items-center space-x-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/15 text-primary disabled:opacity-75 active-scale transition-all rounded-xl text-xs font-bold cursor-pointer relative z-10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Pinging...' : 'Ping Radar'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {filteredRadarJobs.map((job, idx) => {
              const isMatch = isJobSkillMatch(job);
              return (
                <div key={job?.id || idx} className="relative">
                  {isMatch && (
                    <div className="flex items-center space-x-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-t-xl -mb-1 w-fit ml-2 z-10 relative">
                      <UserCheck className="w-2.5 h-2.5 text-amber-600" />
                      <span>100% Talent Match • Fits your Skill Tree</span>
                    </div>
                  )}
                  <JobCard
                    job={{ ...job, distance: `${job?.distanceVal || 0} km` }}
                    onDecline={handleDeclineJob}
                  />
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

export default TaskerHomeScreen;
