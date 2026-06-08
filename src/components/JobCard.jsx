import React, { useContext, useState } from 'react';
import { Users, IndianRupee, MapPin, Clock, Check, X } from 'lucide-react';
import { SKILLS } from '../data/mockData';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import Tooltip from './Tooltip';
import { formatSelectedTime, getCurrentLocation } from '../utils/location';

const JobCard = ({ job, onDecline }) => {
  const { acceptJob, requireProfile, realLocation, setRealLocation, userProfile, pushScreen, setTaskerActivityScrollTarget } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

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

  const handleAcceptJob = () => {
    requireProfile(async () => {
      // 1. Check UPI ID first
      if (!userProfile?.upiId) {
        showToast('Please add your UPI ID to receive payments.', 'error');
        setTaskerActivityScrollTarget('upi');
        pushScreen('tasker_activity');
        return;
      }

      // 2. Check GPS Location next
      if (!realLocation) {
        try {
          const loc = await getCurrentLocation();
          setRealLocation(loc);
          // Location successfully obtained, proceed to accept the job
          acceptJob(job.id);
        } catch(err) {
          showToast('GPS location is required to accept jobs. Please enable it.', 'error');
        }
      } else {
        // 3. Location already present, accept the job
        acceptJob(job.id);
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-border flex flex-col space-y-3.5 hover:shadow-md transition-shadow">
      {/* Header Info */}
      <div className="flex items-start space-x-3">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 text-left">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded-full mb-1">
            {skill ? skill.label : 'General'}
          </span>
          <p className="text-sm font-semibold text-dark leading-snug line-clamp-2">
            {job.description}
          </p>
          {job.address?.completeAddress && (
            <div className="flex items-start mt-1.5 space-x-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-[11px] font-bold text-gray-500 leading-snug">
                {job.address.completeAddress}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-border text-[11px] font-bold text-gray-500">
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
          {realLocation ? (
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
            className="w-full flex items-center justify-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
        </Tooltip>
        
        <Tooltip text="Accept job and get details" className="flex-1">
          <button
            onClick={handleAcceptJob}
            className="w-full flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary/95 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs shadow-primary/30 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default JobCard;
