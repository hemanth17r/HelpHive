import React, { useContext, useState } from 'react';
import { Users, IndianRupee, MapPin, Clock, Check, X } from 'lucide-react';
import { SKILLS } from '../config/constants';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import Tooltip from './Tooltip';
import { formatSelectedTime, getCurrentLocation } from '../utils/location';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const JobCard = ({ job, onDecline }) => {
  const { acceptJob, requireProfile, requireLocation, realLocation, setRealLocation, userProfile, pushScreen, setTaskerActivityScrollTarget, role, userId, openLoginModal, openOnboardingWizard } = useContext(AppContext);
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
  
  // Find skill icon
  const skill = SKILLS.find(s => s.id === job.skillId);
  const Icon = skill ? skill.icon : SKILLS[SKILLS.length - 1].icon;

  const [isAccepting, setIsAccepting] = useState(false);

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

    // 1. Check UPI ID first
    if (!userProfile?.upiId) {
      showToast('Please add your UPI ID to receive payments.', 'error');
      setTaskerActivityScrollTarget('upi');
      pushScreen('tasker_activity');
      return;
    }

    // 2. Accept directly (uses Service Area fallback from DB)
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

  return (
    <div className="m3-card rounded-[24px] p-6 flex flex-col space-y-4 hover:border-primary/30 transition-all duration-250">
      {/* Header Info */}
      <div className="flex items-start space-x-3">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 text-left">
          <span className="inline-block text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-md mb-1">
            {skill ? skill.label : 'General'}
          </span>
          <p className="text-sm font-semibold text-dark leading-snug line-clamp-2">
            {job.description}
          </p>
          {job.address?.completeAddress && (
            <div className="flex items-start mt-1.5 space-x-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-[11px] font-bold text-gray-500 leading-snug">
                {job.address.completeAddress?.startsWith('Location at') && job.address.landmark 
                  ? job.address.landmark 
                  : job.address.completeAddress}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dashed border-border-m3 text-[11px] font-bold text-gray-500">
        <div className="flex items-center space-x-1.5">
          <Users className="w-4 h-4 text-gray-400" />
          <span>{job.peopleNeeded} {job.peopleNeeded > 1 ? 'people' : 'person'} needed</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <IndianRupee className="w-4 h-4 text-gray-400" />
          <span className="text-dark">₹{job.amount} offered</span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-hidden">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
          {hasReferenceLocation ? (
            <span className="truncate">{job.distanceVal} km away</span>
          ) : (
            <span onClick={handleRequestLocation} className="text-primary cursor-pointer hover:underline truncate" style={{fontSize: '9px'}}>
              Turn on location to see distance
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>{formatSelectedTime(job.expiresAt || job.timePosted)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3 pt-2">
        <Tooltip text="Decline and remove from feed" className="flex-1">
          <button
            onClick={() => onDecline(job.id)}
            disabled={isAccepting}
            className={`w-full flex items-center justify-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-5 rounded-full text-xs transition-colors cursor-pointer active-scale ${isAccepting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
        </Tooltip>
        
        <Tooltip text="Accept task and get details" className="flex-1">
          <button
            onClick={handleAcceptJob}
            disabled={timeLeft === 0 || isAccepting}
            className={`w-full flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-5 rounded-full text-xs transition-all cursor-pointer active-scale ${timeLeft === 0 || isAccepting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAccepting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isAccepting ? 'Accepting...' : `Accept${timeLeft !== null ? formatTimeLeft(timeLeft) : ''}`}</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default JobCard;
