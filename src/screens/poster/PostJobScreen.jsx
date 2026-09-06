import React, { useState, useContext, useRef, useMemo, useCallback, useEffect } from 'react';
import { ArrowLeft, Minus, Plus, IndianRupee, Radio, Info, Calendar, Clock, MapPin, Home, Briefcase, Wifi, X, Crown, Search, Zap, Check, Users, User, Flame, Globe } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS, GAME_SKILLS, HERO_DISCIPLINES, searchGameSkills } from '../../config/constants';
import SkillPicker from '../../components/SkillPicker';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';
import { ToastContext } from '../../store/ToastContext';
import { evaluateMarketplaceMaturity } from '../../utils/marketplaceMaturity';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

const PostJobScreen = () => {
  const { 
    userLocation, 
    postJob, 
    popScreen, 
    pushScreen,
    editJobData, 
    setEditJobData, 
    savedAddresses, 
    addSavedAddress, 
    userProfile, 
    setUserProfile, 
    realLocation, 
    setRealLocation, 
    userId, 
    openLoginModal, 
    currency, 
    setShowCurrencyPicker,
    postJobDraft,
    setPostJobDraft,
    postJobSelectedAddress,
    setPostJobSelectedAddress,
    setEditAddressData
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const initialDraft = postJobDraft || editJobData;
  const [selectedSkillId, setSelectedSkillId] = useState(initialDraft?.selectedSkillId || initialDraft?.skillId || '');
  const [isSelectingSkill, setIsSelectingSkill] = useState(!initialDraft?.selectedSkillId && !initialDraft?.skillId);
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [peopleNeeded, setPeopleNeeded] = useState(initialDraft?.peopleNeeded || 1);
  const [amount, setAmount] = useState(initialDraft?.amount ? String(initialDraft.amount) : '');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState(
    initialDraft?.selectedDisciplineId && initialDraft.selectedDisciplineId !== 'all'
      ? initialDraft.selectedDisciplineId
      : HERO_DISCIPLINES[0]?.id || 'culinary'
  );
  const questRarity = 'standard';

  const selectedSkillObject = useMemo(() => {
    if (!selectedSkillId) return null;
    const gameSkill = GAME_SKILLS.find(s => s.id === selectedSkillId || s.categoryId === selectedSkillId);
    if (gameSkill) return gameSkill;
    const standardSkill = SKILLS.find(s => s.id === selectedSkillId);
    if (standardSkill) return standardSkill;
    if (selectedSkillId === 'custom_physical_op') {
      return {
        id: 'custom_physical_op',
        label: 'Custom Field Bounty',
        tagline: 'On-demand custom field task',
        type: 'physical',
        icon: Zap
      };
    }
    if (selectedSkillId === 'custom_remote_op') {
      return {
        id: 'custom_remote_op',
        label: 'Custom Cyber Bounty',
        tagline: 'On-demand custom cyber task',
        type: 'remote',
        icon: Globe
      };
    }
    return null;
  }, [selectedSkillId]);
  
  const datesList = React.useMemo(() => {
    const list = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  const [day, setDay] = useState(() => {
    if (initialDraft && initialDraft.day) return initialDraft.day;
    if (initialDraft && initialDraft.expiresAt) {
      const d = new Date(initialDraft.expiresAt);
      d.setHours(0,0,0,0);
      return d.toISOString();
    }
    return datesList[0].toISOString();
  });

  const [hour, setHour] = useState(() => {
    if (initialDraft && initialDraft.hour) return initialDraft.hour;
    if (initialDraft && initialDraft.expiresAt) {
      let h = new Date(initialDraft.expiresAt).getHours() % 12;
      if (h === 0) h = 12;
      return String(h).padStart(2, '0');
    }
    let h = new Date().getHours() % 12;
    if (h === 0) h = 12;
    return String(h).padStart(2, '0');
  });

  const [minute, setMinute] = useState(() => {
    if (initialDraft && initialDraft.minute) return initialDraft.minute;
    if (initialDraft && initialDraft.expiresAt) {
      return String(new Date(initialDraft.expiresAt).getMinutes()).padStart(2, '0');
    }
    return String(new Date().getMinutes()).padStart(2, '0');
  });

  const [ampm, setAmpm] = useState(() => {
    if (initialDraft && initialDraft.ampm) return initialDraft.ampm;
    if (initialDraft && initialDraft.expiresAt) {
      return new Date(initialDraft.expiresAt).getHours() >= 12 ? 'PM' : 'AM';
    }
    return new Date().getHours() >= 12 ? 'PM' : 'AM';
  });

  const time = `${hour}:${minute} ${ampm}`;
  const [isLoading, setIsLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const hourScrollTimeoutRef = useRef(null);
  const minuteScrollTimeoutRef = useRef(null);

  // Rotating examples logic
  const [exampleIndex, setExampleIndex] = useState(0);
  const currentSkill = GAME_SKILLS.find(s => s.id === selectedSkillId) || SKILLS.find(s => s.id === selectedSkillId) || GAME_SKILLS[0];
  const activeExamples = currentSkill?.examples || ['Describe your quest objectives here...'];



  React.useEffect(() => {
    if (activeExamples.length <= 1) return;
    const interval = setInterval(() => {
      setExampleIndex(prev => (prev + 1) % activeExamples.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeExamples.length, selectedSkillId]);

  React.useEffect(() => {
    setExampleIndex(0);
  }, [selectedSkillId]);

  const activePlaceholder = activeExamples[exampleIndex];

  // Address State & Full-Screen Selection Flow
  const [selectedJobLocation, setSelectedJobLocation] = useState(() => {
    if (postJobSelectedAddress) return postJobSelectedAddress;
    if (editJobData?.address) return editJobData.address;
    if (Array.isArray(savedAddresses) && savedAddresses.length > 0) {
      return savedAddresses.find(a => a.isDefault) || savedAddresses[0];
    }
    return null;
  });

  React.useEffect(() => {
    if (postJobSelectedAddress) {
      setSelectedJobLocation(postJobSelectedAddress);
    } else if (!selectedJobLocation && savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      if (defaultAddr) setSelectedJobLocation(defaultAddr);
    }
  }, [postJobSelectedAddress, savedAddresses, selectedJobLocation]);

  const navigateToSelectAddress = () => {
    // Preserve current draft so returning loses nothing
    setPostJobDraft({
      selectedSkillId,
      description,
      peopleNeeded,
      amount,
      day,
      hour,
      minute,
      ampm,
      questRarity,
      selectedDisciplineId
    });

    if (savedAddresses && savedAddresses.length > 0) {
      pushScreen('address_book', false, { returnTo: 'post_job' });
    } else {
      setEditAddressData(null);
      pushScreen('add_edit_address', false, { returnTo: 'post_job' });
    }
  };

  // Contact details
  const [contactName, setContactName] = useState(userProfile?.posterName || userProfile?.name || '');
  const [contactPhone, setContactPhone] = useState(userProfile?.posterPhone || userProfile?.phone || '');

  React.useEffect(() => {
    if (!contactName && !contactPhone) {
      const pName = userProfile?.posterName || userProfile?.name || '';
      const pPhone = userProfile?.posterPhone || userProfile?.phone || '';
      setContactName(pName);
      setContactPhone(pPhone);
    }
  }, [userProfile]);

  const [maturityInfo, setMaturityInfo] = useState(null);
  const [isCheckingMaturity, setIsCheckingMaturity] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);

  React.useEffect(() => {
    setIsWaitlisted(false);
    if (selectedSkillId && selectedJobLocation) {
      setIsCheckingMaturity(true);
      evaluateMarketplaceMaturity(selectedSkillId, selectedJobLocation.lat, selectedJobLocation.lng)
        .then(res => {
          setMaturityInfo(res);
          setIsCheckingMaturity(false);
        })
        .catch(err => {
          console.error(err);
          setIsCheckingMaturity(false);
        });
    } else {
      setMaturityInfo(null);
    }
  }, [selectedSkillId, selectedJobLocation]);

  const handleJoinWaitlist = async () => {
    setIsLoading(true);
    try {
      await api.joinWaitlist(userProfile?.id, selectedSkillId, selectedJobLocation.lat, selectedJobLocation.lng);
      
      // Analytics: V2 Marketplace Metric
      api.logEvent('waitlist_joined', {
        userId: userProfile?.id,
        role: 'poster',
        categoryId: selectedSkillId,
        lat: selectedJobLocation.lat,
        lng: selectedJobLocation.lng
      });

      const { count } = await api.getWaitlistCount(selectedSkillId, selectedJobLocation.lat, selectedJobLocation.lng, 5000);
      setIsWaitlisted(true);
      setWaitlistCount(count || 1);
    } catch (err) {
      showToast('Failed to join waitlist.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    return () => {
      // Bug 3.1 fix: Clear debounce timeouts on unmount to prevent
      // setState calls on an unmounted component.
      if (hourScrollTimeoutRef.current) clearTimeout(hourScrollTimeoutRef.current);
      if (minuteScrollTimeoutRef.current) clearTimeout(minuteScrollTimeoutRef.current);
      if (editJobData) setEditJobData(null);
    };
  }, [editJobData, setEditJobData]);

  React.useEffect(() => {
    if (showTimePicker) {
      setTimeout(() => {
        const hourEl = document.getElementById(`hour-${hour}`);
        const minEl = document.getElementById(`minute-${minute}`);
        if (hourEl) hourEl.scrollIntoView({ block: 'center' });
        if (minEl) minEl.scrollIntoView({ block: 'center' });
      }, 50);
    }
  }, [showTimePicker]);

  const handleScroll = (e, isHour) => {
    const el = e.target;
    if (isHour) {
      if (hourScrollTimeoutRef.current) clearTimeout(hourScrollTimeoutRef.current);
      hourScrollTimeoutRef.current = setTimeout(() => {
        const itemHeight = el.children[0]?.children[0]?.offsetHeight || 48;
        const index = Math.round(el.scrollTop / itemHeight);
        const h = Math.min(Math.max(index + 1, 1), 12);
        setHour(String(h).padStart(2, '0'));
      }, 150);
    } else {
      if (minuteScrollTimeoutRef.current) clearTimeout(minuteScrollTimeoutRef.current);
      minuteScrollTimeoutRef.current = setTimeout(() => {
        const itemHeight = el.children[0]?.children[0]?.offsetHeight || 48;
        const index = Math.round(el.scrollTop / itemHeight);
        const m = Math.min(Math.max(index, 0), 59);
        setMinute(String(m).padStart(2, '0'));
      }, 150);
    }
  };

  const handleItemClick = (val, isHour) => {
    if (isHour) setHour(val);
    else setMinute(val);
    const el = document.getElementById(isHour ? `hour-${val}` : `minute-${val}`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const incrementPeople = () => {
    if (peopleNeeded < 7) setPeopleNeeded(peopleNeeded + 1);
  };

  const decrementPeople = () => {
    if (peopleNeeded > 1) setPeopleNeeded(peopleNeeded - 1);
  };

  const handlePost = () => {
    if (!userId) {
      openLoginModal();
      return;
    }
    if (isLoading) return;
    if (!selectedSkillId) return;
    const parsedAmount = parseFloat(amount);
    if (amount === '' || isNaN(parsedAmount) || parsedAmount < 0) return;

    if (!selectedJobLocation) {
      navigateToSelectAddress();
      return;
    }
    submitJob(selectedJobLocation);
  };

  const submitJob = async (address) => {
    const parsedAmount = parseFloat(amount);
    const coords = { 
      lat: address.lat || realLocation?.lat || 20.5937, 
      lng: address.lng || realLocation?.lng || 78.9629 
    };
    setIsLoading(true);

    const gameSkill = GAME_SKILLS.find(s => s.id === selectedSkillId);
    const dbSkillId = gameSkill ? (gameSkill.categoryId || gameSkill.id) : selectedSkillId;
    const allTags = gameSkill ? [gameSkill.label] : (skillSearchQuery.trim() ? [skillSearchQuery.trim()] : []);

    const result = await postJob({
      id: editJobData?.id,
      skillId: dbSkillId,
      specificSkillId: selectedSkillId,
      skillTags: allTags,
      questRarity: questRarity,
      description: description,
      peopleNeeded: peopleNeeded,
      amount: parsedAmount,
      currency: currency?.code || 'INR',
      day: day,
      time: time,
      posterName: userProfile?.posterName || userProfile?.name || 'Guild Master',
      lat: coords.lat,
      lng: coords.lng,
      address: address
    });
    setIsLoading(false);
    if (!result || !result.success) {
      showToast(result?.error || 'Failed to broadcast bounty. Please try again.', 'error');
    } else {
      setPostJobDraft(null);
      setPostJobSelectedAddress(null);
    }
  };

  const parsedAmount = parseFloat(amount);
  const isPostDisabled = !selectedSkillId || amount === '' || isNaN(parsedAmount) || parsedAmount <= 0 || !time || isLoading;

  const selectedSkill = selectedSkillObject || SKILLS.find(s => s.id === selectedSkillId);
  const showPhysical = !selectedSkill || selectedSkill.type === 'physical';
  const showRemote = !selectedSkill || selectedSkill.type === 'remote';

  return (
    <div 
      className="flex-1 flex flex-col justify-between bg-[#F8FAFC] px-4 pt-2 pb-5 lg:pt-4 lg:px-8 overflow-hidden select-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
    >
      
      {/* Header */}
      <div 
        className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-2 shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setPostJobDraft(null);
              setPostJobSelectedAddress(null);
              if (maturityInfo && !maturityInfo.isActive) {
                setSelectedSkillId('');
              } else {
                popScreen();
              }
            }}
            className="p-2 -ml-2 rounded-full hover:bg-slate-200/60 text-slate-700 cursor-pointer active-scale"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Broadcast Bounty
          </span>
          <div className="w-9"></div>
        </div>
      </div>

      {/* Selected Location Banner */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-1 shrink-0">
        <div 
          className="p-3.5 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl flex items-center cursor-pointer active-scale shadow-2xs hover:border-primary/50 transition-all" 
          onClick={navigateToSelectAddress}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-primary flex items-center justify-center shrink-0">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary">Bounty Location</p>
              <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {selectedJobLocation 
                  ? (selectedJobLocation.completeAddress?.startsWith('Location at') && selectedJobLocation.landmark 
                      ? selectedJobLocation.landmark 
                      : selectedJobLocation.completeAddress)
                  : 'Select drop location on map'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content or Waitlist */}
      {isCheckingMaturity ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : maturityInfo && !maturityInfo.isActive ? (
        <div className="flex-1 flex flex-col justify-center items-center text-center px-4 -mt-20">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
            <Info className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-dark mb-3">Sector Still Calibrating</h2>
          <p className="text-sm font-semibold text-gray-500 mb-8 max-w-xs">
            We are still onboarding verified operators for <strong className="text-dark">{currentSkill?.label}</strong> in this sector. Join the priority dispatch queue!
          </p>
          
          {isWaitlisted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 w-full max-w-xs">
              <p className="font-black text-green-700 text-lg mb-1">Queued for Dispatch!</p>
              <p className="text-xs font-bold text-green-600/80">
                {waitlistCount} {waitlistCount === 1 ? 'player is' : 'players are'} in this sector queue. We will notify you immediately.
              </p>
            </div>
          ) : (
            <button 
              onClick={handleJoinWaitlist}
              disabled={isLoading}
              className="w-full max-w-xs flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/25 active:scale-[0.99] transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>Join Priority Dispatch</span>
              )}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Full width scrollable wrapper to ensure empty space scrolling works */}
          <div className="flex-1 overflow-y-auto w-full pb-0 pr-1">
            {/* Centered inner form content */}
            <div className="space-y-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left pt-3">
            
            {/* Quest Hero Talent Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Skill Needed
                </h2>
                {selectedSkillObject && isSelectingSkill && (
                  <button
                    type="button"
                    onClick={() => setIsSelectingSkill(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Selected Skill Summary Card (Smooth Accordion Collapse / Expand) */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateRows: selectedSkillObject && !isSelectingSkill ? '1fr' : '0fr',
                  opacity: selectedSkillObject && !isSelectingSkill ? 1 : 0,
                  transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease',
                  pointerEvents: selectedSkillObject && !isSelectingSkill ? 'auto' : 'none'
                }}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="py-0.5">
                    {selectedSkillObject && (
                      <div 
                        onClick={() => setIsSelectingSkill(true)}
                        className="p-3.5 rounded-2xl border border-primary bg-orange-50/80 shadow-xs ring-1 ring-primary/20 flex items-center cursor-pointer active-scale hover:bg-orange-100/70 transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                            {React.createElement(selectedSkillObject.icon || Zap, { className: "w-4.5 h-4.5 shrink-0" })}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-900 text-xs sm:text-sm tracking-tight truncate leading-snug">
                              {selectedSkillObject.label}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none">
                                {selectedSkillObject.type === 'remote' ? (
                                  <>
                                    <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="leading-none">Cyber</span>
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="leading-none">Field</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Skill Picker (Smooth Accordion Collapse / Expand) */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateRows: isSelectingSkill ? '1fr' : '0fr',
                  opacity: isSelectingSkill ? 1 : 0,
                  transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease',
                  pointerEvents: isSelectingSkill ? 'auto' : 'none'
                }}
              >
                <div className="overflow-hidden min-h-0 pt-1">
                  <SkillPicker
                    mode="single"
                    layout="accordion"
                    selected={selectedSkillId}
                    maxHeight="340px"
                    searchPlaceholder="Search required talent (e.g. Drone, Chef, IKEA, Reels)..."
                    showCustomBountyOption={true}
                    onSelect={(skillId) => {
                      setSelectedSkillId(skillId);
                      setIsSelectingSkill(false);
                      setSelectedTags([]);
                    }}
                    onSelectCustomBounty={(type) => {
                      setSelectedSkillId(type === 'remote' ? 'custom_remote_op' : 'custom_physical_op');
                      setIsSelectingSkill(false);
                      setSelectedTags([]);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bounty Details Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Bounty Details
                </h2>
                <span className={`text-[10px] font-bold ${description.length > 130 ? 'text-red-500' : 'text-slate-400'}`}>
                  {description.length}/150
                </span>
              </div>
              <textarea
                maxLength={150}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. ${activePlaceholder}`}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold outline-hidden transition-all resize-none text-dark"
              />
            </div>

            {/* Parameters Group: Schedule, Team Size, Bounty Payout */}
            <div className="space-y-2">
              {/* Schedule Section: Date & Time */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl h-[48px] border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] flex items-center overflow-hidden">
                  <div className="flex items-center overflow-x-auto no-scrollbar w-full h-full snap-x snap-mandatory">
                    {datesList.map((d, i) => {
                      const dIso = d.toISOString();
                      const isSelected = day === dIso;
                      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return (
                        <button
                          key={dIso}
                          type="button"
                          onClick={() => setDay(dIso)}
                          style={{ flex: '0 0 50%', minWidth: '50%' }}
                          className={`h-full rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center justify-center border snap-start ${
                            isSelected 
                              ? 'bg-white/95 backdrop-blur-md shadow-xs text-slate-900 border-white/90' 
                              : 'text-slate-500 hover:text-slate-800 border-transparent'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl h-[48px] border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowTimePicker(true)}
                    className="h-full flex items-center justify-center gap-1.5 bg-white/95 backdrop-blur-md shadow-xs border border-white/90 rounded-xl px-3.5 cursor-pointer transition-colors active-scale whitespace-nowrap"
                  >
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-black text-slate-900 leading-none">
                      {hour}:{minute} {ampm}
                    </span>
                  </button>
                </div>
              </div>

              {/* Row 2: People Selection & Bounty Payout in One Line */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {/* Combined Number of People Selection */}
                  <div className="shrink-0 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl h-[48px] border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] flex items-center">
                    <div className="h-full flex items-center gap-1.5 bg-white/95 backdrop-blur-md shadow-xs border border-white/90 rounded-xl px-2.5 text-primary shrink-0">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {peopleNeeded === 1 ? (
                          <User className="w-4 h-4 text-primary" />
                        ) : (
                          <Users className="w-4 h-4 text-primary" />
                        )}
                      </div>

                      {/* Plus / Minus Stepper */}
                      <div className="flex items-center space-x-0.5">
                        <button
                          type="button"
                          onClick={() => setPeopleNeeded(Math.max(1, peopleNeeded - 1))}
                          disabled={peopleNeeded <= 1}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            peopleNeeded <= 1
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-700 hover:bg-slate-100 active-scale cursor-pointer'
                          }`}
                          aria-label="Decrease people"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-4 text-center text-xs font-black text-slate-900 select-none">
                          {peopleNeeded}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPeopleNeeded(Math.min(7, peopleNeeded + 1))}
                          disabled={peopleNeeded >= 7}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            peopleNeeded >= 7
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-700 hover:bg-slate-100 active-scale cursor-pointer'
                          }`}
                          aria-label="Increase people"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                    
                  {/* Bounty Payout Section */}
                  <div className="flex-1 min-w-0 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl h-[48px] border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] flex items-center">
                    <div className="w-full h-full flex items-center gap-2 bg-white/95 backdrop-blur-md shadow-xs border border-white/90 rounded-xl px-3 focus-within:border-primary/50 focus-within:bg-white transition-all">
                      <button
                        type="button"
                        onClick={() => setShowCurrencyPicker(true)}
                        className="flex items-center gap-1 text-primary cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                        title="Change Currency"
                      >
                        <span className="text-sm font-black leading-none">{currency?.symbol || '₹'}</span>
                        <span className="text-[10px] text-slate-500 font-bold leading-none">{currency?.code || 'INR'}</span>
                      </button>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        min="1"
                        placeholder={peopleNeeded > 1 ? "Payout per Person" : "Bounty Amount"}
                        className="w-full bg-transparent border-0 p-0 text-xs font-black outline-hidden text-slate-900 placeholder:text-slate-400 placeholder:font-semibold h-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Split Math Indicator */}
                {amount && parseFloat(amount) > 0 && peopleNeeded > 1 && (
                  <div className="flex items-center justify-between text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-xl px-3 py-2 mt-1">
                    <span>Total Bounty Pool:</span>
                    <span className="font-black">
                      {formatCurrency(parseFloat(amount) * peopleNeeded, currency?.code)} ({formatCurrency(amount, currency?.code)} × {peopleNeeded} Helpers)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

          <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 bg-transparent mt-0 shrink-0 flex flex-col items-center">
            <button
              onClick={handlePost}
              disabled={isPostDisabled}
              className={`w-full max-w-md h-14 flex items-center justify-center space-x-2 font-black rounded-2xl shadow-lg active-scale transition-all cursor-pointer text-sm tracking-wide ${
                isPostDisabled 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-primary hover:bg-primary/95 text-white shadow-primary/25'
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Radio className="w-5 h-5 text-white" />
                  <span>Broadcast Bounty</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {showTimePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowTimePicker(false)}>
          {/* Backdrop: pure opacity fade on its own layer, no translateY, no blur — prevents flash artifact */}
          <div className="absolute inset-0 bg-dark/50 animate-[overlayIn_180ms_ease-out]" />
          {/* Modal card: slides up independently */}
          <div className="relative bg-white rounded-[32px] w-full max-w-xs shadow-2xl overflow-hidden flex flex-col animate-[slideUp_200ms_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 p-6 text-center border-b border-border relative">
              <h3 className="font-semibold text-xs text-gray-500">Select time</h3>
              <div className="text-4xl font-black text-dark mt-2 tracking-tight">
                {hour}:{minute} 
                <span 
                  className="text-xl text-primary cursor-pointer hover:opacity-80 transition-all inline-block ml-1"
                  onClick={() => setAmpm(ampm === 'AM' ? 'PM' : 'AM')}
                >
                  {ampm}
                </span>
              </div>
            </div>
            
            <div className="flex h-56 relative bg-white">
              {/* Selection Highlight */}
              <div className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 bg-gray-50 border-y border-border pointer-events-none"></div>
              
              {/* Hours */}
              <div 
                className="flex-1 overflow-y-auto no-scrollbar relative z-10 snap-y snap-mandatory scroll-smooth"
                onScroll={(e) => handleScroll(e, true)}
              >
                <div style={{ padding: '5.5rem 0' }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                    const val = String(h).padStart(2, '0');
                    return (
                      <div 
                        id={`hour-${val}`}
                        key={`h-${val}`} 
                        onClick={() => handleItemClick(val, true)}
                        className={`h-12 flex items-center justify-center text-xl font-black cursor-pointer transition-all snap-center ${hour === val ? 'text-primary scale-110' : 'text-gray-400 hover:text-dark'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex items-center justify-center z-10 font-black text-2xl text-gray-300">:</div>
              
              {/* Minutes */}
              <div 
                className="flex-1 overflow-y-auto no-scrollbar relative z-10 snap-y snap-mandatory scroll-smooth"
                onScroll={(e) => handleScroll(e, false)}
              >
                <div style={{ padding: '5.5rem 0' }}>
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => {
                    const val = String(m).padStart(2, '0');
                    return (
                      <div 
                        id={`minute-${val}`}
                        key={`m-${val}`} 
                        onClick={() => handleItemClick(val, false)}
                        className={`h-12 flex items-center justify-center text-xl font-black cursor-pointer transition-all snap-center ${minute === val ? 'text-primary scale-110' : 'text-gray-400 hover:text-dark'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-border">
              <button 
                onClick={() => setShowTimePicker(false)} 
                className="w-full bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostJobScreen;
