import React, { useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock, CheckCircle, Users, MoreVertical, MapPin, XCircle } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { SKILLS } from '../config/constants';

const JobHistoryScreen = () => {
  const { popScreen, jobHistoryTab, jobs, userProfile, role, pushScreen, setCurrentPostedJob, setAcceptedJob, deleteJob, setEditJobData } = useContext(AppContext);

  // Separate jobs based on role
  const userJobs = jobs.filter(j => {
    if (role === 'tasker') {
      return j.isAcceptedByMe || j.isCancelledByMe || j.taskerId === userProfile?.id || j.taskerName === userProfile?.name;
    }
    return j.posterName === userProfile?.name || j.posterName === 'You' || j.posterId === userProfile?.id;
  });

  const activeJobs = userJobs.filter(j => j.status !== 'expired' && j.status !== 'completed' && j.status !== 'draft' && j.status !== 'cancelled' && !j.isCancelledByMe && !(role === 'tasker' && j.completedByMe));
  const completedJobs = userJobs.filter(j => (j.status === 'completed' || (role === 'tasker' && j.completedByMe)) && !j.isCancelledByMe);
  const expiredJobs = userJobs.filter(j => j.status === 'expired' && !j.isCancelledByMe);
  const cancelledJobs = userJobs.filter(j => j.isCancelledByMe || j.status === 'cancelled');

  const displayActive = activeJobs;
  const displayCompleted = completedJobs;
  const displayExpired = expiredJobs;
  const displayCancelled = cancelledJobs;

  const activeRef = useRef(null);
  const completedRef = useRef(null);
  const expiredRef = useRef(null);
  const cancelledRef = useRef(null);

  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    // Bug 3.3 fix: store the timeout ID so it can be cleared if the component
    // unmounts before the 100ms delay expires (prevents stale state update).
    const scrollTimer = setTimeout(() => {
      if (jobHistoryTab === 'active' && activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (jobHistoryTab === 'completed' && completedRef.current) completedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [jobHistoryTab]);

  const renderJobCard = (job, type) => {
    const skill = SKILLS.find(s => s.id === job.skillId || s.id === job.skill_id) || SKILLS[0];
    const Icon = skill.icon;
    
    let borderColor = 'border-gray-200';
    let iconBg = 'bg-gray-50 text-gray-500';
    let statusPill = null;
    const isExpired = job.status === 'expired';

    if (type === 'active') {
      borderColor = 'border-blue-100';
      iconBg = 'bg-blue-50 text-blue-500';
      statusPill = <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-blue-500 bg-blue-50 border-blue-200">Active</span>;
    } else if (isExpired) {
      borderColor = 'border-red-100';
      iconBg = 'bg-red-50 text-red-500';
      statusPill = <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-red-500 bg-red-50 border-red-200">Expired</span>;
    } else if (type === 'completed') {
      borderColor = 'border-green-100';
      iconBg = 'bg-green-50 text-green-500';
      statusPill = <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-green-500 bg-green-50 border-green-200">Completed</span>;
    } else if (type === 'cancelled') {
      borderColor = 'border-red-100';
      iconBg = 'bg-red-50 text-red-500';
      statusPill = <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-red-500 bg-red-50 border-red-200">Cancelled</span>;
    }

    return (
      <div 
        key={job.id} 
        onClick={() => {
          if (isExpired) {
            // Expired jobs do not open receipt summary
            return;
          }
          if (type === 'completed' || type === 'cancelled') {
            setCurrentPostedJob(job);
            pushScreen('job_receipt');
          } else if (type === 'active') {
            if (role === 'tasker') {
              setAcceptedJob(job);
              pushScreen('tasker_accepted_job', true);
            } else {
              setCurrentPostedJob(job);
              if (job.status === 'open' || job.v2_status === 'searching') {
                pushScreen('live_status', true);
              } else {
                pushScreen('crew_confirmed', true);
              }
            }
          }
        }}
        className={`bg-white border ${borderColor} rounded-2xl p-4 shadow-sm relative ${(!isExpired && (type === 'completed' || type === 'cancelled' || type === 'active')) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      >
        {!isExpired && type === 'completed' && <div className="absolute top-0 left-0 w-1 h-full bg-green-400 rounded-l-2xl"></div>}
        {isExpired && <div className="absolute top-0 left-0 w-1 h-full bg-red-400 rounded-l-2xl"></div>}
        {type === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-400 rounded-l-2xl"></div>}
        {type === 'cancelled' && <div className="absolute top-0 left-0 w-1 h-full bg-red-400 rounded-l-2xl"></div>}
        
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">
                {skill?.label || 'Task'}
              </span>
              {statusPill}
            </div>
          </div>
          
          {role === 'poster' && (
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
                  {isExpired && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditJobData({
                          skillId: job.skillId || job.skill_id,
                          description: (job.description || '').split('\n[Time:')[0],
                          peopleNeeded: job.peopleNeeded || job.people_needed,
                          amount: job.amount,
                          address: job.address,
                          isRepost: true
                        });
                        pushScreen('post_job');
                        setActiveDropdownId(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-primary hover:bg-orange-50 transition-colors border-b border-gray-100"
                    >
                      Repost
                    </button>
                  )}
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
          )}
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
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-4 bg-white shrink-0 z-10 sticky top-0">
        <button
          onClick={popScreen}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-black text-dark ml-2">Task History</span>
      </div>

      <div className="flex-1 overflow-y-auto w-full">
        <div className="px-4 py-6 space-y-10 max-w-md lg:max-w-2xl lg:px-8 mx-auto pb-20">
        
        {/* Active Section */}
        <div ref={activeRef} className="space-y-4 pt-4 scroll-m-4" id="active-section">
          <div className="flex items-center space-x-2 px-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-black uppercase tracking-widest text-dark">
              Active Tasks
            </span>
          </div>
          <div className="space-y-3">
            {displayActive.length > 0 ? (
              displayActive.map(job => renderJobCard(job, 'active'))
            ) : (
              <p className="text-xs font-bold text-gray-400 px-2">No active tasks.</p>
            )}
          </div>
        </div>

        {/* Completed Section */}
        <div ref={completedRef} className="space-y-4 pt-4 scroll-m-4" id="completed-section">
          <div className="flex items-center space-x-2 px-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-black uppercase tracking-widest text-dark">
              Completed Tasks
            </span>
          </div>
          <div className="space-y-3">
            {displayCompleted.length > 0 ? (
              displayCompleted.map(job => renderJobCard(job, 'completed'))
            ) : (
              <p className="text-xs font-bold text-gray-400 px-2">No completed tasks.</p>
            )}
          </div>
        </div>

        {/* Expired Section */}
        {displayExpired.length > 0 && (
          <div ref={expiredRef} className="space-y-4 pt-4 scroll-m-4" id="expired-section">
            <div className="flex items-center space-x-2 px-1">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-sm font-black uppercase tracking-widest text-dark">
                Expired Tasks
              </span>
            </div>
            <div className="space-y-3">
              {displayExpired.map(job => renderJobCard(job, 'completed'))}
            </div>
          </div>
        )}

        {/* Cancelled Section */}
        {displayCancelled.length > 0 && (
          <div ref={cancelledRef} className="space-y-4 pt-4 scroll-m-4" id="cancelled-section">
            <div className="flex items-center space-x-2 px-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-black uppercase tracking-widest text-dark">
                Cancelled Tasks
              </span>
            </div>
            <div className="space-y-3">
              {displayCancelled.map(job => renderJobCard(job, 'cancelled'))}
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
};

export default JobHistoryScreen;
