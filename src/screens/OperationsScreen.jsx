import React, { useContext, useEffect, useState, useMemo } from 'react';
import { 
  RefreshCw, 
  MapPin, 
  Users, 
  MoreVertical, 
  PlusCircle, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  AlertCircle,
  Copy,
  Phone,
  Navigation,
  Check,
  Radio,
  FileText
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import { SKILLS, GUEST_DEMO_ARCHIVE_JOBS, GUEST_DEMO_DEPLOYED_JOBS } from '../config/constants';
import { formatCurrency } from '../utils/currency';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const OperationsScreen = () => {
  const { 
    userProfile, 
    jobs, 
    pushScreen, 
    setCurrentPostedJob, 
    setAcceptedJob, 
    deleteJob, 
    fetchJobs, 
    userId,
    openLoginModal
  } = useContext(AppContext);

  const { showToast } = useContext(ToastContext);

  const isGuest = !userId || userProfile?.isGuest;

  const [activeTab, setActiveTab] = useState('deployed'); // 'deployed' | 'active'
  const [subFilter, setSubFilter] = useState('live'); // 'live' | 'archive'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const start = Date.now();
    await fetchJobs(true);
    const elapsed = Date.now() - start;
    const minDelay = 600;
    if (elapsed < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 1. Deployed Ops (Contracts issued by the current user)
  const deployedJobs = useMemo(() => {
    return (jobs || []).filter(j => 
      j.posterId === userProfile?.id || 
      j.posterName === userProfile?.name || 
      j.posterName === 'You'
    );
  }, [jobs, userProfile?.id, userProfile?.name]);

  const activeDeployedJobs = useMemo(() => {
    return deployedJobs.filter(j => 
      j.status !== 'expired' && 
      j.status !== 'completed' && 
      j.status !== 'draft' && 
      j.status !== 'cancelled'
    );
  }, [deployedJobs]);

  const completedDeployedJobs = useMemo(() => {
    const realCompleted = deployedJobs.filter(j => j.status === 'completed');
    if (isGuest && realCompleted.length === 0) {
      return GUEST_DEMO_DEPLOYED_JOBS;
    }
    return realCompleted;
  }, [deployedJobs, isGuest]);

  // 2. Active Missions (Contracts accepted by the current user)
  const activeMissions = useMemo(() => {
    return (jobs || []).filter(j => 
      j.isAcceptedByMe && !j.completedByMe &&
      (j.status === 'accepted' || j.status === 'in_progress' || j.v2_status === 'accepted' || j.v2_status === 'in_progress')
    );
  }, [jobs]);

  const completedMissions = useMemo(() => {
    const realCompleted = (jobs || []).filter(j => 
      (j.taskerId === userProfile?.id || j.taskerName === userProfile?.name || j.isAcceptedByMe) &&
      (j.status === 'completed' || j.completedByMe)
    );
    if (isGuest && realCompleted.length === 0) {
      return GUEST_DEMO_ARCHIVE_JOBS;
    }
    return realCompleted;
  }, [jobs, userProfile?.id, userProfile?.name, isGuest]);

  const getJobStatusBadge = (job) => {
    const status = job.v2_status || job.status;
    switch(status) {
      case 'open':
      case 'searching': 
        return { text: 'Scanning Sector...', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 'in_progress': 
        return { text: 'In Execution', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'accepted': 
        return { text: 'Operative Locked In', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'crew_set': 
        return { text: 'Strike Team Assembled', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
      case 'completed': 
        return { text: 'Contract Fulfilled', color: 'text-gray-500 bg-gray-50 border-gray-200' };
      default: 
        return { text: 'Active Op', color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  const handleDeployedJobClick = (job) => {
    setCurrentPostedJob(job);
    if (job.status === 'completed') {
      pushScreen('job_receipt');
    } else if (job.status === 'open' || job.v2_status === 'searching') {
      pushScreen('live_status', true);
    } else {
      pushScreen('crew_confirmed', true);
    }
  };

  const handleActiveMissionClick = (job) => {
    setAcceptedJob(job);
    pushScreen('tasker_accepted_job');
  };

  const copyKeycode = (e, keycode) => {
    e.stopPropagation();
    if (!keycode) return;
    navigator.clipboard.writeText(keycode);
    showToast(`Clearance Keycode copied: ${keycode}`, 'success');
  };

  const handleOpenMaps = (e, job) => {
    e.stopPropagation();
    const lat = job.lat || job.address?.lat;
    const lng = job.lng || job.address?.lng;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    } else if (job.address?.completeAddress) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address.completeAddress)}`, '_blank');
    } else {
      showToast('Coordinates unavailable for this sector', 'info');
    }
  };

  const handleCallClient = (e, phone) => {
    e.stopPropagation();
    if (!phone) {
      showToast('Phone contact unavailable', 'info');
      return;
    }
    window.open(`tel:${phone}`, '_self');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full select-none">
      
      {/* Operations Center Header & Mode Switcher */}
      <div className="px-4 pt-2 pb-2 bg-transparent shrink-0 max-w-md lg:max-w-xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-dark tracking-tight">Operations Center</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-slate-500 hover:text-primary hover:bg-orange-50 active-scale transition-all cursor-pointer flex items-center space-x-1"
            title="Refresh Operations"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>

        {/* Primary Role / Mode Switcher Liquid Glass Slider */}
        <div className="flex bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl mb-2.5 border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => setActiveTab('deployed')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active-scale relative overflow-hidden ${
              activeTab === 'deployed'
                ? 'bg-white/95 backdrop-blur-md text-primary shadow-[0_2px_12px_rgba(242,100,25,0.12),0_1px_3px_rgba(0,0,0,0.04)] border border-white/90'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
            }`}
          >
            <span>Deployed Ops</span>
            {activeDeployedJobs.length > 0 && (
              <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-black">
                {activeDeployedJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active-scale relative overflow-hidden ${
              activeTab === 'active'
                ? 'bg-white/95 backdrop-blur-md text-primary shadow-[0_2px_12px_rgba(242,100,25,0.12),0_1px_3px_rgba(0,0,0,0.04)] border border-white/90'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
            }`}
          >
            <span>Active Missions</span>
            {activeMissions.length > 0 && (
              <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black animate-pulse">
                {activeMissions.length}
              </span>
            )}
          </button>
        </div>

        {/* Sub-filter: Live vs Fulfilled Archive Liquid Glass Pills */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSubFilter('live')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active-scale ${
              subFilter === 'live'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-200/50 backdrop-blur-md text-slate-600 border border-white/60 hover:bg-slate-200/80'
            }`}
          >
            Active ({activeTab === 'deployed' ? activeDeployedJobs.length : activeMissions.length})
          </button>
          <button
            onClick={() => setSubFilter('archive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active-scale ${
              subFilter === 'archive'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-200/50 backdrop-blur-md text-slate-600 border border-white/60 hover:bg-slate-200/80'
            }`}
          >
            Fulfilled ({activeTab === 'deployed' ? completedDeployedJobs.length : completedMissions.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 pb-32 space-y-3.5 max-w-md lg:max-w-xl mx-auto w-full">
        
        {/* ================= TAB 1: DEPLOYED OPS ================= */}
        {activeTab === 'deployed' && (
          <div className="space-y-3.5">
            
            {/* LIVE DEPLOYED OPS */}
            {subFilter === 'live' && (
              activeDeployedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4 max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center text-primary shadow-inner">
                    <Zap className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="text-base font-black text-slate-900">No Active Deployed Contracts</h3>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      Broadcast a Solo Op or assemble a Strike Team to deploy contracts across your sector.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (isGuest) {
                        openLoginModal();
                        return;
                      }
                      pushScreen('post_job');
                    }}
                    className="w-full max-w-xs py-3.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center space-x-2 cursor-pointer active-scale transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Deploy New Contract</span>
                  </button>
                </div>
              ) : (
                activeDeployedJobs.map(job => {
                  const skill = SKILLS.find(s => s.id === job.skillId);
                  const Icon = skill ? skill.icon : Zap;
                  const statusInfo = getJobStatusBadge(job);
                  const keycode = job.otp || '7492';
                  
                  return (
                    <div 
                      key={job.id} 
                      onClick={() => handleDeployedJobClick(job)}
                      className="m3-card m3-card-hover rounded-[22px] p-4 cursor-pointer active-scale transition-all duration-300 border border-border/80 group bg-white shadow-xs"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-gray-400 block leading-none mb-1">
                              {skill?.label || 'Contract'}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${statusInfo.color}`}>
                              {statusInfo.text}
                            </span>
                          </div>
                        </div>

                        {/* Top Right: Amount & Dropdown */}
                        <div className="flex items-center space-x-1">
                          <span className="text-dark font-black text-sm text-primary mr-1">{formatCurrency(job.amount, job.currency)}</span>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === job.id ? null : job.id);
                              }}
                              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {activeDropdownId === job.id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-border py-1 z-20 overflow-hidden animate-[fadeIn_150ms_ease-out]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteJob(job.id);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  Abort Contract
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs font-bold text-dark line-clamp-2 mb-2.5">
                        {job.description}
                      </p>

                      {/* CLEARANCE KEYCODE BOX (HIGH SIGNAL) */}
                      <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-2.5 mb-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-orange-700 block leading-none mb-0.5">
                            Mission Clearance Keycode
                          </span>
                          <span className="text-[10px] font-medium text-gray-500">
                            Share upon work verification:
                          </span>
                        </div>
                        <button
                          onClick={(e) => copyKeycode(e, keycode)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-orange-200 rounded-lg shadow-2xs hover:bg-orange-100/50 transition-colors cursor-pointer"
                          title="Click to copy keycode"
                        >
                          <span className="text-xs font-black tracking-widest text-primary">{keycode}</span>
                          <Copy className="w-3 h-3 text-primary" />
                        </button>
                      </div>

                      {job.address?.completeAddress && (
                        <div className="flex items-center space-x-1 text-[11px] font-medium text-gray-400 mb-2.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{job.address.completeAddress}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 border-t border-dashed border-border pt-2.5">
                        <div className="flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>{job.peopleNeeded > 1 ? `Strike Team: ${job.peopleNeeded}` : 'Solo Op (1)'}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-primary group-hover:translate-x-1 transition-transform text-xs font-black">
                          <span>Mission Radar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* FULFILLED ARCHIVE (DEPLOYED) */}
            {subFilter === 'archive' && (
              completedDeployedJobs.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2 max-w-sm mx-auto">
                  <p className="text-xs font-bold text-slate-400">No fulfilled deployed contracts yet.</p>
                </div>
              ) : (
                completedDeployedJobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => handleDeployedJobClick(job)}
                    className="p-4 bg-white rounded-2xl border border-border/60 shadow-2xs cursor-pointer hover:border-gray-300 transition-all flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 inline-block">
                        Fulfilled & Settled
                      </span>
                      <h4 className="text-xs font-bold text-dark line-clamp-1">{job.description}</h4>
                      <span className="text-[10px] font-medium text-gray-400">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-dark">{formatCurrency(job.amount, job.currency)}</span>
                  </div>
                ))
              )
            )}

          </div>
        )}

        {/* ================= TAB 2: ACTIVE MISSIONS ================= */}
        {activeTab === 'active' && (
          <div className="space-y-3.5">
            
            {/* LIVE ACTIVE MISSIONS */}
            {subFilter === 'live' && (
              activeMissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4 max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="text-base font-black text-slate-900">No Active Field Missions</h3>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      Scan the Radar Grid to accept bounties and monetize your skills in the field.
                    </p>
                  </div>
                  <button
                    onClick={() => pushScreen('tasker_home')}
                    className="w-full max-w-xs py-3.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center space-x-2 cursor-pointer active-scale transition-all"
                  >
                    <Radio className="w-4 h-4 text-white" />
                    <span>Scan Radar Grid</span>
                  </button>
                </div>
              ) : (
                activeMissions.map(job => {
                  const skill = SKILLS.find(s => s.id === job.skillId);
                  const Icon = skill ? skill.icon : Zap;
                  const contactPhone = job.posterPhone || job.address?.contactPhone;
                  
                  return (
                    <div 
                      key={job.id} 
                      onClick={() => handleActiveMissionClick(job)}
                      className="m3-card m3-card-hover rounded-[22px] p-4 cursor-pointer active-scale transition-all duration-300 border border-emerald-200/80 group bg-emerald-50/20 shadow-xs"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2.5 bg-emerald-500/15 text-emerald-700 rounded-xl shrink-0">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-gray-500 block leading-none mb-1">
                              {skill?.label || 'Mission'}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-300 text-emerald-700 bg-emerald-100">
                              Mission Locked In
                            </span>
                          </div>
                        </div>
                        <span className="text-emerald-700 font-black text-sm">{formatCurrency(job.amount, job.currency)}</span>
                      </div>
                      
                      <p className="text-xs font-bold text-dark line-clamp-2 mb-2.5">
                        {job.description}
                      </p>

                      {job.address?.completeAddress && (
                        <div className="flex items-center space-x-1 text-[11px] font-medium text-gray-500 mb-3">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{job.address.completeAddress}</span>
                        </div>
                      )}

                      {/* FAST UTILITY ACTIONS: Turn-by-Turn & Contact Op Lead */}
                      <div className="grid grid-cols-2 gap-2 mb-3 pt-1">
                        <button
                          onClick={(e) => handleOpenMaps(e, job)}
                          className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Directions</span>
                        </button>
                        
                        <button
                          onClick={(e) => handleCallClient(e, contactPhone)}
                          className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Call Client</span>
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 border-t border-emerald-200/60 pt-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          Op Lead: {job.posterName || 'Client'}
                        </span>
                        <div className="flex items-center space-x-1 text-primary group-hover:translate-x-1 transition-transform text-xs font-black">
                          <span>Enter Clearance Key</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* FULFILLED ARCHIVE (MISSIONS) */}
            {subFilter === 'archive' && (
              completedMissions.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-[24px] border border-border/80 p-4">
                  <p className="text-xs font-bold text-gray-400">No fulfilled field missions yet.</p>
                </div>
              ) : (
                completedMissions.map(job => (
                  <div
                    key={job.id}
                    className="p-4 bg-white rounded-2xl border border-border/60 shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 inline-block">
                        Fulfilled & Stashed
                      </span>
                      <h4 className="text-xs font-bold text-dark line-clamp-1">{job.description}</h4>
                      <span className="text-[10px] font-medium text-gray-400">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-700">{formatCurrency(job.amount, job.currency)}</span>
                  </div>
                ))
              )
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default OperationsScreen;
