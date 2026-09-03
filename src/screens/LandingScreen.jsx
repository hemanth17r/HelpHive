import React, { useContext, useMemo } from 'react';
import { 
  Radio, 
  PlusCircle, 
  Zap, 
  ChevronRight
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import BirdAvatar from '../components/BirdAvatars';
import { ToastContext } from '../store/ToastContext';
import { formatCurrency } from '../utils/currency';

const LandingScreen = () => {
  const { 
    userProfile, 
    userId, 
    selectedBird, 
    pushScreen, 
    jobs, 
    userLocation,
    currency 
  } = useContext(AppContext);

  const { showToast } = useContext(ToastContext);

  // Dynamic Sector Metrics
  const activeBountiesCount = useMemo(() => {
    return (jobs || []).filter(j => j.status === 'open' || j.v2_status === 'searching').length;
  }, [jobs]);

  const totalBountyPool = useMemo(() => {
    return (jobs || [])
      .filter(j => j.status === 'open' || j.v2_status === 'searching')
      .reduce((sum, j) => sum + (parseFloat(j.amount) || 0) * (j.peopleNeeded || 1), 0);
  }, [jobs]);

  // Completed Ops
  const completedOps = useMemo(() => {
    if (!userId) return 34;
    const taskerCompleted = (jobs || []).filter(j => 
      (j.taskerId === userProfile?.id || j.taskerName === userProfile?.name || j.isAcceptedByMe) && 
      (j.status === 'completed' || j.completedByMe)
    ).length;
    const posterCompleted = (jobs || []).filter(j => 
      (j.posterId === userProfile?.id || j.posterName === userProfile?.name) && 
      j.status === 'completed'
    ).length;
    return taskerCompleted + posterCompleted;
  }, [jobs, userProfile?.id, userProfile?.name, userId]);

  const agentLevel = useMemo(() => {
    if (!userId) return 14;
    if (completedOps === 0) return 1;
    return Math.min(99, Math.floor(Math.sqrt(completedOps * 4)) + 1);
  }, [completedOps, userId]);

  return (
    <div 
      className="flex-1 flex flex-col bg-gradient-to-b from-[#FFFDFB] via-[#FCF9F6] to-[#FAF6F2] text-[#1E293B] min-h-full overflow-y-auto no-scrollbar select-none relative font-['Nunito',_sans-serif]"
    >
      {/* Soft Luminous Warm Radial Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/30 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-amber-50/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col justify-center px-5 py-6 max-w-md lg:max-w-xl mx-auto w-full z-10 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center pt-2 space-y-1">
          <div className="inline-flex items-center justify-center relative">
            <h1 className="text-3xl sm:text-4xl font-[1000] tracking-tight text-dark leading-none">
              Help<span className="text-primary">Hive</span>
            </h1>
            <span className="self-start mt-0.5 sm:mt-1 ml-1 text-[9px] sm:text-[10px] font-[900] uppercase tracking-wider text-primary leading-none select-none">
              BETA
            </span>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-dark/70">
            OPEN WORLD GAME
          </p>
        </div>

        {/* ================= 1. AGENT IDENTITY CARD ================= */}
        <div 
          onClick={() => pushScreen('my_profile')}
          className="bg-white rounded-[28px] p-4.5 border border-orange-200/70 shadow-sm hover:shadow-md cursor-pointer active-scale transition-all duration-200 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              
              {/* Bird Avatar with Warm Level Ring */}
              <div className="relative">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center p-[2.5px]"
                  style={{ background: `conic-gradient(#F26419 ${Math.min(100, agentLevel * 10)}%, #FFE6D5 ${Math.min(100, agentLevel * 10)}%)` }}
                >
                  <div className="w-full h-full rounded-full bg-orange-50 flex items-center justify-center border-2 border-white shadow-inner overflow-hidden">
                    <BirdAvatar birdName={selectedBird || 'robin'} size={40} />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white">
                  Lv.{agentLevel}
                </div>
              </div>

              {/* Callsign & Tag */}
              <div>
                <h2 className="text-base font-black text-dark tracking-tight group-hover:text-primary transition-colors">
                  {userProfile?.name || 'Agent Operative'}
                </h2>

                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[11px] font-bold text-gray-400">
                    {completedOps} Ops Fulfilled
                  </span>
                </div>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </div>
        </div>

        {/* ================= 2. LIVE SECTOR STATS MATRIX ================= */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[24px] p-4 border border-orange-200/60 shadow-xs text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Active Bounties
              </span>
              <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
            <div className="text-2xl font-[1000] text-dark">
              {activeBountiesCount}
            </div>
            <span className="text-[10px] font-bold text-gray-400 block mt-0.5">
              Open in perimeter
            </span>
          </div>

          <div className="bg-white rounded-[24px] p-4 border border-orange-200/60 shadow-xs text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Sector Pool
              </span>
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-[1000] text-emerald-700">
              {formatCurrency(totalBountyPool > 0 ? totalBountyPool : 12500, currency?.code)}
            </div>
            <span className="text-[10px] font-bold text-gray-400 block mt-0.5">
              Direct bounty payouts
            </span>
          </div>
        </div>

        {/* ================= 3. LAUNCH PILLARS ================= */}
        <div className="space-y-3 pt-1">
          
          {/* Pillar A: ENTER RADAR GRID */}
          <button
            onClick={() => pushScreen('tasker_home')}
            className="w-full bg-[#F26419] hover:bg-[#FF772A] text-white p-4.5 rounded-[26px] shadow-md shadow-orange-500/20 cursor-pointer active-scale transition-all duration-200 flex items-center justify-between group border-2 border-white/20"
          >
            <div className="flex items-center space-x-3.5 text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-[900] text-white leading-tight">
                    Enter Radar Grid
                  </h3>
                  <span className="text-[9px] font-black uppercase bg-white/25 text-white px-2 py-0.5 rounded-full">
                    HUNT
                  </span>
                </div>
                <p className="text-xs font-bold text-white/90 mt-0.5">
                  Scan nearby bounties & stack cash in the field.
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* Pillar B: DEPLOY SQUAD CONTRACT */}
          <button
            onClick={() => pushScreen('post_job')}
            className="w-full bg-white hover:bg-orange-50/50 text-dark p-4.5 rounded-[26px] border-2 border-orange-200/80 hover:border-primary shadow-xs cursor-pointer active-scale transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3.5 text-left">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-primary flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-[900] text-dark leading-tight group-hover:text-primary transition-colors">
                    Deploy a Contract
                  </h3>
                  <span className="text-[9px] font-black uppercase bg-orange-100 text-primary px-2 py-0.5 rounded-full">
                    HOST OP
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  Broadcast bounties & summon vetted squadmates.
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

        </div>

      </div>
    </div>
  );
};

export default LandingScreen;
