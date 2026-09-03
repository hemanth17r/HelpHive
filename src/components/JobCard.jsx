import React, { useContext, useState } from 'react';
import { Users, MapPin, Clock, Check, X, Zap, Award, Heart, Navigation } from 'lucide-react';
import { SKILLS, GAME_SKILLS } from '../config/constants';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import Tooltip from './Tooltip';
import { formatSelectedTime, getCurrentLocation } from '../utils/location';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { formatCurrency } from '../utils/currency';

const JobCard = ({ job, onDecline }) => {
  const { 
    acceptJob, 
    realLocation, 
    setRealLocation, 
    userProfile, 
    pushScreen, 
    setTaskerActivityScrollTarget, 
    role, 
    userId, 
    openLoginModal, 
    openOnboardingWizard 
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const { missingWizardItems } = useProfileCompletion();

  const hasReferenceLocation = role === 'tasker'
    ? ((userProfile?.serviceAreaLat !== null && userProfile?.serviceAreaLng !== null && userProfile?.serviceAreaLat !== undefined && userProfile?.serviceAreaLng !== undefined) || (realLocation !== null && realLocation !== undefined))
    : (realLocation !== null && realLocation !== undefined);

  const handleRequestLocation = async (e) => {
    e.stopPropagation();
    try {
      const loc = await getCurrentLocation();
      setRealLocation(loc);
    } catch(err) {
      console.error('Location request denied or failed', err);
      showToast('Location permission is required to see distance.', 'error');
    }
  };
  
  // Find skill icon & label
  const skill = GAME_SKILLS.find(s => s.id === job.specificSkillId || s.id === job.skillId || s.id === job.skill_id) || SKILLS.find(s => s.id === job.skillId || s.id === job.skill_id);
  const Icon = skill ? skill.icon : Zap;

  const [isAccepting, setIsAccepting] = useState(false);

  // Rarity & Bounty Calculation
  const amountVal = parseFloat(job.amount) || 0;
  const isVolunteer = amountVal === 0;
  const isLegendary = amountVal >= 1000;

  // Clean Premium Theme Classes matching HelpHive Canvas
  const cardTheme = isLegendary
    ? 'bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 border-amber-300/80 shadow-xs hover:border-amber-400'
    : isVolunteer
      ? 'bg-gradient-to-br from-teal-50/40 via-white to-teal-50/20 border-teal-300/80 shadow-xs hover:border-teal-400'
      : 'bg-white border-gray-100 hover:border-primary/40 shadow-xs';

  const handleAcceptJob = async () => {
    if (!userId) {
      openLoginModal(() => {
        handleAcceptJob();
      });
      return;
    }

    const isWizardCompleted = localStorage.getItem(`helphive_wizard_completed_tasker_${userId}`) === 'true' && missingWizardItems.length === 0;
    if (!isWizardCompleted) {
      openOnboardingWizard(() => {
        handleAcceptJob();
      });
      return;
    }

    setIsAccepting(true);
    try {
      await acceptJob(job.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const [timeLeft, setTimeLeft] = useState(null);

  React.useEffect(() => {
    if (!job.offerExpiresAt || !job.isPendingOffer) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(job.offerExpiresAt).getTime() - Date.now();
      if (difference <= 0) {
        return 0;
      }
      return Math.floor(difference / 1000);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [job.offerExpiresAt, job.isPendingOffer]);

  const formatTimeLeft = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    if (seconds <= 0) return ' (Expired)';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return ` (${mins}:${secs.toString().padStart(2, '0')})`;
  };

  const subTags = Array.isArray(job.skillTags) ? job.skillTags : (Array.isArray(job.skill_tags) ? job.skill_tags : []);

  return (
    <div className={`m3-card rounded-[24px] p-5 sm:p-6 flex flex-col space-y-4 transition-all duration-200 border ${cardTheme}`}>
      
      {/* Top Category & Rarity Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-2xl shrink-0 ${
            isLegendary 
              ? 'bg-amber-100 text-amber-800' 
              : isVolunteer 
                ? 'bg-teal-100 text-teal-800' 
                : 'bg-primary/10 text-primary'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block leading-none mb-1">
              {skill ? skill.label : 'Contract'}
            </span>
            <p className="text-xs font-bold text-gray-500">
              Op Lead: <span className="text-dark font-extrabold">{job.posterName || 'Nearby Client'}</span>
            </p>
          </div>
        </div>

        {/* Clean Bounty Pill */}
        {isLegendary ? (
          <div className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-xs shrink-0">
            <Award className="w-3.5 h-3.5 fill-white" />
            <span>{formatCurrency(job.amount, job.currency)}</span>
          </div>
        ) : isVolunteer ? (
          <div className="flex items-center space-x-1.5 bg-teal-100 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-xl text-xs font-extrabold shrink-0">
            <Heart className="w-3.5 h-3.5 text-teal-600 fill-teal-600" />
            <span>Community</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 bg-orange-50 text-primary border border-orange-200/80 px-2.5 py-1 rounded-xl text-xs font-black shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
            <span>{formatCurrency(job.amount, job.currency)}{job.peopleNeeded > 1 ? '/op' : ''}</span>
          </div>
        )}
      </div>

      {/* Quest Description */}
      <div className="text-left space-y-1.5">
        <p className="text-sm font-bold text-dark leading-snug">
          {job.description}
        </p>
        {job.address?.completeAddress && (
          <div className="flex items-start space-x-1.5 text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span className="text-[11px] font-bold leading-snug">
              {job.address.completeAddress?.startsWith('Location at') && job.address.landmark 
                ? job.address.landmark 
                : job.address.completeAddress}
            </span>
          </div>
        )}
      </div>

      {/* Sub-Skill Tag Chips */}
      {subTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {subTags.map((tag, idx) => (
            <span key={idx} className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200/60">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Quest Details Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-dashed border-gray-200 text-[11px] font-bold text-gray-500">
        <div className="inline-flex items-center space-x-1.5 leading-none">
          {job.peopleNeeded > 1 ? (
            <>
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-primary font-black leading-none">Strike Team ({job.peopleNeeded} Slots)</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="leading-none">Solo Op (1)</span>
            </>
          )}
        </div>
        
        {/* Proximity Radar Pill */}
        <div className="inline-flex items-center space-x-1.5 overflow-hidden leading-none">
          <div className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </div>
          {hasReferenceLocation ? (
            <span className="truncate text-dark font-extrabold leading-none">{job.distanceVal} km away</span>
          ) : (
            <span onClick={handleRequestLocation} className="text-primary cursor-pointer hover:underline truncate text-[10px] leading-none">
              GPS for radar distance
            </span>
          )}
        </div>

        <div className="inline-flex items-center space-x-1.5 col-span-2 text-gray-500 leading-none">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="leading-none">Timing: {formatSelectedTime(job.expiresAt || job.timePosted)}</span>
        </div>
      </div>

      {/* Clean Tactile Action Buttons */}
      <div className="flex items-center space-x-3 pt-1">
        <Tooltip text="Pass contract" className="flex-1">
          <button
            onClick={() => onDecline(job.id)}
            disabled={isAccepting}
            className={`w-full flex items-center justify-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer active:scale-[0.98] ${isAccepting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Pass</span>
          </button>
        </Tooltip>
        
        <Tooltip text="Lock in contract bounty" className="flex-1">
          <button
            onClick={handleAcceptJob}
            disabled={timeLeft === 0 || isAccepting}
            className={`w-full flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary/90 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-[0.98] ${timeLeft === 0 || isAccepting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAccepting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isAccepting ? 'Locking In...' : `Lock In Bounty${timeLeft !== null ? formatTimeLeft(timeLeft) : ''}`}</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default JobCard;
