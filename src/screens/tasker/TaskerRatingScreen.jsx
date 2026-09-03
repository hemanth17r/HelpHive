import React, { useState, useContext } from 'react';
import { Star, Send, Check, Flag, Award, AlertTriangle, ShieldAlert, ArrowLeft } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';
import { trackEvent, EVENTS } from '../../utils/eventTracker';
import { api } from '../../services/api';

const TaskerRatingScreen = () => {
  const { acceptedJob, setAcceptedJob, pushScreen, popScreen, userProfile, role } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  const [rating, setRating] = useState(5);
  const [selectedBadge, setSelectedBadge] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTimerRef = React.useRef(null);

  React.useEffect(() => {
    if (!acceptedJob) {
      pushScreen('tasker_home', true);
    }
  }, [acceptedJob, pushScreen]);

  React.useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const posterBadges = [
    { id: 'paid_promptly', label: 'Instant Bounty Payout', icon: Award, color: 'green' },
    { id: 'clear_instructions', label: 'Flawless Directives', icon: Check, color: 'blue' },
    { id: 'easy_to_work', label: 'Top Op Lead', icon: Star, color: 'orange' }
  ];

  const getBadgeStyle = (color, isSelected) => {
    if (!isSelected) return 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100';
    switch (color) {
      case 'green': return 'bg-green-50 border-green-300 text-green-700 shadow-xs';
      case 'blue': return 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs';
      case 'orange': return 'bg-orange-50 border-orange-300 text-orange-700 shadow-xs';
      default: return 'bg-gray-50 border-gray-300 text-gray-700 shadow-xs';
    }
  };

  const handleSubmit = async () => {
    if (!acceptedJob) return;
    setIsSubmitting(true);
    
    try {
      // Persist rating in database with correct arguments
      const { error: dbError } = await api.submitUserRating(acceptedJob.id, 'tasker', acceptedJob.posterId, rating, selectedBadge || null, userProfile?.id);
      if (dbError) {
        console.error("Failed to submit rating in DB:", dbError);
        showToast(`Failed to submit rating: ${dbError.message || dbError}`, 'error');
        setIsSubmitting(false);
        return;
      }

      trackEvent(EVENTS.RATING_SUBMITTED, { userId: userProfile?.id, role, entityId: acceptedJob?.posterId, metadata: { rating } });
      
      const badgeObj = selectedBadge ? posterBadges.find(b => b.id === selectedBadge) : null;
      const notificationText = badgeObj 
        ? `An Operative awarded you ${rating} stars and the "${badgeObj.label}" commendation!`
        : `An Operative awarded you ${rating} stars for the recent contract.`;

      if (acceptedJob?.posterId) {
        await api.sendNotification(
          acceptedJob.posterId,
          "New Commendation Received!",
          notificationText,
          'my_profile',
          selectedBadge ? 'badge_received' : 'rating_received',
          'poster'
        );
      }

      if (selectedBadge) {
        trackEvent(EVENTS.BADGE_SENT, { userId: userProfile?.id, role, entityId: acceptedJob?.posterId, metadata: { badge_type: selectedBadge } });
        showToast(`🏅 Op Lead received your "${badgeObj?.label}" commendation!`, 'success');
      } else {
        showToast('Commendation submitted!', 'success');
      }

      setIsSubmitted(true);
      redirectTimerRef.current = setTimeout(() => {
        setAcceptedJob(null);
        pushScreen('tasker_home', true);
      }, 1800);
    } catch (err) {
      console.error("Error submitting rating:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 overflow-y-auto select-none">
      {/* Header */}
      <div className="relative w-full h-8 shrink-0">
        <button onClick={() => popScreen()} className="absolute left-0 top-0 p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {isSubmitted ? (
        /* Success Screen */
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 my-6">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-200 shadow-md">
            <Check className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-black text-dark">Commendation Logged!</h3>
          <p className="text-xs font-semibold text-gray-400 max-w-[220px]">
            Your rating updates Fixer Street Cred on the open-world network.
          </p>
        </div>
      ) : (
        /* Form Screen */
        <div className="flex-1 flex flex-col items-center text-center space-y-5 mt-3 mb-6 lg:px-8 w-full">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 shadow-xs overflow-hidden bg-orange-50 flex items-center justify-center">
              <BirdAvatar birdName={acceptedJob?.posterBird || 'robin'} size={56} />
            </div>
            <h3 className="text-sm font-black text-dark">{acceptedJob?.posterName || 'Fixer'}</h3>
          </div>

          {/* Interactive Stars */}
          <div className="space-y-1.5 w-full">
            <div className="flex justify-center space-x-3.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Tooltip key={star} text={`Award ${star} Star Cred`}>
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
          <div className="w-full">
            <div className="flex flex-wrap justify-center gap-2">
              {posterBadges.map((badge) => {
                const Icon = badge.icon;
                const isSelected = selectedBadge === badge.id;
                return (
                  <button
                    key={badge.id}
                    onClick={() => setSelectedBadge(isSelected ? '' : badge.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${getBadgeStyle(badge.color, isSelected)}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button Footer */}
      {!isSubmitted && (
        <div className="w-full pt-4 border-t border-border shrink-0 lg:px-8 flex justify-center">
          <Tooltip text="Submit Fixer Cred commendation">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full max-w-md flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>{isSubmitting ? 'Submitting...' : 'Submit Fixer Cred'}</span>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default TaskerRatingScreen;
