import React, { useState, useContext } from 'react';
import { Star, Send, Check, Flag, Award, AlertTriangle, ArrowLeft } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { trackEvent, EVENTS } from '../../utils/eventTracker';
import { api } from '../../services/api';

const RatingScreen = () => {
  const { crewTaskers, pushScreen, popScreen, resetApp, userProfile, role, currentPostedJob, setJobs, setCurrentPostedJob } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  // Track ratings and badges per tasker
  const [ratings, setRatings] = useState({});
  const [badges, setBadges] = useState({});


  const [reportingTaskerId, setReportingTaskerId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // The actual crew taskers
  const taskersList = crewTaskers;

  const taskerBadges = [
    { id: 'reliable', label: 'Reliable Helper', icon: Check, color: 'green' },
    { id: 'on_time', label: 'On Time', icon: Award, color: 'blue' },
    { id: 'professional', label: 'Professional', icon: Star, color: 'purple' }
  ];

  const reportReasons = [
    'Did not show up',
    'Unsafe or Inappropriate',
    'Poor Quality Work',
    'Other'
  ];

  const handleRatingChange = (taskId, star) => {
    setRatings(prev => ({ ...prev, [taskId]: star }));
  };

  const handleBadgeChange = (taskId, badgeId) => {
    setBadges(prev => {
      const currentBadge = prev[taskId];
      return { ...prev, [taskId]: currentBadge === badgeId ? '' : badgeId };
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Mark job as rated in global state so it doesn't prompt again
      if (currentPostedJob) {
        setJobs(prev => prev.map(j => j.id === currentPostedJob.id ? { ...j, hasBeenRated: true } : j));
        setCurrentPostedJob(prev => prev ? { ...prev, hasBeenRated: true } : null);
      }
      
      // Log ratings and badges, and send badge notifications
      let badgeGiven = false;
      const promises = taskersList.map(async (tasker) => {
        const star = ratings[tasker.id] || 5;
        const badge = badges[tasker.id];
        trackEvent(EVENTS.RATING_SUBMITTED, { userId: userProfile?.id, role, entityId: tasker.id, metadata: { rating: star } });
        if (badge) {
          badgeGiven = true;
          const badgeObj = taskerBadges.find(b => b.id === badge);
          trackEvent(EVENTS.BADGE_SENT, { userId: userProfile?.id, role, entityId: tasker.id, metadata: { badge_type: badge } });
          showToast(`🏅 ${tasker.name} will receive your "${badgeObj?.label}" badge!`, 'success');

          // Send notification to the Tasker
          await api.sendNotification(
            tasker.id,
            "New Badge Earned! 🏅",
            `You received a ${star}-star rating and the "${badgeObj?.label}" badge for your recent task!`,
            'my_profile',
            'badge_received',
            'tasker'
          );
        } else {
          // Send rating-only notification to the Tasker
          await api.sendNotification(
            tasker.id,
            "Task Rated!",
            `You received a ${star}-star rating for your recent task.`,
            'tasker_activity',
            'rating_received',
            'tasker'
          );
        }
      });
      await Promise.all(promises);

      if (!badgeGiven) {
        showToast('Rating submitted!', 'success');
      }

      pushScreen('poster_home');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      showToast('Please select a reason', 'error');
      return;
    }
    setIsReporting(true);
    try {
      showToast('Report submitted for moderation', 'success');
      trackEvent(EVENTS.REPORT_SUBMITTED, { userId: userProfile?.id, role, entityId: reportingTaskerId, metadata: { reason: reportReason } });
      
      // Artificial small delay for UX if trackEvent is synchronous
      await new Promise(res => setTimeout(res, 400));
      
      setReportingTaskerId(null);
      setReportReason('');
      setReportDetails('');
    } finally {
      setIsReporting(false);
    }
  };

  const reportingTasker = taskersList.find(t => t.id === reportingTaskerId);

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 overflow-y-auto select-none min-h-0">
      {/* Header */}
      <div className="flex flex-col items-center pb-3 border-b border-border shrink-0 relative">
        <button onClick={() => popScreen()} className="absolute left-0 top-0 p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-extrabold text-dark mt-2">How was your experience?</h2>
      </div>

      {reportingTaskerId ? (
        /* Report Screen */
        <div className="flex-1 flex flex-col space-y-5 my-6 lg:px-8 w-full text-left">
          <div className="flex items-center space-x-2 text-red-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-black text-dark">Report {reportingTasker?.name || 'Tasker'}</h3>
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
              onClick={() => setReportingTaskerId(null)}
              className="flex-1 py-3 text-xs font-bold text-gray-500 border border-border rounded-xl hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleReportSubmit}
              disabled={isReporting}
              className="flex-1 flex justify-center items-center gap-2 py-3 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-md cursor-pointer transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isReporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : null}
              <span>{isReporting ? 'Submitting...' : 'Submit Report'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Form Screen */
        <div className="flex-1 overflow-y-auto space-y-6 my-4 lg:px-8 w-full pr-1">
          {taskersList.map((tasker) => {
            const currentRating = ratings[tasker.id] || 5; // Default 5 stars
            const currentBadge = badges[tasker.id] || '';

            return (
              <div key={tasker.id} className="bg-gray-50 border border-border rounded-2xl p-4 flex flex-col items-center space-y-4">
                {/* Helper Avatar Info */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/20 shadow-xs overflow-hidden bg-orange-50 flex items-center justify-center">
                    <BirdAvatar birdName={tasker.bird || 'falcon'} size={56} />
                  </div>
                  <h3 className="text-sm font-black text-dark">{tasker.name}</h3>
                </div>

                {/* Interactive Stars */}
                <div className="space-y-1.5 w-full text-center">
                  <div className="flex justify-center space-x-2 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Tooltip key={star} text={`Rate ${star} Stars`}>
                        <button
                          onClick={() => handleRatingChange(tasker.id, star)}
                          className="cursor-pointer transition-transform hover:scale-125 focus:outline-hidden"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= currentRating
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
                <div className="space-y-3 w-full text-left pt-2 border-t border-gray-200">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 text-center">
                    Give a Trust Badge (Optional)
                  </label>
                  <div className="flex flex-wrap justify-center gap-2">
                    {taskerBadges.map((badge) => {
                      const Icon = badge.icon;
                      const isSelected = currentBadge === badge.id;
                      return (
                        <button
                          key={badge.id}
                          onClick={() => handleBadgeChange(tasker.id, badge.id)}
                          className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                            isSelected
                              ? `bg-${badge.color}-50 border-${badge.color}-300 text-${badge.color}-700 shadow-xs`
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
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
                <div className="w-full pt-3">
                   <button 
                      onClick={() => setReportingTaskerId(tasker.id)}
                      className="flex items-center justify-center space-x-1.5 mx-auto text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                   >
                      <Flag className="w-3 h-3" />
                      <span className="uppercase tracking-wider">Report Issue Privately</span>
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!reportingTaskerId && (
        <div className="w-full pt-4 border-t border-border shrink-0 lg:px-8">
          <Tooltip text="Submit helper feedback">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default RatingScreen;
