import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Star, 
  Shield, 
  ShieldCheck, 
  ArrowLeft, 
  LogOut, 
  LogIn, 
  User, 
  Phone, 
  Mail, 
  ChevronRight, 
  Briefcase, 
  HelpCircle, 
  Check, 
  X, 
  PlusCircle, 
  MapPin, 
  CheckCircle2, 
  Zap, 
  DollarSign, 
  Search, 
  Plus, 
  Layers, 
  Award, 
  TrendingUp, 
  Share2
} from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { api } from '../services/api';
import { SKILLS, GAME_SKILLS, HERO_DISCIPLINES, resolveUserSkills, searchGameSkills } from '../config/constants';
import Tooltip from '../components/Tooltip';
import BirdAvatar from '../components/BirdAvatars';
import BirdSelector from '../components/BirdSelector';
import { ToastContext } from '../store/ToastContext';
import LoginModal from '../components/LoginModal';
import ShareHeroCardModal from '../components/ShareHeroCardModal';
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import { formatCurrency } from '../utils/currency';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const MyProfileScreen = () => {
  const { 
    userProfile, 
    userId, 
    resetApp, 
    selectedBird, 
    setSelectedBird, 
    setUserProfile, 
    pushScreen, 
    popScreen, 
    jobs, 
    refreshProfile, 
    openLoginModal,
    currency,
    setShowCurrencyPicker
  } = useContext(AppContext);

  const { showToast } = useContext(ToastContext);
  const { completionPercentage } = useProfileCompletion();

  const [careerTab, setCareerTab] = useState('field'); // 'field' | 'deployed'
  const [showBirdSelector, setShowBirdSelector] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const ENABLE_HERO_PASSPORT_SHARE = false; // Feature flag: set to true to enable Hero Passport Sharing
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Skill Loadout Modal State
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [modalSkillSearch, setModalSkillSearch] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('all');

  useEffect(() => {
    if (refreshProfile) refreshProfile();
  }, []);

  // Performance Calculations
  const taskerJobs = useMemo(() => {
    return (jobs || []).filter(j => 
      j.taskerId === userProfile?.id || 
      j.taskerName === userProfile?.name || 
      j.isAcceptedByMe
    );
  }, [jobs, userProfile?.id, userProfile?.name]);

  const completedTaskerJobs = useMemo(() => {
    return taskerJobs.filter(j => j.status === 'completed' || j.completedByMe);
  }, [taskerJobs]);

  const totalEarned = useMemo(() => {
    return completedTaskerJobs.reduce((sum, j) => sum + (j.amount || 0), 0);
  }, [completedTaskerJobs]);

  const posterJobs = useMemo(() => {
    return (jobs || []).filter(j => 
      j.posterId === userProfile?.id || 
      j.posterName === userProfile?.name || 
      j.posterName === 'You'
    );
  }, [jobs, userProfile?.id, userProfile?.name]);

  const completedPosterJobs = useMemo(() => {
    return posterJobs.filter(j => j.status === 'completed');
  }, [posterJobs]);

  const totalPaidOut = useMemo(() => {
    return completedPosterJobs.reduce((sum, j) => sum + ((j.amount || 0) * (j.peopleNeeded || 1)), 0);
  }, [completedPosterJobs]);

  const isGuest = !userId || userProfile?.isGuest;

  // Agent Level derived directly from verified completed operations
  const totalCompletedOps = completedTaskerJobs.length + completedPosterJobs.length;
  const agentLevel = useMemo(() => {
    if (isGuest) return userProfile?.level || 12;
    if (totalCompletedOps === 0) return 1;
    return Math.min(99, Math.floor(Math.sqrt(totalCompletedOps * 4)) + 1);
  }, [isGuest, userProfile?.level, totalCompletedOps]);

  // Ratings & Street Cred
  const taskerRating = userProfile?.taskerRating || (completedTaskerJobs.length > 0 ? 5.0 : 0);
  const posterRating = userProfile?.posterRating || (completedPosterJobs.length > 0 ? 5.0 : 0);
  const taskerReviewsCount = userProfile?.taskerReviews?.length || completedTaskerJobs.length;
  const posterReviewsCount = userProfile?.posterReviews?.length || completedPosterJobs.length;

  // Equipped Skills Loadout
  const equippedSkills = useMemo(() => {
    const rawSkills = userProfile?.skills || [];
    return resolveUserSkills(rawSkills, completedTaskerJobs.length);
  }, [userProfile?.skills, completedTaskerJobs.length]);

  const equippedSkillIdSet = useMemo(() => {
    return new Set(equippedSkills.map(s => s.id));
  }, [equippedSkills]);

  const filteredModalSkills = useMemo(() => {
    let list = GAME_SKILLS;
    if (selectedDisciplineId !== 'all') {
      list = list.filter(s => s.disciplineId === selectedDisciplineId);
    }
    if (modalSkillSearch.trim()) {
      const q = modalSkillSearch.trim().toLowerCase();
      list = list.filter(s => 
        s.label.toLowerCase().includes(q) ||
        s.tagline?.toLowerCase().includes(q) ||
        s.aliases?.some(a => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedDisciplineId, modalSkillSearch]);

  const handleToggleEquipSkill = async (skillId) => {
    if (!userId) {
      openLoginModal();
      return;
    }
    // Start with currently resolved granular skill IDs so legacy umbrellas are cleanly migrated
    const currentResolvedIds = equippedSkills.map(s => s.id);
    const isEquipped = currentResolvedIds.includes(skillId);
    const newSkills = isEquipped 
      ? currentResolvedIds.filter(id => id !== skillId) 
      : [...currentResolvedIds, skillId];
    
    try {
      await setUserProfile({ ...userProfile, skills: newSkills });
      showToast(isEquipped ? 'Skill unequipped from loadout' : '⚡ Skill equipped to Loadout!', 'success');
    } catch (e) {
      showToast('Failed to update loadout', 'error');
    }
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!userId) {
      openLoginModal();
      return;
    }
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    setIsSavingAccount(true);
    try {
      await setUserProfile({
        ...userProfile,
        name: trimmedName,
        phone: editedPhone.trim() || userProfile?.phone
      });
      showToast('Dossier updated successfully!', 'success');
      setIsEditingAccount(false);
    } catch (err) {
      showToast('Failed to update dossier', 'error');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleWhatsAppSupport = () => {
    const agentUid = userId ? userId.slice(0, 8) : 'GUEST';
    const message = `Hi HelpHive Support,\n\nAgent UID: ${agentUid}\nName: ${userProfile?.name || 'Operative'}\n\nIssue: `;
    window.open(`https://wa.me/919347442426?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleInviteShare = () => {
    const shortRef = userId ? userId.slice(0, 8) : 'hive';
    const inviteLink = `${window.location.origin}/?ref=${shortRef}`;
    const msg = `⚡ Join my HelpHive squad. Monetize your skills and hunt real-world bounties:\n${inviteLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full select-none">
      
      {/* Top Dossier Title & Support Row */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between shrink-0 max-w-md lg:max-w-xl mx-auto w-full">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-black text-dark tracking-tight">Agent Dossier</h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleWhatsAppSupport}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full text-xs font-bold transition-colors cursor-pointer border border-emerald-200/60 active-scale"
            title="HelpHive Support"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
            <span>Support</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Dossier Viewport */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 pb-32 space-y-4 max-w-md lg:max-w-xl mx-auto w-full">
        
        {/* ================= HERO PLAYER CARD ================= */}
        <div className="m3-card rounded-[24px] p-5 bg-white border border-border/80 shadow-xs relative overflow-hidden">
          
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            
            {/* Avatar with Dynamic Level Ring */}
            <div className="flex items-center space-x-3.5">
              <div 
                onClick={() => {
                  if (isGuest) {
                    openLoginModal();
                    return;
                  }
                  setShowBirdSelector(true);
                }}
                className="relative cursor-pointer group"
                title={isGuest ? "Sign In to Customize Avatar" : "Change Avatar"}
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center p-[2.5px] transition-transform group-hover:scale-105"
                  style={{ background: `conic-gradient(#F26419 ${isGuest ? 75 : Math.min(100, agentLevel * 10)}%, #E2E8F0 ${isGuest ? 75 : Math.min(100, agentLevel * 10)}%)` }}
                >
                  <div className="w-full h-full rounded-full bg-orange-50/80 flex items-center justify-center border-2 border-white shadow-inner overflow-hidden">
                    <BirdAvatar birdName={selectedBird} size={48} />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white">
                  Lv.{agentLevel}
                </div>
              </div>

              {/* Name (Click to edit) + Verified Badge */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isGuest) {
                      openLoginModal();
                      return;
                    }
                    setEditedName(userProfile?.name || '');
                    setEditedPhone(userProfile?.phone || '');
                    setIsEditingAccount(true);
                  }}
                  className="text-left group cursor-pointer"
                  title={isGuest ? "Sign In to Edit" : "Click to edit name"}
                >
                  <h2 className="text-base font-black text-dark leading-tight group-hover:text-primary transition-colors">
                    {userProfile?.name || 'Operative'}
                  </h2>
                </button>
                <ShieldCheck 
                  className="w-4.5 h-4.5 text-emerald-500 stroke-[2.5] shrink-0" 
                  title="Verified Profile"
                  aria-label="Verified Profile"
                />
              </div>
            </div>
          </div>

          {/* Account Edit Drawer Form */}
          {isEditingAccount && (
            <form onSubmit={handleSaveAccount} className="pt-3 border-t border-border space-y-3 mb-3 animate-[fadeIn_150ms_ease-out]">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">Callsign / Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="Enter callsign or name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editedPhone}
                  onChange={(e) => setEditedPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingAccount(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-4 py-1.5 bg-primary text-white text-xs font-black rounded-xl shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isSavingAccount ? 'Saving...' : 'Save Callsign'}
                </button>
              </div>
            </form>
          )}

          {/* ================= DUAL CAREER TRACK LIQUID GLASS SLIDER ================= */}
          <div className="flex bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl mb-3 border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.02)]">
            <button
              onClick={() => setCareerTab('field')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer active-scale relative overflow-hidden ${
                careerTab === 'field'
                  ? 'bg-white/95 backdrop-blur-md text-primary shadow-[0_2px_12px_rgba(242,100,25,0.12),0_1px_3px_rgba(0,0,0,0.04)] border border-white/90'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Field Ops</span>
            </button>
            <button
              onClick={() => setCareerTab('deployed')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer active-scale relative overflow-hidden ${
                careerTab === 'deployed'
                  ? 'bg-white/95 backdrop-blur-md text-primary shadow-[0_2px_12px_rgba(242,100,25,0.12),0_1px_3px_rgba(0,0,0,0.04)] border border-white/90'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Deployed Ops</span>
            </button>
          </div>

          {/* Performance Data Display */}
          {careerTab === 'field' ? (
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-gray-50/80 rounded-xl p-2.5 border border-border/40">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Ops</span>
                <span className="text-base font-black text-dark">
                  {isGuest ? (userProfile?.taskerTasksCompleted || 42) : completedTaskerJobs.length}
                </span>
              </div>
              <div className="bg-gray-50/80 rounded-xl p-2.5 border border-border/40">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Street Cred</span>
                <div className="flex items-center justify-center space-x-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  <span className="text-base font-black text-dark">
                    {isGuest ? '5.0' : (taskerReviewsCount > 0 ? (typeof taskerRating === 'number' ? taskerRating.toFixed(1) : taskerRating) : '5.0')}
                  </span>
                </div>
              </div>
              <div 
                onClick={() => pushScreen('tasker_activity')}
                className="bg-gray-50/80 hover:bg-orange-50/60 rounded-xl p-2.5 border border-border/40 cursor-pointer transition-colors"
                title="View Bounty Stash & Ledger"
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Stash</span>
                <span className="text-base font-black text-emerald-700">
                  {isGuest ? formatCurrency(userProfile?.taskerEarningsAmount || 24500, currency?.code) : formatCurrency(totalEarned, currency?.code)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-gray-50/80 rounded-xl p-2.5 border border-border/40">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Ops</span>
                <span className="text-base font-black text-dark">
                  {isGuest ? (userProfile?.posterTasksCompleted || 18) : posterJobs.length}
                </span>
              </div>
              <div className="bg-gray-50/80 rounded-xl p-2.5 border border-border/40">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Host Cred</span>
                <div className="flex items-center justify-center space-x-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  <span className="text-base font-black text-dark">
                    {isGuest ? '5.0' : (posterReviewsCount > 0 ? (typeof posterRating === 'number' ? posterRating.toFixed(1) : posterRating) : '5.0')}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50/80 rounded-xl p-2.5 border border-border/40">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Payouts</span>
                <span className="text-base font-black text-dark">
                  {isGuest ? formatCurrency(userProfile?.posterPaidOutAmount || 14200, currency?.code) : formatCurrency(totalPaidOut, currency?.code)}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ================= EQUIPPED SKILL LOADOUT ================= */}
        <div className="m3-card rounded-[24px] p-5 bg-white border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Skill Loadout</h3>
              <span className="text-[10px] font-extrabold bg-orange-100 text-primary px-2 py-0.5 rounded-full">
                {equippedSkills.length}
              </span>
            </div>
            <button
              onClick={() => {
                if (isGuest) {
                  openLoginModal();
                  return;
                }
                setIsEditingSkills(true);
              }}
              className="p-1 text-primary hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
              title={isGuest ? "Sign In to Modify Loadout" : "Modify Loadout"}
              aria-label="Modify Loadout"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {equippedSkills.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-2xl p-4 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-400 mb-2">No skills equipped on your loadout.</p>
              <button
                onClick={() => setIsEditingSkills(true)}
                className="px-4 py-2 bg-primary text-white text-xs font-black rounded-xl shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                + Equip Skills
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {equippedSkills.map(skill => (
                <div 
                  key={skill.id}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-orange-200/80 bg-orange-50/50 text-dark text-xs font-bold shadow-2xs"
                >
                  <Zap className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/20" />
                  <span>{skill.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= DIRECT PAYMENT SETTLEMENT ================= */}
        <div className="m3-card rounded-[24px] p-5 bg-white border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Payment Settlement</h3>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              0% Fee
            </span>
          </div>

          <div className="flex items-center space-x-3 bg-gray-50 rounded-2xl p-3.5 border border-border/60">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-dark block">Direct Peer-to-Peer Settlement</span>
              <span className="text-[10px] font-medium text-gray-400 block mt-0.5">
                Direct settlement between both parties upon task completion.
              </span>
            </div>
          </div>
        </div>

        {/* ================= SECTOR OPERATIONS & SETTINGS ================= */}
        <div className="m3-card rounded-[24px] p-2 bg-white border border-border/80 shadow-xs space-y-1">
          
          {/* Currency Preference Setting */}
          <button
            onClick={() => setShowCurrencyPicker(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 text-gray-600 rounded-xl text-base leading-none">
                {currency?.flag || '🌐'}
              </div>
              <div>
                <h4 className="text-xs font-black text-dark">Currency Preference</h4>
                <p className="text-[10px] font-medium text-gray-400">
                  {currency?.name} ({currency?.code} • {currency?.symbol})
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {currency?.code} ({currency?.symbol})
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => {
              if (isGuest) {
                openLoginModal();
                return;
              }
              pushScreen('address_book');
            }}
            className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-dark">Sector Addresses</h4>
                <p className="text-[10px] font-medium text-gray-400">Manage saved deployment locations</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={() => pushScreen('about_us')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-dark">About HelpHive</h4>
                <p className="text-[10px] font-medium text-gray-400">Terms, Privacy & Version 7.2.0</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {userId ? (
            <button
              onClick={() => {
                resetApp();
                showToast('Signed out', 'info');
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left text-red-500"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100/60 text-red-500 rounded-xl">
                  <LogOut className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black">Sign Out</h4>
              </div>
            </button>
          ) : (
            <button
              onClick={() => openLoginModal()}
              className="w-full flex items-center justify-between p-3.5 hover:bg-primary/10 rounded-xl transition-colors cursor-pointer text-left text-primary"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <LogIn className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black">Sign In</h4>
              </div>
              <ChevronRight className="w-4 h-4 text-primary" />
            </button>
          )}

        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* Avatar Picker Modal */}
      {showBirdSelector && (
        <BirdSelector
          isOpen={showBirdSelector}
          selectedBird={selectedBird}
          onSelectBird={async (newBird) => {
            setSelectedBird(newBird);
            if (userId) {
              await setUserProfile({ ...userProfile, bird: newBird });
            }
          }}
          onClose={() => setShowBirdSelector(false)}
        />
      )}

      {/* Skill Loadout Modal */}
      {isEditingSkills && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-[fadeIn_150ms_ease-out]">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-[slideUp_200ms_ease-out]">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-dark">Modify Skill Loadout</h3>
                <p className="text-[11px] font-medium text-gray-400">Toggle skills to display on your agent card</p>
              </div>
              <button
                onClick={() => setIsEditingSkills(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="px-5 pt-3 pb-2 space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSkillSearch}
                  onChange={(e) => setModalSkillSearch(e.target.value)}
                  placeholder="Search capabilities (e.g. electrical, delivery)..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                />
              </div>

              {/* Discipline Tabs */}
              <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1">
                <button
                  onClick={() => setSelectedDisciplineId('all')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black shrink-0 transition-colors cursor-pointer ${
                    selectedDisciplineId === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {HERO_DISCIPLINES.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDisciplineId(d.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black shrink-0 transition-colors cursor-pointer ${
                      selectedDisciplineId === d.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {d.shortTitle || d.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills Selection Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-2">
              {filteredModalSkills.map(skill => {
                const isEquipped = equippedSkillIdSet.has(skill.id);
                return (
                  <div
                    key={skill.id}
                    onClick={() => handleToggleEquipSkill(skill.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between active-scale ${
                      isEquipped
                        ? 'border-primary bg-orange-50/50 shadow-xs'
                        : 'border-border hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black text-dark">{skill.label}</h4>
                      <p className="text-[10px] font-medium text-gray-400">{skill.tagline || skill.category}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isEquipped ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-border flex justify-end shrink-0">
              <button
                onClick={() => setIsEditingSkills(false)}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-xl shadow-xs active-scale transition-all cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {showLoginModal && (
        <LoginModal 
          isOpen={showLoginModal} 
          onClose={() => setShowLoginModal(false)} 
        />
      )}

      {ENABLE_HERO_PASSPORT_SHARE && showShareModal && (
        <ShareHeroCardModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          userProfile={userProfile}
          selectedBird={selectedBird}
          agentLevel={agentLevel}
          equippedSkills={equippedSkills}
          completedTasksCount={isGuest ? (userProfile?.taskerTasksCompleted || 42) : (userProfile?.taskerTasksCompleted || completedTaskerJobs.length)}
          rating={isGuest ? (userProfile?.taskerRating || 4.98) : taskerRating}
          userId={userId}
        />
      )}

    </div>
  );
};

export default MyProfileScreen;
