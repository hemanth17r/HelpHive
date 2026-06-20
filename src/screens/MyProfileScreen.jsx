import React, { useContext, useState, useEffect } from 'react';
import { Star, ShieldAlert, Shield, Lock, Award, Calendar, ArrowLeft, LogOut, LogIn, User, Phone, Mail, Edit2, ChevronRight, Briefcase, HelpCircle, Check, X, PlusCircle, MapPin, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { SKILLS } from '../config/constants';
import Tooltip from '../components/Tooltip';
import BirdAvatar from '../components/BirdAvatars';
import BirdSelector from '../components/BirdSelector';
import IconLabel from '../components/IconLabel';
import { ToastContext } from '../store/ToastContext';
import LoginModal from '../components/LoginModal';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import PullToRefresh from '../components/PullToRefresh';

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
  const { userProfile, userId, userLocation, resetApp, selectedBird, setSelectedBird, role, setUserProfile, pushScreen, popScreen, setActiveTab, switchRole, setJobHistoryTab, setTaskerActivityScrollTarget, jobs, isAdmin, refreshProfile } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const { completionPercentage } = useProfileCompletion();

  useEffect(() => {
    if (refreshProfile) {
      refreshProfile();
    }
  }, []);

  const handleWhatsAppSupport = () => {
    const uId = userProfile?.id || userId || 'N/A';
    const name = userProfile?.name || 'N/A';
    
    const message = `Hi HelpHive Support,

I need help.

User ID: ${uId}
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
  
  // Hirer (Poster) Stats
  const posterJobs = jobs?.filter(j => j?.posterId === userId || j?.posterId === userProfile?.id) || [];
  const activePosterJobs = posterJobs.filter(j => ['open', 'in_progress', 'active'].includes(j?.status)).length;
  const completedPosterJobsCount = posterJobs.filter(j => j?.status === 'completed').length;

  // Tasker Stats
  const taskerJobs = jobs?.filter(j => j?.isAcceptedByMe || j?.taskerId === userId || j?.taskerId === userProfile?.id || j?.taskerName === userProfile?.name) || [];
  const activeTaskerJobs = taskerJobs.filter(j => ['active', 'in_progress'].includes(j?.status)).length;
  const completedJobs = taskerJobs.filter(j => j?.status === 'completed');
  const completedTaskerJobsCount = completedJobs.length;




  const thisMonthEarnings = completedJobs.filter(j => {
    if (!j.timePosted) return false;
    const jobDate = new Date(j.timePosted);
    return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
  }).reduce((sum, job) => sum + (job.amount || 0), 0);

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
    name: userProfile?.name || 'New User',
    email: (userProfile?.email && userProfile.email !== 'Add Email') ? userProfile.email : '',
    phone: userProfile?.phone || 'Add Phone',
    skills: userProfile?.skills || [],
    rating: userProfile?.rating || 0,
    tasksCompleted: userProfile?.tasksCompleted || 0,
    badges: userProfile?.badges || [],
    reviews: userProfile?.reviews || []
  };

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
    if (finalPhone !== profile.phone) {
      updates.phone = finalPhone;
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
    <PullToRefresh onRefresh={refreshProfile}>
      <div className="flex-1 flex flex-col bg-gray-50 min-h-full pb-20 relative">
      {/* Smooth Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-orange-400 via-orange-300/50 to-gray-50 pointer-events-none z-0"></div>

      {/* Top Banner Area */}
      <div className="relative h-28 shrink-0 z-10">
        {/* Back Button */}
        <button
          onClick={() => {
            if (role === 'tasker') {
              setActiveTab('home');
            } else {
              popScreen();
            }
          }}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {role === 'poster' ? (
        <div className="space-y-4 px-6 -mt-12 relative z-10 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left pb-10">
          {/* Header Section */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border flex flex-col items-center text-center">
            <Tooltip text="Tap to change avatar" position="top">
              <button 
                onClick={() => setShowBirdSelector(true)}
                className="w-[88px] h-[88px] rounded-full -mt-16 mb-3 flex items-center justify-center cursor-pointer hover:scale-105 transition-all active:scale-95 p-[3px]"
                style={{ background: `conic-gradient(#f97316 ${completionPercentage}%, #e5e7eb ${completionPercentage}%)` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-[3px] border-white shadow-md">
                  <BirdAvatar birdName={selectedBird} size={64} />
                </div>
              </button>
            </Tooltip>
            
            <div className="flex flex-col items-center w-full">
              <h2 className="text-xl font-black text-dark leading-tight">{profile.name}</h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mt-2 flex items-center gap-1">
                Hirer
              </span>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Account Details</h3>
              {!isEditingAccount ? (
                <Tooltip text="Edit account details" position="left">
                  <button 
                    onClick={() => { 
                      setEditedName(profile.name === 'New User' ? '' : profile.name); 
                      setEditedPhone(profile.phone === 'Add Phone' ? '' : profile.phone); 
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
                      <div className="flex-1 bg-gray-100/50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 select-none">
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
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Full Name</p>
                      <p className="font-bold text-dark">{profile.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Phone Number</p>
                    <p className="font-bold text-dark">{profile.phone}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm pt-1">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Email</p>
                      <p className="font-bold text-dark">{profile.email}</p>
                    </div>
                  </div>
              </>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div 
              onClick={() => { setJobHistoryTab('active'); pushScreen('job_history'); }}
              className="bg-white rounded-3xl p-3 shadow-sm border border-border flex flex-col justify-center items-center text-center cursor-pointer hover:border-blue-200 transition-colors"
            >
              <span className="text-xl font-black text-dark">{activePosterJobs}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 text-center">Active Tasks</span>
            </div>
            <div 
              onClick={() => { setJobHistoryTab('completed'); pushScreen('job_history'); }}
              className="bg-white rounded-3xl p-3 shadow-sm border border-border flex flex-col justify-center items-center text-center cursor-pointer hover:border-green-200 transition-colors"
            >
              <span className="text-xl font-black text-dark">{completedPosterJobsCount}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 text-center">Completed</span>
            </div>
          </div>

          {/* Reputation Section */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border space-y-5">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Reputation</h3>
              {showVerifiedLocal && (
                <div className="flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-lg">
                  <Award className="w-3 h-3" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">Verified Hirer</span>
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
                
                <span className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider text-center">
                  {totalReviews > 0 ? `${totalReviews} Ratings` : 'No reviews yet'}
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
              <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Interactions</span>
              <span className="text-base font-black text-dark">{profile.tasksCompleted}</span>
            </div>

            {/* Trust Badges - Hirer specific */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trust Badges</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((badge, idx) => (
                    <span key={idx} className="text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-200/50 flex items-center space-x-1 shadow-xs">
                      <Award className="w-3 h-3"/>
                      <span>{BADGE_LABELS[badge] || badge}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-border mb-6">
            <div className="space-y-1">
              <button onClick={() => switchRole('tasker')} className="w-full flex items-center justify-between text-left text-xs font-bold text-primary hover:bg-primary/5 p-3 rounded-2xl transition-colors cursor-pointer border border-primary/20 bg-primary/5">
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-4.5 h-4.5 text-primary" />
                  <span>Switch to Tasker</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>

              <button onClick={() => pushScreen('address_book')} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4.5 h-4.5 text-gray-400" />
                  <span>Address Book</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              <button onClick={() => pushScreen('about_us')} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Star className="w-4.5 h-4.5 text-gray-400" />
                  <span>About Us</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              <div className="px-3 py-1 text-left">
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Need Help?</span>
              </div>

              <button onClick={handleWhatsAppSupport} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <WhatsAppIcon className="w-4.5 h-4.5 text-green-600 shrink-0" />
                  <span>WhatsApp Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              {isAdmin && (
                <>
                  <button onClick={() => pushScreen('admin_dashboard')} className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-800 hover:bg-gray-100 p-3 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-4.5 h-4.5 text-gray-600" />
                      <span>Admin Dashboard</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                  <div className="h-px bg-gray-100 my-2 mx-3"></div>
                </>
              )}

              {userId ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-between text-left text-xs font-bold text-red-500 hover:bg-red-50 p-3 rounded-2xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-4.5 h-4.5 text-red-500" />
                    <span>Sign Out</span>
                  </div>
                </button>
              ) : (
                <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center justify-between text-left text-xs font-bold text-primary hover:bg-primary/5 p-3 rounded-2xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogIn className="w-4.5 h-4.5 text-primary" />
                    <span>Sign In / Sign Up</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
          </div>

          {/* Also from ahr card */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-border mt-4">
            <button 
              onClick={() => setIsAhrOpen(!isAhrOpen)} 
              className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-700 hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer"
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
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>CivicLens</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tasker Layout */
        <div className="px-6 -mt-12 relative z-10 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left mb-10">
          {/* Header Section */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border flex flex-col items-center text-center">
            <Tooltip text="Tap to change avatar" position="top">
              <button 
                onClick={() => setShowBirdSelector(true)}
                className="w-[88px] h-[88px] rounded-full -mt-16 mb-3 flex items-center justify-center cursor-pointer hover:scale-105 transition-all active:scale-95 p-[3px]"
                style={{ background: `conic-gradient(#f97316 ${completionPercentage}%, #e5e7eb ${completionPercentage}%)` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-[3px] border-white shadow-md">
                  <BirdAvatar birdName={selectedBird} size={64} />
                </div>
              </button>
            </Tooltip>
            
            <div className="flex flex-col items-center w-full">
              <h2 className="text-xl font-black text-dark leading-tight">{profile.name}</h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mt-2 flex items-center gap-1">
                Tasker
              </span>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Account Details</h3>
              {!isEditingAccount ? (
                <Tooltip text="Edit account details" position="left">
                  <button 
                    onClick={() => { 
                      setEditedName(profile.name === 'New User' ? '' : profile.name); 
                      setEditedPhone(profile.phone === 'Add Phone' ? '' : profile.phone); 
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
                      <div className="flex-1 bg-gray-100/50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 select-none">
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
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Full Name</p>
                      <p className="font-bold text-dark">{profile.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Phone Number</p>
                    <p className="font-bold text-dark">{profile.phone}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm pt-1">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Email</p>
                      <p className="font-bold text-dark">{profile.email}</p>
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
              className="bg-white rounded-3xl p-3 shadow-sm border border-border flex flex-col justify-center items-center text-center cursor-pointer hover:border-blue-200 transition-colors"
            >
              <span className="text-xl font-black text-dark">{activeTaskerJobs}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 text-center">Active Tasks</span>
            </div>
            <div 
              onClick={() => {
                setJobHistoryTab('completed');
                pushScreen('job_history');
              }}
              className="bg-white rounded-3xl p-3 shadow-sm border border-border flex flex-col justify-center items-center text-center cursor-pointer hover:border-green-200 transition-colors"
            >
              <span className="text-xl font-black text-dark">{completedTaskerJobsCount}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 text-center">Completed</span>
            </div>
          </div>

          {/* Reputation Section (Tasker) */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border space-y-5 mt-4">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Reputation</h3>
              {showVerifiedLocal && (
                <div className="flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-lg">
                  <Award className="w-3 h-3" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">Verified Helper</span>
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
                
                <span className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider text-center">
                  {totalReviews > 0 ? `${totalReviews} Ratings` : 'No reviews yet'}
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
              <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Jobs Completed</span>
              <span className="text-base font-black text-dark">{profile.tasksCompleted}</span>
            </div>

            {/* Trust Badges - Tasker specific */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trust Badges</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((badge, idx) => (
                    <span key={idx} className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200/50 flex items-center space-x-1 shadow-xs">
                      <Award className="w-3 h-3"/>
                      <span>{BADGE_LABELS[badge] || badge}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secondary Info (Area) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-border mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Service Scope</h3>
              <Tooltip text="Change service area" position="left">
                <button
                  onClick={() => pushScreen('tasker_onboarding', false, { editServiceAreaOnly: true })}
                  className="text-[9px] font-black text-primary uppercase tracking-wider hover:underline cursor-pointer"
                >
                  Change
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold text-dark">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              <span>Active in {userProfile?.serviceAreaName || 'No service area selected'}</span>
            </div>
          </div>

          {/* Skill tags (Tasker Only) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-border mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Your Skills</h3>
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

          {/* Action Menu */}
          <div className="bg-white rounded-3xl p-2 shadow-xs border border-border mt-4 mb-10">
            <div className="space-y-1">
              <button onClick={() => switchRole('poster')} className="w-full flex items-center justify-between text-left text-xs font-bold text-primary hover:bg-primary/5 p-3 rounded-2xl transition-colors cursor-pointer border border-primary/20 bg-primary/5 mb-2">
                <div className="flex items-center space-x-3">
                  <PlusCircle className="w-4.5 h-4.5 text-primary" />
                  <span>Switch to Hirer</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>



              <button onClick={() => pushScreen('tasker_activity')} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-4.5 h-4.5 text-gray-400" />
                  <span>Earnings</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black text-orange-500 bg-orange-100 px-2 py-0.5 rounded-md">₹{thisMonthEarnings.toLocaleString('en-IN')}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </button>
              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              <button onClick={() => pushScreen('about_us')} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Star className="w-4.5 h-4.5 text-gray-400" />
                  <span>About Us</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              <div className="px-3 py-1 text-left">
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Need Help?</span>
              </div>

              <button onClick={handleWhatsAppSupport} className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <WhatsAppIcon className="w-4.5 h-4.5 text-green-600 shrink-0" />
                  <span>WhatsApp Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              <div className="h-px bg-gray-100 my-2 mx-3"></div>

              {isAdmin && (
                <>
                  <button onClick={() => pushScreen('admin_dashboard')} className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-800 hover:bg-gray-100 p-3 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-4.5 h-4.5 text-gray-600" />
                      <span>Admin Dashboard</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                  <div className="h-px bg-gray-100 my-2 mx-3"></div>
                </>
              )}

              {userId ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-between text-left text-xs font-bold text-red-500 hover:bg-red-50 p-3 rounded-2xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-4.5 h-4.5 text-red-500" />
                    <span>Sign Out</span>
                  </div>
                </button>
              ) : (
                <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center justify-between text-left text-xs font-bold text-primary hover:bg-primary/5 p-3 rounded-2xl transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <LogIn className="w-4.5 h-4.5 text-primary" />
                    <span>Sign In / Sign Up</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
          </div>

          {/* Also from ahr card */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-border mt-4 mb-10">
            <button 
              onClick={() => setIsAhrOpen(!isAhrOpen)} 
              className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-700 hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer"
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
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>CivicLens</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
              </div>
            )}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white sticky top-0 z-10 shrink-0">
              <h2 className="text-lg font-black text-dark">Edit Services</h2>
              <button 
                onClick={() => setIsEditingSkills(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-500 mb-4">
                Select the services you want to offer.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 pb-20">
                {SKILLS.map((skill) => {
                  const isSelected = editedSkills.includes(skill.id);
                  return (
                    <IconLabel
                      key={skill.id}
                      icon={skill.icon}
                      label={skill.label}
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
      </div>
    </PullToRefresh>
  );
};

export default MyProfileScreen;
