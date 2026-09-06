import React, { useState, useContext } from 'react';
import { Users, MapPin, MoreVertical, Copy, ArrowRight, Zap, Check } from 'lucide-react';
import { GAME_SKILLS, SKILLS } from '../config/constants';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import { formatCurrency } from '../utils/currency';

/**
 * Single Source of Truth for Deployed Bounty Cards
 * Used in PosterHomeScreen and OperationsScreen (Deployed tab).
 */
const DeployedBountyCard = ({
  job,
  showKeycode = true,
  onClick
}) => {
  const { setCurrentPostedJob, pushScreen, deleteJob } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedKeycode, setCopiedKeycode] = useState(false);

  // Robust skill resolution from GAME_SKILLS and SKILLS
  const skill = GAME_SKILLS.find(s => s.id === job.specificSkillId || s.id === job.skillId || s.id === job.skill_id) 
    || SKILLS.find(s => s.id === job.skillId || s.id === job.skill_id);
  const Icon = skill ? skill.icon : Zap;

  // Keycode / Clearance OTP
  const keycode = job.otp || '7492';

  // Status Badge
  const getJobStatusBadge = (j) => {
    const status = j.v2_status || j.status;
    switch (status) {
      case 'open':
      case 'searching':
        return { text: 'Scanning Sector...', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 'in_progress':
        return { text: 'In Execution', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'accepted':
        return { text: 'Claimer Locked In', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'crew_set':
        return { text: 'Strike Team Assembled', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
      case 'completed':
        return { text: 'Bounty Fulfilled', color: 'text-gray-500 bg-gray-50 border-gray-200' };
      default:
        return { text: 'Active Bounty', color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  const statusInfo = getJobStatusBadge(job);

  const handleClick = () => {
    if (onClick) {
      onClick(job);
      return;
    }
    setCurrentPostedJob(job);
    if (job.status === 'completed') {
      pushScreen('job_receipt');
    } else if (job.status === 'open' || job.v2_status === 'searching') {
      pushScreen('live_status', true);
    } else {
      pushScreen('crew_confirmed', true);
    }
  };

  const handleCopyKeycode = (e) => {
    e.stopPropagation();
    if (!keycode) return;
    navigator.clipboard.writeText(keycode);
    setCopiedKeycode(true);
    showToast('Keycode copied to clipboard!', 'success');
    setTimeout(() => setCopiedKeycode(false), 2000);
  };

  const handleCancelBounty = (e) => {
    e.stopPropagation();
    deleteJob(job.id);
    setDropdownOpen(false);
    showToast('Bounty aborted successfully.', 'info');
  };

  return (
    <div
      onClick={handleClick}
      className="m3-card m3-card-hover rounded-[22px] p-4 sm:p-5 cursor-pointer active-scale transition-all duration-300 border border-border/80 group bg-white shadow-xs select-none"
    >
      {/* Top Header: Icon + Status + Amount + Context Menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 block leading-none mb-1">
              {skill?.label || 'Bounty'}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
        </div>

        {/* Right Side: Amount & Options Menu */}
        <div className="flex items-center space-x-1">
          <span className="text-dark font-black text-sm text-primary mr-1">
            {formatCurrency(job.amount, job.currency)}
          </span>
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {dropdownOpen && (
              <div 
                className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-border py-1 z-20 overflow-hidden animate-[fadeIn_150ms_ease-out]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleCancelBounty}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Cancel Bounty
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs font-bold text-dark line-clamp-2 mb-2.5 leading-snug text-left">
        {job.description}
      </p>

      {/* Clearance Keycode Box */}
      {showKeycode && keycode && (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-2.5 mb-2.5 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-orange-700 block leading-none mb-0.5">
              Bounty Clearance Keycode
            </span>
            <span className="text-[10px] font-medium text-gray-500">
              Share upon work verification:
            </span>
          </div>
          <button
            onClick={handleCopyKeycode}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-orange-200 rounded-lg shadow-2xs hover:bg-orange-100/50 transition-colors cursor-pointer"
            title="Click to copy keycode"
          >
            <span className="text-xs font-black tracking-widest text-primary">{keycode}</span>
            {copiedKeycode ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3 text-primary" />
            )}
          </button>
        </div>
      )}

      {/* Address */}
      {job.address?.completeAddress && (
        <div className="flex items-center space-x-1 text-[11px] font-medium text-gray-400 mb-2.5 text-left">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate">
            {job.address.completeAddress?.startsWith('Location at') && job.address.landmark 
              ? job.address.landmark 
              : job.address.completeAddress}
          </span>
        </div>
      )}

      {/* Bottom Footer: Crew & Action Details */}
      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 border-t border-dashed border-border pt-2.5">
        <div className="flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>{job.peopleNeeded > 1 ? `Squad (${job.peopleNeeded})` : 'Solo (1)'}</span>
        </div>
        <div className="flex items-center space-x-1 text-primary group-hover:translate-x-1 transition-transform text-xs font-black">
          <span>Bounty Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

export default DeployedBountyCard;
