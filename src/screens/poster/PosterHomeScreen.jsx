import React, { useContext, useEffect, useState, useMemo } from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import BirdAvatar from '../../components/BirdAvatars';
import GuestTourBanner from '../../components/GuestTourBanner';
import DeployedBountyCard from '../../components/DeployedBountyCard';

const PosterHomeScreen = () => {
  const { 
    userLocation, 
    userProfile, 
    selectedBird,
    jobs,
    pushScreen,
    requireProfile,
    requireLocation,
    realLocation,
    setRealLocation,
    fetchJobs,
    userId,
    openLoginModal,
    currency
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
  const EXAMPLE_TASKS = [
    "Pick up urgent grocery delivery for a neighbour",
    "Need 2 helpers to assemble flatpack furniture",
    "Queue assistance for event passes early morning",
    "Help distribute water & snacks at local event"
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
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      };
    }
  }, [displayActiveJobs.length]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full select-none">
      
      {/* Main Content Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-1.5 pb-32 space-y-4 max-w-md lg:max-w-xl mx-auto w-full">

        {/* Header & Refresh */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Deployed Bounties
            </h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 text-slate-500 hover:text-primary active-scale transition-all cursor-pointer text-xs font-bold p-1.5 rounded-xl hover:bg-orange-50"
            title="Ping sector radar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{isRefreshing ? 'Pinging...' : 'Ping Radar'}</span>
          </button>
        </div>

        {displayActiveJobs.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center py-6">
            <div className="w-full text-center flex flex-col items-center space-y-4 max-w-sm mx-auto">
              <div className="w-16 h-16 bg-orange-500/10 text-primary rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
                <PlusCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <h3 className="text-base font-black text-slate-900">
                  No Active Bounties Deployed
                </h3>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                  Post a bounty to mobilize vetted operators and strike teams in your sector.
                </p>
              </div>

              <button
                onClick={() => pushScreen('post_job')}
                className="w-full max-w-xs py-3.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center space-x-2 cursor-pointer active-scale transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Deploy New Bounty</span>
              </button>

              {/* Rotating Templates Deck */}
              <div className="w-full pt-4 space-y-2 max-w-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                  Hot Mission Ideas
                </span>
                <div className="min-h-[44px] flex items-center justify-center px-2">
                  <p className={`text-xs font-semibold text-slate-600 italic leading-relaxed transition-opacity duration-300 ${fadeState === 'fade-out' ? 'opacity-0' : 'opacity-100'}`}>
                    "{EXAMPLE_TASKS[exampleIndex]}"
                  </p>
                </div>

                <div className="flex justify-center space-x-1.5 pt-0.5">
                  {EXAMPLE_TASKS.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${idx === exampleIndex ? 'bg-primary w-4' : 'bg-slate-300/80 w-1.5'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayActiveJobs.map(job => (
              <DeployedBountyCard key={job.id} job={job} />
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default PosterHomeScreen;
