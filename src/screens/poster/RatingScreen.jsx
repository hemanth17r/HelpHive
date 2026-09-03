import React, { useState, useContext, useEffect } from 'react';
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
  const [localCrew, setLocalCrew] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (currentPostedJob?.id) {
      api.fetchJobCrew(currentPostedJob.id).then(({ data }) => {
        if (data && isMounted) setLocalCrew(data);
      });
    } else if (crewTaskers && crewTaskers.length > 0) {
      setLocalCrew(crewTaskers);
    }
    return () => {
      isMounted = false;
    };
  }, [crewTaskers, currentPostedJob]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // The actual crew taskers
  const taskersList = localCrew;

  const taskerBadges = [
    { id: 'reliable', label: 'Apex Operator', icon: Check, color: 'green' },
    { id: 'on_time', label: 'Zero-Lag Execution', icon: Award, color: 'blue' },
    { id: 'professional', label: 'Master Tactician', icon: Star, color: 'purple' }
  ];

  const getBadgeStyle = (color, isSelected) => {
    if (!isSelected) return 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50';
    switch (color) {
      case 'green': return 'bg-green-50 border-green-300 text-green-700 shadow-xs';
      case 'blue': return 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs';
      case 'purple': return 'bg-purple-50 border-purple-300 text-purple-700 shadow-xs';
      default: return 'bg-gray-50 border-gray-300 text-gray-700 shadow-xs';
    }
  };

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
        const badge = badges[tasker.id] || null;

        // Persist rating in database with correct arguments
        const { error: dbError } = await api.submitUserRating(currentPostedJob.id, 'poster', tasker.id, star, badge, userProfile?.id);
        if (dbError) {
          console.error("Failed to submit rating in DB:", dbError);
          showToast(`Failed to submit rating for ${tasker.name}: ${dbError.message || dbError}`, 'error');
          throw dbError;
        }

        trackEvent(EVENTS.RATING_SUBMITTED, { userId: userProfile?.id, role, entityId: tasker.id, metadata: { rating: star } });
        if (badge) {
          badgeGiven = true;
          const badgeObj = taskerBadges.find(b => b.id === badge);
          trackEvent(EVENTS.BADGE_SENT, { userId: userProfile?.id, role, entityId: tasker.id, metadata: { badge_type: badge } });
          showToast(`🏅 ${tasker.name} was awarded your "${badgeObj?.label}" badge!`, 'success');

          // Send notification to the Tasker
          await api.sendNotification(
            tasker.id,
            "New Combat Badge Earned! 🏅",
            `You received a ${star}-star rating and the "${badgeObj?.label}" commendation badge for your recent contract!`,
            'my_profile',
            'badge_received',
            'tasker'
          );
        } else {
          // Send rating-only notification to the Tasker
          await api.sendNotification(
            tasker.id,
            "Contract Street Cred Awarded!",
            `You received a ${star}-star Street Cred rating for your recent contract.`,
            'tasker_activity',
            'rating_received',
            'tasker'
          );
        }
      });
      await Promise.all(promises);

      if (!badgeGiven) {
        showToast('Commendation submitted!', 'success');
      }

      pushScreen('poster_home');
    } catch (err) {
      console.error("Error submitting rating:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 overflow-y-auto select-none min-h-0">
      {/* Header */}
      <div className="relative w-full h-8 shrink-0">
        <button onClick={() => popScreen()} className="absolute left-0 top-0 p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Form Screen */}
      <div className="flex-1 overflow-y-auto space-y-5 mt-3 mb-6 lg:px-8 w-full pr-1">
        {taskersList.map((tasker) => {
          const currentRating = ratings[tasker.id] || 5; // Default 5 stars
          const currentBadge = badges[tasker.id] || '';

          return (
            <div key={tasker.id} className="bg-gray-50 border border-border rounded-2xl p-4 flex flex-col items-center space-y-3.5">
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
                    <Tooltip key={star} text={`Award ${star} Star Cred`}>
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
              <div className="w-full">
                <div className="flex flex-wrap justify-center gap-2">
                  {taskerBadges.map((badge) => {
                    const Icon = badge.icon;
                    const isSelected = currentBadge === badge.id;
                    return (
                      <button
                        key={badge.id}
                        onClick={() => handleBadgeChange(tasker.id, badge.id)}
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
          );
        })}
      </div>

      <div className="w-full pt-4 border-t border-border shrink-0 lg:px-8 flex justify-center">
        <Tooltip text="Submit operator commendations">
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
            <span>{isSubmitting ? 'Submitting...' : 'Submit Commendation'}</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default RatingScreen;
