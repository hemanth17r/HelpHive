import React, { useState, useContext } from 'react';
import { Star, Send, Check, Flag, Award, AlertTriangle, ShieldAlert, ArrowLeft } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { trackEvent, EVENTS } from '../../utils/eventTracker';

const TaskerRatingScreen = () => {
  const { acceptedJob, setAcceptedJob, pushScreen, popScreen, userProfile, role } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  const [rating, setRating] = useState(5);
  const [selectedBadge, setSelectedBadge] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const posterBadges = [
    { id: 'paid_promptly', label: 'Paid Promptly', icon: Award, color: 'green' },
    { id: 'clear_instructions', label: 'Clear Instructions', icon: Check, color: 'blue' },
    { id: 'easy_to_work', label: 'Easy to Work With', icon: Star, color: 'orange' }
  ];

  const reportReasons = [
    'Unsafe Environment',
    'Rude or Unprofessional',
    'Payment Issue',
    'Other'
  ];

  const handleSubmit = () => {
    setIsSubmitted(true);
    
    trackEvent(EVENTS.RATING_SUBMITTED, { userId: userProfile?.id, role, entityId: acceptedJob?.posterId, metadata: { rating } });
    if (selectedBadge) {
      const badgeObj = posterBadges.find(b => b.id === selectedBadge);
      trackEvent(EVENTS.BADGE_SENT, { userId: userProfile?.id, role, entityId: acceptedJob?.posterId, metadata: { badge_type: selectedBadge } });
      showToast(`🏅 ${acceptedJob?.posterName || 'Hirer'} will receive your "${badgeObj?.label}" badge!`, 'success');


    } else {
      showToast('Rating submitted!', 'success');
    }

    setTimeout(() => {
      setAcceptedJob(null);
      pushScreen('tasker_home');
    }, 1800);
  };

  const handleReportSubmit = () => {
    if (!reportReason) {
      showToast('Please select a reason', 'error');
      return;
    }
    showToast('Report submitted for moderation', 'success');
    trackEvent(EVENTS.REPORT_SUBMITTED, { userId: userProfile?.id, role, entityId: acceptedJob?.posterId, metadata: { reason: reportReason } });
    setIsReporting(false);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex flex-col items-center pb-3 border-b border-border shrink-0 relative">
        <button onClick={() => popScreen()} className="absolute left-0 top-0 p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-extrabold text-dark mt-2">Rate the Hirer</h2>
      </div>

      {isSubmitted ? (
        /* Success Screen */
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 my-6">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-200 shadow-md">
            <Check className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-lg font-black text-dark">Thank You!</h3>
          <p className="text-xs font-semibold text-gray-400 max-w-[200px]">
            Your rating helps build trust in our community.
          </p>
        </div>
      ) : isReporting ? (
        /* Report Screen */
        <div className="flex-1 flex flex-col space-y-5 my-6 lg:px-8 w-full text-left">
          <div className="flex items-center space-x-2 text-red-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-black text-dark">Report {acceptedJob?.posterName || 'Hirer'}</h3>
          </div>
          <p className="text-xs font-bold text-gray-500">
            This report will be sent securely to admin moderation. It will not be shown publicly.
          </p>

          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
              Reason for reporting
            </label>
            <div className="flex flex-col space-y-2">
              {reportReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    reportReason === reason 
                      ? 'border-red-500 bg-red-50 text-red-700' 
                      : 'border-border bg-gray-50 text-dark hover:bg-gray-100'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
              Private Details (Optional)
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Provide more details for moderators..."
              className="w-full bg-gray-50 border border-border focus:border-red-500 rounded-xl px-4 py-3 text-xs font-semibold outline-hidden min-h-[80px]"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setIsReporting(false)}
              className="flex-1 py-3 text-xs font-bold text-gray-500 border border-border rounded-xl hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleReportSubmit}
              className="flex-1 py-3 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-md cursor-pointer"
            >
              Submit Report
            </button>
          </div>
        </div>
      ) : (
        /* Form Screen */
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 my-6 lg:px-8 w-full">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 shadow-xs overflow-hidden bg-orange-50 flex items-center justify-center">
              <BirdAvatar birdName={acceptedJob?.posterBird || 'robin'} size={56} />
            </div>
            <h3 className="text-sm font-black text-dark">{acceptedJob?.posterName || 'Hirer'}</h3>
          </div>

          {/* Interactive Stars */}
          <div className="space-y-1.5 w-full">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
              Select Rating
            </label>
            <div className="flex justify-center space-x-3.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Tooltip key={star} text={`Rate ${star} Stars`}>
                  <button
                    onClick={() => setRating(star)}
                    className="cursor-pointer transition-transform hover:scale-125 focus:outline-hidden"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating
                          ? 'fill-primary text-primary'
                          : 'text-gray-200'
                      }`}
                    />
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Badge Selection */}
          <div className="space-y-3 w-full text-left pt-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 text-center">
              Give a Trust Badge (Optional)
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {posterBadges.map((badge) => {
                const Icon = badge.icon;
                const isSelected = selectedBadge === badge.id;
                return (
                  <button
                    key={badge.id}
                    onClick={() => setSelectedBadge(isSelected ? '' : badge.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      isSelected
                        ? `bg-${badge.color}-50 border-${badge.color}-300 text-${badge.color}-700 shadow-xs`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report Button */}
          <div className="w-full pt-4">
             <button 
                onClick={() => setIsReporting(true)}
                className="flex items-center justify-center space-x-1.5 mx-auto text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
             >
                <Flag className="w-3 h-3" />
                <span className="uppercase tracking-wider">Report Issue Privately</span>
             </button>
          </div>
        </div>
      )}

      {/* Submit Button Footer */}
      {!isSubmitted && !isReporting && (
        <div className="w-full pt-4 border-t border-border shrink-0 lg:px-8">
          <Tooltip text="Submit feedback">
            <button
              onClick={handleSubmit}
              className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span>Submit Review</span>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default TaskerRatingScreen;
