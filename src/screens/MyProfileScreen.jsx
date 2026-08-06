import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Star, ShieldAlert, Shield, Lock, Award, Calendar, ArrowLeft, LogOut, LogIn, Clock, User, Phone, Mail, Edit2, ChevronRight, Briefcase, HelpCircle, Check, X, PlusCircle, MapPin, CheckCircle2, ChevronDown, ExternalLink, Wifi, Flame, Zap, Copy, Gift, DollarSign, ArrowUpRight } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { api } from '../services/api';
import { SKILLS } from '../config/constants';
import Tooltip from '../components/Tooltip';
import BirdAvatar from '../components/BirdAvatars';
import BirdSelector from '../components/BirdSelector';
import IconLabel from '../components/IconLabel';
import { ToastContext } from '../store/ToastContext';
import LoginModal from '../components/LoginModal';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const BADGE_LABELS = {
  paid_promptly: 'Paid Promptly',
  clear_instructions: 'Clear Instructions',
  easy_to_work: 'Easy to Work With',
  reliable: 'Reliable Helper',
  on_time: 'On Time',
  professional: 'Professional'
};

const MyProfileScreen = () => {
  const { userProfile, userId, userLocation, resetApp, selectedBird, setSelectedBird, role, setUserProfile, pushScreen, popScreen, setActiveTab, switchRole, setJobHistoryTab, setTaskerActivityScrollTarget, jobs, isAdmin, refreshProfile, screenStack, openLoginModal } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const { completionPercentage, missingItems, missingWizardItems } = useProfileCompletion();

  useEffect(() => {
    if (refreshProfile) {
      refreshProfile();
    }
  }, []);

  const handleWhatsAppSupport = () => {
    const rawId = userProfile?.id || userId || '';
    const displayId = rawId ? (rawId.length > 10 ? `#${rawId.slice(-10).toUpperCase()}` : rawId) : 'N/A';
    const name = userProfile?.name || 'N/A';
    
    const message = `Hi HelpHive Support,

I need help.

User ID: ${displayId}
Name: ${name}

Issue: `;

    const whatsappUrl = `https://wa.me/919347442426?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  const [showBirdSelector, setShowBirdSelector] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [editedSkills, setEditedSkills] = useState([]);
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isAhrOpen, setIsAhrOpen] = useState(false);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Referral & Commission State
  const [referralSummary, setReferralSummary] = useState({ rewards: [], payouts: [], referredUsers: [] });
  const [commissionPayments, setCommissionPayments] = useState([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [hasClickedPayDues, setHasClickedPayDues] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [withdrawUpiId, setWithdrawUpiId] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  useEffect(() => {
    if (userId) {
      try {
        const clicked = localStorage.getItem(`helphive_pay_dues_clicked_${userId}`);
        if (clicked === 'true') {
          setHasClickedPayDues(true);
        }
      } catch (e) {
        // ignore localStorage errors
      }
    }
  }, [userId]);

  const fetchReferralAndCommissionData = useCallback(async () => {
    if (!userId) return;
    const summary = await api.fetchReferralSummary(userId);
    setReferralSummary({ rewards: summary.rewards || [], payouts: summary.payouts || [], referredUsers: summary.referredUsers || [] });
    const { data: comms } = await api.fetchTaskerCommissionPayments(userId);
    if (comms) setCommissionPayments(comms);
  }, [userId]);

  useEffect(() => {
    fetchReferralAndCommissionData();
  }, [fetchReferralAndCommissionData]);

  const [recentlyApprovedPayment, setRecentlyApprovedPayment] = useState(null);

  useEffect(() => {
    const found = (commissionPayments || []).find(p => {
      if (p.status !== 'approved') return false;
      const approvedTime = new Date(p.updated_at || p.created_at).getTime();
      return (Date.now() - approvedTime) < (24 * 60 * 60 * 1000);
    });
    setRecentlyApprovedPayment(found || null);
  }, [commissionPayments]);

  const groupedCommissionHistory = useMemo(() => {
    const groups = {};
    (commissionPayments || []).forEach(p => {
      const date = new Date(p.created_at);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(p);
    });
    return groups;
  }, [commissionPayments]);

  // Derived Referral Metrics
  const totalReferralEarnings = useMemo(() => {
    return (referralSummary.rewards || []).reduce((sum, r) => sum + (parseFloat(r.reward_amount) || 0), 0);
  }, [referralSummary.rewards]);

  const totalPayoutsClaimed = useMemo(() => {
    return (referralSummary.payouts || [])
      .filter(p => p.status === 'pending_payout' || p.status === 'paid')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [referralSummary.payouts]);

  const availableReferralBalance = useMemo(() => {
    return Math.max(0, totalReferralEarnings - totalPayoutsClaimed);
  }, [totalReferralEarnings, totalPayoutsClaimed]);

  const totalReferralsCount = useMemo(() => {
    return (referralSummary.referredUsers || []).length;
  }, [referralSummary.referredUsers]);

  const friendProgressList = useMemo(() => {
    const map = {};
    (referralSummary.referredUsers || []).forEach(u => {
      map[u.id] = { id: u.id, name: u.name || 'Friend', phone: u.phone, totalEarned: 0, count: 0 };
    });
    (referralSummary.rewards || []).forEach(r => {
      const uid = r.referred_user_id;
      if (!map[uid]) {
        const uObj = r.referred_user || {};
        map[uid] = { id: uid, name: uObj.name || 'Friend', phone: uObj.phone, totalEarned: 0, count: 0 };
      }
      map[uid].totalEarned += (parseFloat(r.reward_amount) || 0);
      map[uid].count += 1;
    });
    return Object.values(map);
  }, [referralSummary.referredUsers, referralSummary.rewards]);

  // Tasker Commission & Credit Rules
  const handleWhatsAppShare = () => {
    const doShare = () => {
      const activeId = userProfile?.id || userId;
      const shortRef = activeId ? (activeId.includes('-') ? activeId.split('-')[0] : activeId) : '';
      const inviteLink = `${window.location.origin}/?ref=${shortRef}`;
      const msg = `💰 Discover a new way to earn.\n\n${inviteLink}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };
    if (!userId) {
      if (openLoginModal) {
        openLoginModal(() => doShare());
      } else {
        setShowLoginModal(true);
      }
    } else {
      doShare();
    }
  };

  const pendingCommissionVerification = (commissionPayments || []).find(p => p.status === 'pending_verification');
  const taskerDues = userProfile?.unpaidCommissionDues || 0;
  const taskerCreditLimit = 200;

  const handleCommissionPaymentSubmit = async () => {
    const amountToPay = taskerDues > 0 ? taskerDues : 50;
    if (!amountToPay || amountToPay <= 0) {
      showToast('No outstanding dues to pay', 'info');
      return;
    }
    setIsSubmittingPayment(true);
    const { error } = await api.submitCommissionPayment(userId, amountToPay);
    setIsSubmittingPayment(false);
    if (!error) {
      setHasClickedPayDues(false);
      try {
        localStorage.removeItem(`helphive_pay_dues_clicked_${userId}`);
      } catch (e) {
        // ignore localStorage errors
      }
      showToast('Payment submitted! Verification under progress.', 'success');
      fetchReferralAndCommissionData();
    } else {
      showToast('Failed to submit payment. Try again.', 'error');
    }
  };

  const handleWithdrawalSubmit = async () => {
    const trimmedUpi = withdrawUpiId.trim();
    if (!trimmedUpi || !trimmedUpi.includes('@')) {
      showToast('Please enter a valid UPI ID (e.g. name@okaxis)', 'error');
      return;
    }
    if (availableReferralBalance < 100) {
      showToast('Minimum withdrawal amount is ₹100', 'error');
      return;
    }
    setIsSubmittingWithdrawal(true);
    const { error } = await api.requestReferralPayout(userId, availableReferralBalance, trimmedUpi);
    setIsSubmittingWithdrawal(false);
    if (!error) {
      setShowWithdrawModal(false);
      showToast('Withdrawal request submitted! Admin will transfer funds soon.', 'success');
      fetchReferralAndCommissionData();
    } else {
      showToast(error.message || 'Failed to submit withdrawal request', 'error');
    }
  };

  
  // Hirer (Poster) Stats
  const posterJobs = useMemo(() => {
    return jobs?.filter(j => j?.posterId === userId || j?.posterId === userProfile?.id) || [];
  }, [jobs, userId, userProfile?.id]);

  const activePosterJobs = useMemo(() => {
    return posterJobs.filter(j => ['open', 'in_progress', 'active'].includes(j?.status)).length;
  }, [posterJobs]);

  const completedPosterJobsCount = useMemo(() => {
    return posterJobs.filter(j => j?.status === 'completed').length;
  }, [posterJobs]);

  // Tasker Stats
  const taskerJobs = useMemo(() => {
    return jobs?.filter(j => j?.isAcceptedByMe || j?.taskerId === userId || j?.taskerId === userProfile?.id || j?.taskerName === userProfile?.name) || [];
  }, [jobs, userId, userProfile?.id, userProfile?.name]);

  const activeTaskerJobs = useMemo(() => {
    return taskerJobs.filter(j => ['active', 'in_progress'].includes(j?.status) && !j?.completedByMe).length;
  }, [taskerJobs]);

  const completedJobs = useMemo(() => {
    return taskerJobs.filter(j => j?.status === 'completed' || j?.completedByMe);
  }, [taskerJobs]);

  const completedTaskerJobsCount = useMemo(() => {
    return completedJobs.length;
  }, [completedJobs]);

  const thisMonthEarnings = useMemo(() => {
    return completedJobs.filter(j => {
      if (!j.timePosted) return false;
      const jobDate = new Date(j.timePosted);
      return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
    }).reduce((sum, job) => sum + (job.amount || 0), 0);
  }, [completedJobs, currentMonth, currentYear]);

  const [shouldRenderSkillsModal, setShouldRenderSkillsModal] = useState(false);
  const [isAnimatingSkillsOut, setIsAnimatingSkillsOut] = useState(false);

  useEffect(() => {
    if (isEditingSkills) {
      setShouldRenderSkillsModal(true);
      setIsAnimatingSkillsOut(false);
    } else {
      if (shouldRenderSkillsModal) {
        setIsAnimatingSkillsOut(true);
        const timer = setTimeout(() => {
          setShouldRenderSkillsModal(false);
          setIsAnimatingSkillsOut(false);
        }, 200); // match closing transition duration
        return () => clearTimeout(timer);
      }
    }
  }, [isEditingSkills, shouldRenderSkillsModal]);



  // Fallback profile
  const profile = {
    ...userProfile,
    name: userId ? (userProfile?.name || 'New User') : 'Guest User',
    email: userId ? ((userProfile?.email && userProfile.email !== 'Add Email') ? userProfile.email : '') : 'Not Linked (Guest Mode)',
    phone: userId ? (userProfile?.phone || 'Add Phone') : 'Not Linked (Guest Mode)',
    skills: userProfile?.skills || [],
    rating: userId ? (userProfile?.rating || 0) : 0,
    tasksCompleted: userId ? (userProfile?.tasksCompleted || 0) : 0,
    badges: userId ? (userProfile?.badges || []) : [],
    reviews: userId ? (userProfile?.reviews || []) : []
  };

  const groupedBadges = React.useMemo(() => {
    if (!Array.isArray(profile.badges)) return [];
    const counts = {};
    profile.badges.forEach(badge => {
      counts[badge] = (counts[badge] || 0) + 1;
    });
    return Object.entries(counts).map(([badge, count]) => ({ badge, count }));
  }, [profile.badges]);

  const reviews = profile.reviews || [];
  const totalReviews = reviews.length;
  const ratingDistribution = {
    5: reviews.filter(r => r === 5).length,
    4: reviews.filter(r => r === 4).length,
    3: reviews.filter(r => r === 3).length,
    2: reviews.filter(r => r === 2).length,
    1: reviews.filter(r => r === 1).length
  };
  const averageRating = totalReviews > 0
    ? (reviews.reduce((sum, val) => sum + val, 0) / totalReviews).toFixed(1)
    : '0.0';

  const hasNormalBadge = profile.badges && profile.badges.length > 0;
  const hasFiveStarRating = ratingDistribution[5] && ratingDistribution[5] > 0;
  const showVerifiedLocal = hasNormalBadge || hasFiveStarRating;

  const handleLogout = () => {
    resetApp();
    showToast('Logged out successfully', 'success');
  };

  const formatPhone = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const formattedPhoneNumber = formatPhone(e.target.value);
    setEditedPhone(formattedPhoneNumber);
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    const updates = {};
    const finalName = editedName.trim();
    const finalPhone = editedPhone.trim();

    if (finalName !== profile.name) {
      updates.name = finalName;
    }
    const normalizedPhone = finalPhone.replace(/\D/g, '');
    const normalizedProfilePhone = (profile.phone || '').replace(/\D/g, '');
    if (normalizedPhone !== normalizedProfilePhone) {
      updates.phone = normalizedPhone;
    }
    
    if (Object.keys(updates).length > 0) {
      setIsSavingAccount(true);
      try {
        await setUserProfile({ ...profile, ...updates });
        showToast('Account details updated successfully!', 'success');
      } finally {
        setIsSavingAccount(false);
      }
    }
    setIsEditingAccount(false);
  };

  const phoneDigits = editedPhone.replace(/\D/g, '');
  const isPhoneValidLength = phoneDigits.length === 10;
  const canSave = editedName.trim().length > 0 && isPhoneValidLength;

  return (
    <div className="flex-1 flex flex-col bg-white h-full w-full overflow-y-auto no-scrollbar relative pb-20">
      {/* Top Banner Area */}
      <div className="relative h-28 shrink-0 z-10">
        {/* Back Button */}
        <button
          onClick={() => {
            // If the profile screen was pushed onto the stack (e.g. navigated from
            // notifications), use popScreen so the back button returns to the
            // previous screen. Only switch to the home tab when we're already at
            // the root (stack length ≤ 1), which is the normal tab-based flow.
            if (role === 'tasker' && screenStack.length <= 1) {
              setActiveTab('home');
            } else {
              popScreen();
            }
          }}
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200/50 text-dark cursor-pointer transition-colors lg:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {role === 'poster' ? (
        <div className="space-y-4 px-6 -mt-12 relative z-10 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left pb-10">
          {/* Header Section */}
          <div className="m3-card rounded-[24px] p-6 flex flex-col items-center text-center">
            <Tooltip text="Tap to change avatar" position="top">
              <button 
                onClick={() => setShowBirdSelector(true)}
                className="w-[88px] h-[88px] rounded-full -mt-16 mb-3 flex items-center justify-center cursor-pointer hover:scale-105 transition-all active:scale-95 p-[2px]"
                style={{ background: `conic-gradient(#FF6B35 ${completionPercentage}%, #e5e7eb ${completionPercentage}%)` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-[2px] border-white shadow-md">
                  <BirdAvatar birdName={selectedBird} size={64} />
                </div>
              </button>
            </Tooltip>
            
            <div className="flex flex-col items-center w-full">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-2 flex items-center gap-1">
                Hirer
              </span>
              <h2 className="text-xl font-bold text-dark leading-tight">{profile.name}</h2>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="m3-card rounded-[24px] p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500">Account details</h3>
              {!isEditingAccount ? (
                <Tooltip text="Edit account details" position="left">
                  <button 
                    onClick={() => { 
                      setEditedName(profile.name === 'New User' || profile.name === 'Guest User' ? '' : profile.name); 
                      setEditedPhone((profile.phone === 'Add Phone' || profile.phone === 'Not Linked (Guest Mode)') ? '' : profile.phone); 
                      setIsEditingAccount(true); 
                    }} 
                    className="text-gray-400 hover:text-primary transition-colors p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              ) : (
                <div className="flex items-center space-x-1 shrink-0">
                  <button 
                    onClick={() => { 
                      setIsEditingAccount(false); 
                    }} 
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            
            {isEditingAccount ? (
              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                      placeholder="Enter full name"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="tel"
                        value={editedPhone}
                        onChange={handlePhoneChange}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark transition-colors focus:outline-none focus:border-primary focus:bg-white"
                        placeholder="123-456-7890"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2 opacity-70">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 bg-gray-100/50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 select-none cursor-not-allowed">
                        {profile.email || '\u00A0'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canSave || isSavingAccount}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                      !canSave || isSavingAccount
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 text-white cursor-pointer'
                    }`}
                  >
                    {isSavingAccount ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : null}
                    <span>{isSavingAccount ? 'Saving...' : 'Save Account'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Full name</p>
                      <p className="font-semibold text-dark">{profile.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                    <p className="text-xs font-semibold text-gray-500">Phone number</p>
                    <p className="font-semibold text-dark">{profile.phone}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm pt-1">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500">Email</p>
                      <p className="font-semibold text-dark">{profile.email}</p>
                    </div>
                  </div>
              </>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div 
              onClick={() => { setJobHistoryTab('active'); pushScreen('job_history'); }}
              className="m3-card rounded-[20px] p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl font-bold text-dark">{activePosterJobs}</span>
              <span className="text-xs font-medium text-gray-500 mt-1 text-center">Active tasks</span>
            </div>
            <div 
              onClick={() => { setJobHistoryTab('completed'); pushScreen('job_history'); }}
              className="m3-card rounded-[20px] p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl font-bold text-dark">{completedPosterJobsCount}</span>
              <span className="text-xs font-medium text-gray-500 mt-1 text-center">Completed</span>
            </div>
          </div>

          {/* Reputation Section */}
          <div className="m3-card rounded-[24px] p-6 space-y-6">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500">Reputation</h3>
              {showVerifiedLocal && (
                <div className="flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-lg">
                  <Award className="w-3 h-3" />
                  <span className="text-xs font-medium">Verified hirer</span>
                </div>
              )}
            </div>
            
            {/* Unified Ratings & Reviews Summary Component */}
            <div className="flex items-center space-x-6 py-2">
              {/* Left Side */}
              <div className="flex flex-col items-center justify-center shrink-0 w-24">
                <span className="text-5xl font-black text-dark tracking-tight leading-none">
                  {totalReviews > 0 ? averageRating : '0.0'}
                </span>
                
                {/* Star Rating display */}
                <div className="flex items-center space-x-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const starVal = totalReviews > 0 ? parseFloat(averageRating) : 0;
                    const isFull = star <= Math.floor(starVal);
                    const isHalf = !isFull && star === Math.ceil(starVal) && starVal % 1 >= 0.3;
                    return (
                      <Star 
                        key={star} 
                        className={`w-3.5 h-3.5 ${
                          isFull 
                            ? 'fill-primary text-primary' 
                            : isHalf 
                              ? 'fill-primary/50 text-primary' 
                              : 'text-gray-200'
                        }`} 
                      />
                    );
                  })}
                </div>
                
                <span className="text-xs font-semibold text-gray-500 mt-1.5 text-center">
                  {totalReviews > 0 ? `${totalReviews} ratings` : 'No reviews yet'}
                </span>
              </div>

              {/* Right Side - Distribution Bars */}
              <div className="flex-1 flex flex-col space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = totalReviews > 0 ? (ratingDistribution[star] || 0) : 0;
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center text-[10px] font-bold text-gray-400">
                      <span className="w-6 text-right leading-none shrink-0">{star} ★</span>
                      <div className="h-2 bg-gray-100 rounded-full flex-1 mx-2 overflow-hidden shrink-0">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-6 text-left leading-none shrink-0 text-gray-500">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-dark border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-gray-500">Tasks completed</span>
              <span className="text-base font-bold text-dark">{profile.tasksCompleted}</span>
            </div>

            {/* Trust Badges - Hirer specific */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">Trust badges</h4>
                <div className="flex flex-wrap gap-2">
                  {groupedBadges.map(({ badge, count }, idx) => (
                    <span key={idx} className="text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-200/50 flex items-center space-x-1 shadow-xs">
                      <Award className="w-3 h-3 text-green-600 shrink-0"/>
                      <span>{BADGE_LABELS[badge] || badge}</span>
                      {count > 1 && (
                        <span className="ml-1 bg-green-200/80 text-green-800 text-[8px] px-1.5 py-0.5 rounded-full font-black leading-none min-w-[14px] text-center">
                          {count}x
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refer & Earn Hub Card */}
          <div className="rounded-[24px] p-5 sm:p-6 space-y-4 sm:space-y-5 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 border border-emerald-100/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-dark whitespace-nowrap">Refer & Earn</h3>
                    <span className="sm:hidden text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/50 shrink-0">
                      ₹{totalReferralEarnings.toFixed(2)} Lifetime
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 leading-snug mt-0.5">
                    Earn from friend's first 5 tasks.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 sm:px-2.5 rounded-full border border-emerald-200/50 shrink-0 self-start sm:self-auto">
                ₹{totalReferralEarnings.toFixed(2)} Lifetime
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 py-1 px-1">
              <div>
                <p className="text-xs font-medium text-gray-400">Available</p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight mt-0.5">
                  ₹{availableReferralBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Invited</p>
                <p className="text-2xl font-bold text-dark tracking-tight mt-0.5">
                  {totalReferralsCount}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <div className="grid grid-cols-2 gap-3 items-end">
                <button 
                  onClick={handleWhatsAppShare}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer text-xs shadow-xs min-h-[40px]"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  <span>Share</span>
                </button>

                <div className="w-full flex flex-col items-start">
                  {availableReferralBalance < 100 && (
                    <span className="text-[10px] text-gray-400 font-normal lowercase mb-0.5 pl-3.5">
                      min. ₹100
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setWithdrawUpiId(profile.upiId || '');
                      setShowWithdrawModal(true);
                    }}
                    disabled={availableReferralBalance < 100}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 min-h-[40px] ${
                      availableReferralBalance >= 100 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-[0.98]'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Friends & Progress List */}
            {friendProgressList.length > 0 && (
              <div className="pt-2 border-t border-emerald-100/80 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Your invited friends</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {friendProgressList.map((f, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-dark flex items-center space-x-1.5">
                          <span>👤 {f.name}</span>
                          {f.count >= 5 && (
                            <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-green-200">
                              5/5 Completed 🎉
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-emerald-600 text-[11px]">
                          Total Earned: ₹{f.totalEarned.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                        <span>Progress: {f.count} of 5 tasks completed</span>
                        <span>{f.count < 5 ? `${5 - f.count} tasks remaining` : 'Done'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className="m3-card rounded-[24px] p-2">
            <div className="space-y-0.5">
              <button onClick={() => switchRole('tasker', true)} className="w-full flex items-center justify-between text-left text-sm font-semibold text-primary hover:bg-primary/5 py-2.5 px-3 rounded-xl transition-colors cursor-pointer border border-primary/20 bg-primary/5">
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span>Switch to helper</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>

              <div style={{ height: '13px' }} />

              <button 
                onClick={() => pushScreen('address_book')} 
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>Address book</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {isAdmin && (
                <>
                  <button onClick={() => pushScreen('admin_dashboard')} className="w-full flex items-center justify-between text-left text-sm font-semibold text-gray-800 hover:bg-gray-100 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>Admin dashboard</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                  <div className="h-px bg-gray-100 my-1.5 mx-2"></div>
                </>
              )}

              <button onClick={() => pushScreen('about_us')} className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Star className="w-4 h-4 text-gray-400" />
                  <span>About us</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {userId ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-between text-left text-sm font-semibold text-red-500 hover:bg-red-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sign out</span>
                  </div>
                </button>
              ) : (
                <button onClick={() => openLoginModal()} className="w-full flex items-center justify-between text-left text-sm font-semibold text-primary hover:bg-primary/5 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogIn className="w-4 h-4 text-primary" />
                    <span>Sign in / sign up</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </button>
              )}

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              <div className="px-3 py-0.5 text-left">
                <span className="text-xs font-semibold text-gray-500">Need help?</span>
              </div>

              <button onClick={handleWhatsAppSupport} className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <WhatsAppIcon className="w-4 h-4 text-green-600 shrink-0" />
                  <span>WhatsApp support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {/* Also from ahr dropdown section merged inside card */}
              <button 
                onClick={() => setIsAhrOpen(!isAhrOpen)} 
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <span>Also from</span>
                  <span 
                    style={{ fontFamily: "'Satisfy', cursive", fontWeight: 800 }} 
                    className="text-lg text-primary lowercase select-none"
                  >
                    ahr
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isAhrOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isAhrOpen && (
                <div className="mt-1 border-t border-gray-100 pt-1.5 px-3 pb-2 animate-[fadeIn_200ms_ease-in-out]">
                  <a 
                    href="https://civiclens.tech" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-between py-2.5 px-2 rounded-xl text-xs font-bold text-gray-600 hover:text-primary hover:bg-orange-50/50 transition-all"
                  >
                    <span className="flex items-center space-x-2">
                      <img src="/civiclens-icon.png" alt="CivicLens" className="w-4 h-4 object-contain rounded-[4px]" />
                      <span>CivicLens</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tasker Layout */
        <div className="space-y-4 px-6 -mt-12 relative z-10 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left pb-10">
          {/* Header Section */}
          <div className="m3-card rounded-[24px] p-6 flex flex-col items-center text-center">
            <Tooltip text="Tap to change avatar" position="top">
              <button 
                onClick={() => setShowBirdSelector(true)}
                className="w-[88px] h-[88px] rounded-full -mt-16 mb-3 flex items-center justify-center cursor-pointer hover:scale-105 transition-all active:scale-95 p-[2px]"
                style={{ background: `conic-gradient(#FF6B35 ${completionPercentage}%, #e5e7eb ${completionPercentage}%)` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-[2px] border-white shadow-md">
                  <BirdAvatar birdName={selectedBird} size={64} />
                </div>
              </button>
            </Tooltip>
            
            <div className="flex flex-col items-center w-full">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-2 flex items-center gap-1">
                Helper
              </span>
              <h2 className="text-xl font-bold text-dark leading-tight">{profile.name}</h2>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="m3-card rounded-[24px] p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500">Account details</h3>
              {!isEditingAccount ? (
                <Tooltip text="Edit account details" position="left">
                  <button 
                    onClick={() => { 
                      setEditedName(profile.name === 'New User' || profile.name === 'Guest User' ? '' : profile.name); 
                      setEditedPhone((profile.phone === 'Add Phone' || profile.phone === 'Not Linked (Guest Mode)') ? '' : profile.phone); 
                      setIsEditingAccount(true); 
                    }} 
                    className="text-gray-400 hover:text-primary transition-colors p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              ) : (
                <div className="flex items-center space-x-1 shrink-0">
                  <button 
                    onClick={() => { 
                      setIsEditingAccount(false); 
                    }} 
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            
            {isEditingAccount ? (
              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                      placeholder="Enter full name"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="tel"
                        value={editedPhone}
                        onChange={handlePhoneChange}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark transition-colors focus:outline-none focus:border-primary focus:bg-white"
                        placeholder="123-456-7890"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2 opacity-70">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 bg-gray-100/50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 select-none cursor-not-allowed">
                        {profile.email || '\u00A0'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canSave}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm ${
                      !canSave
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 text-white cursor-pointer'
                    }`}
                  >
                    Save Account
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Full name</p>
                      <p className="font-semibold text-dark">{profile.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                    <p className="text-xs font-semibold text-gray-500">Phone number</p>
                    <p className="font-semibold text-dark">{profile.phone}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm pt-1">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500">Email</p>
                      <p className="font-semibold text-dark">{profile.email}</p>
                    </div>
                  </div>
              </>
            )}
          </div>

          {/* Stats Grid (Tasker) */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div 
              onClick={() => {
                setJobHistoryTab('active');
                pushScreen('job_history');
              }}
              className="m3-card rounded-[20px] p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl font-bold text-dark">{activeTaskerJobs}</span>
              <span className="text-xs font-medium text-gray-500 mt-1 text-center">Active tasks</span>
            </div>
            <div 
              onClick={() => {
                setJobHistoryTab('completed');
                pushScreen('job_history');
              }}
              className="m3-card rounded-[20px] p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl font-bold text-dark">{completedTaskerJobsCount}</span>
              <span className="text-xs font-medium text-gray-500 mt-1 text-center">Completed</span>
            </div>
          </div>

          {/* Reputation Section (Tasker) */}
          <div className="m3-card rounded-[24px] p-6 space-y-6 mt-4">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500">Reputation</h3>
              {showVerifiedLocal && (
                <div className="flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-lg">
                  <Award className="w-3 h-3" />
                  <span className="text-xs font-medium">Verified helper</span>
                </div>
              )}
            </div>
            
            {/* Unified Ratings & Reviews Summary Component */}
            <div className="flex items-center space-x-6 py-2">
              {/* Left Side */}
              <div className="flex flex-col items-center justify-center shrink-0 w-24">
                <span className="text-5xl font-black text-dark tracking-tight leading-none">
                  {totalReviews > 0 ? averageRating : '0.0'}
                </span>
                
                {/* Star Rating display */}
                <div className="flex items-center space-x-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const starVal = totalReviews > 0 ? parseFloat(averageRating) : 0;
                    const isFull = star <= Math.floor(starVal);
                    const isHalf = !isFull && star === Math.ceil(starVal) && starVal % 1 >= 0.3;
                    return (
                      <Star 
                        key={star} 
                        className={`w-3.5 h-3.5 ${
                          isFull 
                            ? 'fill-primary text-primary' 
                            : isHalf 
                              ? 'fill-primary/50 text-primary' 
                              : 'text-gray-200'
                        }`} 
                      />
                    );
                  })}
                </div>
                
                <span className="text-xs font-semibold text-gray-500 mt-1.5 text-center">
                  {totalReviews > 0 ? `${totalReviews} ratings` : 'No reviews yet'}
                </span>
              </div>

              {/* Right Side - Distribution Bars */}
              <div className="flex-1 flex flex-col space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = totalReviews > 0 ? (ratingDistribution[star] || 0) : 0;
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center text-[10px] font-bold text-gray-400">
                      <span className="w-6 text-right leading-none shrink-0">{star} ★</span>
                      <div className="h-2 bg-gray-100 rounded-full flex-1 mx-2 overflow-hidden shrink-0">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-6 text-left leading-none shrink-0 text-gray-500">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-dark border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-gray-500">Tasks completed</span>
              <span className="text-base font-bold text-dark">{profile.tasksCompleted}</span>
            </div>

            {/* Trust Badges - Tasker specific */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">Trust badges</h4>
                <div className="flex flex-wrap gap-2">
                  {groupedBadges.map(({ badge, count }, idx) => (
                    <span key={idx} className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200/50 flex items-center space-x-1 shadow-xs">
                      <Award className="w-3 h-3 text-blue-600 shrink-0"/>
                      <span>{BADGE_LABELS[badge] || badge}</span>
                      {count > 1 && (
                        <span className="ml-1 bg-blue-200/80 text-blue-800 text-[8px] px-1.5 py-0.5 rounded-full font-black leading-none min-w-[14px] text-center">
                          {count}x
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secondary Info (Area) */}
          <div className="m3-card rounded-[20px] p-5 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500">Service scope</h3>
              <Tooltip text="Change service area" position="left">
                <button
                  onClick={() => pushScreen('tasker_onboarding', false, { editServiceAreaOnly: true })}
                  className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-dark">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              <span>Active in {userProfile?.serviceAreaName || 'No service area selected'}</span>
            </div>
          </div>

          {/* Skill tags (Tasker Only) */}
          <div className="m3-card rounded-[20px] p-5 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500">Your skills</h3>
              <Tooltip text="Edit skills" position="left">
                <button 
                  onClick={() => {
                    setEditedSkills(profile.skills);
                    setIsEditingSkills(true);
                  }}
                  className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skillId) => {
                const skill = SKILLS.find((s) => s.id === skillId);
                if (!skill) return null;
                const SkillIcon = skill.icon;
                return (
                  <Tooltip key={skillId} text={`Skill: ${skill.label}`}>
                    <div className="flex items-center space-x-1.5 bg-gray-50 border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-dark">
                      <SkillIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{skill.label}</span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Platform Dues Card (Tasker Only) */}
          <div className="rounded-[24px] p-5 sm:p-6 space-y-4 sm:space-y-5 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 border border-amber-100/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-dark whitespace-nowrap">Platform Dues</h3>
                    <span className="sm:hidden text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/50 shrink-0">
                      ₹{taskerDues.toFixed(2)} Dues
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 leading-snug mt-0.5">
                    Keep dues under ₹{taskerCreditLimit} to receive tasks smoothly.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 sm:px-2.5 rounded-full border border-amber-200/50 shrink-0 self-start sm:self-auto">
                ₹{taskerDues.toFixed(2)} Dues
              </span>
            </div>

            {/* Status Banners: Pending Verification or Recently Verified */}
            {pendingCommissionVerification ? (
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-3 text-center text-xs font-medium text-blue-700 flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <span>Verification under progress (usually &lt; 30 mins)</span>
              </div>
            ) : recentlyApprovedPayment ? (
              <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-3 text-center text-xs font-medium text-emerald-700 flex items-center justify-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Payment Verified (₹{parseFloat(recentlyApprovedPayment.amount_paid).toFixed(2)})</span>
              </div>
            ) : null}

            {/* Inline Action Buttons (No Modal!) */}
            {!pendingCommissionVerification && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button 
                  onClick={() => {
                    setHasClickedPayDues(true);
                    try {
                      localStorage.setItem(`helphive_pay_dues_clicked_${userId}`, 'true');
                    } catch (e) {
                      // ignore localStorage errors
                    }
                    const payAmount = taskerDues > 0 ? taskerDues : 50;
                    const upiLink = `upi://pay?pa=adminmobilenumber@ybl&pn=${encodeURIComponent('HelpHive Admin')}&am=${payAmount}&cu=INR&tn=${encodeURIComponent('HelpHive Dues')}`;
                    window.location.assign(upiLink);
                  }}
                  className="flex-1 sm:flex-none bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-5 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer text-xs shadow-xs min-h-[40px]"
                >
                  <DollarSign className="w-4 h-4 text-white shrink-0" />
                  <span>Pay dues</span>
                </button>

                {/* "I have paid" button appears AFTER clicking "Pay dues" */}
                {hasClickedPayDues && (
                  <button 
                    onClick={handleCommissionPaymentSubmit}
                    disabled={isSubmittingPayment}
                    className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-dark font-bold py-2.5 px-5 rounded-xl inline-flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer text-xs border border-gray-200 min-h-[40px]"
                  >
                    {isSubmittingPayment ? (
                      <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin"></div>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>I have paid</span>
                  </button>
                )}
              </div>
            )}

            {/* Recent Payment History Preview */}
            {commissionPayments && commissionPayments.length > 0 && (
              <div className="pt-3 border-t border-amber-100/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Recent Payments</span>
                  {commissionPayments.length > 2 && (
                    <button 
                      onClick={() => setShowPaymentHistoryModal(true)}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      See all
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {commissionPayments.slice(0, 2).map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between text-xs py-1.5 px-3 bg-white/70 rounded-xl border border-amber-100/50">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-dark">₹{parseFloat(pay.amount_paid).toFixed(2)}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 text-[11px]">
                          {new Date(pay.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        pay.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : pay.status === 'pending_verification' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {pay.status === 'approved' ? '✓ Verified' : pay.status === 'pending_verification' ? 'Pending' : pay.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refer & Earn Hub Card */}
          <div className="rounded-[24px] p-5 sm:p-6 space-y-4 sm:space-y-5 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 border border-emerald-100/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-dark whitespace-nowrap">Refer & Earn</h3>
                    <span className="sm:hidden text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/50 shrink-0">
                      ₹{totalReferralEarnings.toFixed(2)} Lifetime
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 leading-snug mt-0.5">
                    Earn from friend's first 5 tasks.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 sm:px-2.5 rounded-full border border-emerald-200/50 shrink-0 self-start sm:self-auto">
                ₹{totalReferralEarnings.toFixed(2)} Lifetime
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 py-1 px-1">
              <div>
                <p className="text-xs font-medium text-gray-400">Available</p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight mt-0.5">
                  ₹{availableReferralBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Invited</p>
                <p className="text-2xl font-bold text-dark tracking-tight mt-0.5">
                  {totalReferralsCount}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <div className="grid grid-cols-2 gap-3 items-end">
                <button 
                  onClick={handleWhatsAppShare}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer text-xs shadow-xs min-h-[40px]"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  <span>Share</span>
                </button>

                <div className="w-full flex flex-col items-start">
                  {availableReferralBalance < 100 && (
                    <span className="text-[10px] text-gray-400 font-normal lowercase mb-0.5 pl-3.5">
                      min. ₹100
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setWithdrawUpiId(profile.upiId || '');
                      setShowWithdrawModal(true);
                    }}
                    disabled={availableReferralBalance < 100}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 min-h-[40px] ${
                      availableReferralBalance >= 100 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-[0.98]'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Friends & Progress List */}
            {friendProgressList.length > 0 && (
              <div className="pt-2 border-t border-emerald-100/80 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Your invited friends</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {friendProgressList.map((f, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-dark flex items-center space-x-1.5">
                          <span>👤 {f.name}</span>
                          {f.count >= 5 && (
                            <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-green-200">
                              5/5 Completed 🎉
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-emerald-600 text-[11px]">
                          Total Earned: ₹{f.totalEarned.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                        <span>Progress: {f.count} of 5 tasks completed</span>
                        <span>{f.count < 5 ? `${5 - f.count} tasks remaining` : 'Done'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className="m3-card rounded-[24px] p-2">
            <div className="space-y-0.5">
              <button onClick={() => switchRole('poster', true)} className="w-full flex items-center justify-between text-left text-sm font-semibold text-primary hover:bg-primary/5 py-2.5 px-3 rounded-xl transition-colors cursor-pointer border border-primary/20 bg-primary/5">
                <div className="flex items-center space-x-3">
                  <PlusCircle className="w-4 h-4 text-primary" />
                  <span>Switch to hirer</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>

              <div style={{ height: '13px' }} />

              <button 
                onClick={() => pushScreen('tasker_activity')} 
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span>Earnings</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    ₹{(thisMonthEarnings || 0).toLocaleString('en-IN')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {isAdmin && (
                <>
                  <button onClick={() => pushScreen('admin_dashboard')} className="w-full flex items-center justify-between text-left text-sm font-semibold text-gray-800 hover:bg-gray-100 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>Admin dashboard</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                  <div className="h-px bg-gray-100 my-1.5 mx-2"></div>
                </>
              )}

              <button onClick={() => pushScreen('about_us')} className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Star className="w-4 h-4 text-gray-400" />
                  <span>About us</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {userId ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-between text-left text-sm font-semibold text-red-500 hover:bg-red-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sign out</span>
                  </div>
                </button>
              ) : (
                <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center justify-between text-left text-sm font-semibold text-primary hover:bg-primary/5 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogIn className="w-4 h-4 text-primary" />
                    <span>Sign in / sign up</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </button>
              )}

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              <div className="px-3 py-0.5 text-left">
                <span className="text-xs font-semibold text-gray-500">Need help?</span>
              </div>

              <button onClick={handleWhatsAppSupport} className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <WhatsAppIcon className="w-4 h-4 text-green-600 shrink-0" />
                  <span>WhatsApp support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-1.5 mx-2"></div>

              {/* Also from ahr dropdown section merged inside card */}
              <button 
                onClick={() => setIsAhrOpen(!isAhrOpen)} 
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-dark hover:bg-gray-50 py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <span>Also from</span>
                  <span 
                    style={{ fontFamily: "'Satisfy', cursive", fontWeight: 800 }} 
                    className="text-lg text-primary lowercase select-none"
                  >
                    ahr
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isAhrOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isAhrOpen && (
                <div className="mt-1 border-t border-gray-100 pt-1.5 px-3 pb-2 animate-[fadeIn_200ms_ease-in-out]">
                  <a 
                    href="https://civiclens.tech" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-between py-2.5 px-2 rounded-xl text-xs font-bold text-gray-600 hover:text-primary hover:bg-orange-50/50 transition-all"
                  >
                    <span className="flex items-center space-x-2">
                      <img src="/civiclens-icon.png" alt="CivicLens" className="w-4 h-4 object-contain rounded-[4px]" />
                      <span>CivicLens</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BirdSelector
        isOpen={showBirdSelector}
        onClose={() => setShowBirdSelector(false)}
        selectedBird={selectedBird}
        onSelectBird={async (bird) => {
          setSelectedBird(bird);
          setShowBirdSelector(false);
          await setUserProfile({ bird });
          showToast('Avatar updated successfully!');
        }}
      />

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />

      {/* Skills Editing Modal */}
      {shouldRenderSkillsModal && (
        <div 
          onClick={() => setIsEditingSkills(false)}
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 ${
            isAnimatingSkillsOut ? 'modal-backdrop-close' : 'modal-backdrop-open'
          }`}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`bg-white w-full sm:max-w-xl sm:rounded-[32px] rounded-t-[32px] h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden shadow-2xl ${
              isAnimatingSkillsOut ? 'modal-content-close' : 'modal-content-open'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-end px-6 py-3 bg-white sticky top-0 z-10 shrink-0">
              <button 
                onClick={() => setIsEditingSkills(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
              <div className="space-y-8 pb-20">
                {/* On-site Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 px-1">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs font-medium text-slate-700 tracking-wide">On-site &amp; Physical Services</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                    {SKILLS.filter(s => s.type === 'physical').map((skill) => {
                      const isSelected = editedSkills.includes(skill.id);
                      return (
                        <IconLabel
                          key={skill.id}
                          icon={skill.icon}
                          label={skill.label}
                          isNew={skill.isNew}
                          isHighDemand={skill.isHighDemand}
                          isUrgent={skill.isUrgent}
                          selected={isSelected}
                          onClick={() => {
                            if (editedSkills.includes(skill.id)) {
                              setEditedSkills(editedSkills.filter(id => id !== skill.id));
                            } else {
                              setEditedSkills([...editedSkills, skill.id]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Online Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 px-1">
                    <Wifi className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs font-medium text-slate-700 tracking-wide">Online &amp; Remote Services</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                    {SKILLS.filter(s => s.type === 'remote').map((skill) => {
                      const isSelected = editedSkills.includes(skill.id);
                      return (
                        <IconLabel
                          key={skill.id}
                          icon={skill.icon}
                          label={skill.label}
                          isNew={skill.isNew}
                          isHighDemand={skill.isHighDemand}
                          isUrgent={skill.isUrgent}
                          selected={isSelected}
                          onClick={() => {
                            if (editedSkills.includes(skill.id)) {
                              setEditedSkills(editedSkills.filter(id => id !== skill.id));
                            } else {
                              setEditedSkills([...editedSkills, skill.id]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Legend & Tip */}
                <div className="pt-5 mt-4 border-t border-border flex flex-col items-center gap-3">
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary text-white border border-primary">
                        NEW
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">Newly Added</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                        <Flame className="w-2.5 h-2.5 fill-current text-white" />
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">High Demand</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                        <Zap className="w-2.5 h-2.5 fill-current text-white" />
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">Quick Match</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 text-center mt-1 leading-normal max-w-[280px]">
                    💡 Note: Select all the services you are willing to perform. You can choose as many as you like!
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-white border-t border-border shrink-0">
              <button
                onClick={async () => {
                  if (editedSkills.length === 0) {
                    alert('Please select at least one skill.');
                    return;
                  }
                  setIsSavingSkills(true);
                  try {
                    const result = await setUserProfile({ skills: editedSkills });
                    if (result && result.success === false) {
                      showToast(result.error || 'Failed to save skills. Please try again.', 'error');
                      return;
                    }
                    setIsEditingSkills(false);
                    showToast('Services updated successfully!', 'success');
                  } catch (err) {
                    console.error('Failed to save skills:', err);
                    showToast('Failed to save skills. Please try again.', 'error');
                  } finally {
                    setIsSavingSkills(false);
                  }
                }}
                disabled={isSavingSkills}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
              >
                {isSavingSkills ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : null}
                <span>{isSavingSkills ? 'Saving...' : 'Save Services'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistoryModal && (
        <div 
          onClick={() => setShowPaymentHistoryModal(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 modal-backdrop-open"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] p-6 space-y-4 shadow-2xl modal-content-open max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-dark">Payment History</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">All past dues payments</p>
              </div>
              <button onClick={() => setShowPaymentHistoryModal(false)} className="p-2 text-gray-400 hover:text-dark rounded-full hover:bg-gray-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {Object.keys(groupedCommissionHistory).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No payment history found.</p>
              ) : (
                Object.entries(groupedCommissionHistory).map(([month, payments]) => (
                  <div key={month} className="space-y-2">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{month}</h4>
                    <div className="space-y-2">
                      {payments.map(pay => (
                        <div key={pay.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                          <div>
                            <p className="font-bold text-dark text-sm">₹{parseFloat(pay.amount_paid).toFixed(2)}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(pay.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${
                            pay.status === 'approved' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : pay.status === 'pending_verification' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {pay.status === 'approved' ? '✓ Verified' : pay.status === 'pending_verification' ? 'Pending' : pay.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Referral Withdrawal Modal */}
      {showWithdrawModal && (
        <div 
          onClick={() => setShowWithdrawModal(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 modal-backdrop-open"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] p-6 space-y-5 shadow-2xl modal-content-open"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-dark">Withdraw referral rewards</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">Available balance: ₹{availableReferralBalance.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 text-gray-400 hover:text-dark rounded-full hover:bg-gray-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500">
                Your UPI ID (e.g. name@okaxis)
              </label>
              <input
                type="text"
                value={withdrawUpiId}
                onChange={(e) => setWithdrawUpiId(e.target.value)}
                placeholder="name@upi or phone@paytm"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-dark focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-gray-500 font-medium">
                Admin will transfer ₹{availableReferralBalance.toFixed(2)} to this UPI ID via PhonePe / GPay.
              </p>
            </div>

            <button
              onClick={handleWithdrawalSubmit}
              disabled={isSubmittingWithdrawal || availableReferralBalance < 100}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-2xl text-xs shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 text-center"
            >
              {isSubmittingWithdrawal ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : null}
              <span>Request ₹{availableReferralBalance.toFixed(2)} payout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfileScreen;
