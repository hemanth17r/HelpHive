import React, { useState, useContext, useRef, useMemo } from 'react';
import { ArrowLeft, Minus, Plus, IndianRupee, Radio, Info, Calendar, Clock, MapPin, Home, Briefcase, Wifi, X, Target, Trophy, Crown, Search, Zap, Check, HeartHandshake, Users, Flame, Globe } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS, SUB_SKILL_TAGS, GAME_SKILLS, HERO_DISCIPLINES, searchGameSkills } from '../../config/constants';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';
import LocationPicker from '../../components/LocationPicker';
import { ToastContext } from '../../store/ToastContext';
import { evaluateMarketplaceMaturity } from '../../utils/marketplaceMaturity';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

const PostJobScreen = () => {
  const { userLocation, postJob, popScreen, editJobData, setEditJobData, savedAddresses, addSavedAddress, userProfile, setUserProfile, realLocation, setRealLocation, userId, openLoginModal, currency, setShowCurrencyPicker } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const [selectedSkillId, setSelectedSkillId] = useState(editJobData?.skillId || '');
  const [selectedTags, setSelectedTags] = useState(editJobData?.skillTags || []);
  const [description, setDescription] = useState(editJobData?.description || '');
  const [peopleNeeded, setPeopleNeeded] = useState(editJobData?.peopleNeeded || 1);
  const [amount, setAmount] = useState(editJobData?.amount ? String(editJobData.amount) : '');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('all');
  const [questRarity, setQuestRarity] = useState('standard'); // 'standard' | 'legendary' | 'volunteer'
  
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
    if (editJobData && editJobData.expiresAt) {
      const d = new Date(editJobData.expiresAt);
      d.setHours(0,0,0,0);
      return d.toISOString();
    }
    return datesList[0].toISOString();
  });

  const [hour, setHour] = useState(() => {
    if (editJobData && editJobData.expiresAt) {
      let h = new Date(editJobData.expiresAt).getHours() % 12;
      if (h === 0) h = 12;
      return String(h).padStart(2, '0');
    }
    let h = new Date().getHours() % 12;
    if (h === 0) h = 12;
    return String(h).padStart(2, '0');
  });

  const [minute, setMinute] = useState(() => {
    if (editJobData && editJobData.expiresAt) {
      return String(new Date(editJobData.expiresAt).getMinutes()).padStart(2, '0');
    }
    return String(new Date().getMinutes()).padStart(2, '0');
  });

  const [ampm, setAmpm] = useState(() => {
    if (editJobData && editJobData.expiresAt) {
      return new Date(editJobData.expiresAt).getHours() >= 12 ? 'PM' : 'AM';
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

  const filteredGameSkills = useMemo(() => {
    let list = GAME_SKILLS;
    if (selectedDisciplineId !== 'all') {
      list = list.filter(s => s.disciplineId === selectedDisciplineId);
    }
    if (skillSearchQuery.trim()) {
      const q = skillSearchQuery.trim().toLowerCase();
      list = list.filter(s => 
        s.label.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.aliases?.some(a => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedDisciplineId, skillSearchQuery]);

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

  // Address Popup States
  // Address Popup States
  const [selectedJobLocation, setSelectedJobLocation] = useState(editJobData?.address || null);
  const [showAddressPopup, setShowAddressPopup] = useState(() => !editJobData?.address);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(() => savedAddresses.length === 0);
  const isAddressInitializedRef = useRef(false);

  React.useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !isAddressInitializedRef.current) {
      setIsAddingNewAddress(false);
      
      // Auto-select the default address (or first address) on initialization
      if (!selectedJobLocation) {
        const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
        setSelectedJobLocation(defaultAddr);
        setShowAddressPopup(false);
      }
      
      isAddressInitializedRef.current = true;
    }
  }, [savedAddresses, selectedJobLocation]);

  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [completeAddress, setCompleteAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressType, setAddressType] = useState('Home');
  // Initialize map center using the best available location context.
  // Priority: explicit GPS → user's location header → saved default address → India center
  const INDIA_CENTER_LAT = 20.5937;
  const INDIA_CENTER_LNG = 78.9629;
  const _defaultAddr = Array.isArray(savedAddresses) && savedAddresses.length > 0
    ? (savedAddresses.find(a => a.isDefault) || savedAddresses[0])
    : null;
  const [lat, setLat] = useState(
    realLocation?.lat || userLocation?.lat || _defaultAddr?.lat || INDIA_CENTER_LAT
  );
  const [lng, setLng] = useState(
    realLocation?.lng || userLocation?.lng || _defaultAddr?.lng || INDIA_CENTER_LNG
  );
  // Use posterName/posterPhone role-specific fields as the address contact details.
  // These are separate from the generic name/phone and are set per-role in the tasker profile.
  const [contactName, setContactName] = useState(userProfile?.posterName || userProfile?.name || '');
  const [contactPhone, setContactPhone] = useState(userProfile?.posterPhone || userProfile?.phone || '');

  React.useEffect(() => {
    if (!contactName && !contactPhone) {
      const pName = userProfile?.posterName || userProfile?.name || '';
      const pPhone = userProfile?.posterPhone || userProfile?.phone || '';
      setContactName(pName);
      setContactPhone(pPhone);
    }
    // Keep map center in sync if GPS becomes available after mount.
    // Only update if we're still showing the India fallback (meaning no real location was
    // available at mount time). This avoids overriding a user-dragged pin.
    setLat(prev => prev === INDIA_CENTER_LAT ? (realLocation?.lat || userLocation?.lat || INDIA_CENTER_LAT) : prev);
    setLng(prev => prev === INDIA_CENTER_LNG ? (realLocation?.lng || userLocation?.lng || INDIA_CENTER_LNG) : prev);
  }, [userProfile, realLocation, userLocation]);

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

  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.slice(0, 10);
    
    let formatted = val;
    if (val.length > 6) {
      formatted = `${val.slice(0, 3)} ${val.slice(3, 6)} ${val.slice(6)}`;
    } else if (val.length > 3) {
      formatted = `${val.slice(0, 3)} ${val.slice(3)}`;
    }
    
    setContactPhone(formatted);
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
    if (peopleNeeded < 5) setPeopleNeeded(peopleNeeded + 1);
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
      setShowAddressPopup(true);
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
    const allTags = gameSkill 
      ? Array.from(new Set([gameSkill.label, ...(selectedTags || [])]))
      : selectedTags;

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
    }
  };

  const handleSaveAddressAndPost = async () => {
    if (!completeAddress || completeAddress === 'Fetching address...') {
      showToast('Please wait for the location to resolve.', 'error');
      return;
    }
    if (!landmark.trim()) {
      showToast('Please enter the nearest landmark.', 'error');
      return;
    }

    setIsSavingAddress(true);

    try {
      const finalContactName = userProfile?.posterName || (userProfile?.name && userProfile.name !== 'New User' ? userProfile.name : 'Poster');
      const finalContactPhone = userProfile?.posterPhone || (userProfile?.phone && userProfile.phone !== 'Add Phone' ? userProfile.phone : '');

      const newAddress = {
        type: addressType,
        completeAddress,
        landmark: landmark.trim(),
        contactName: finalContactName,
        contactPhone: finalContactPhone,
        isDefault: savedAddresses.length === 0,
        lat: lat,
        lng: lng
      };

      let savedAddr;
      if (addSavedAddress) {
        savedAddr = await addSavedAddress(newAddress);
      } else {
        savedAddr = { ...newAddress, id: Date.now().toString() };
      }
      
      setSelectedJobLocation(savedAddr);
      setShowAddressPopup(false);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSelectExistingAddress = (address) => {
    setSelectedJobLocation(address);
    setShowAddressPopup(false);
  };

  const handleClosePopup = () => {
    if (!selectedJobLocation) {
      popScreen();
    } else {
      setShowAddressPopup(false);
    }
  };

  const parsedAmount = parseFloat(amount);
  const isPostDisabled = !selectedSkillId || amount === '' || isNaN(parsedAmount) || parsedAmount < 0 || !time || isLoading;

  const selectedSkill = SKILLS.find(s => s.id === selectedSkillId);
  const showPhysical = !selectedSkill || selectedSkill.type === 'physical';
  const showRemote = !selectedSkill || selectedSkill.type === 'remote';

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#F8FAFC] px-4 pt-2 pb-8 lg:pt-4 lg:px-8 overflow-hidden select-none">
      
      {/* Header */}
      <div 
        className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-2 shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
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
      {selectedJobLocation && (
        <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-3 shrink-0">
          <div 
            className="px-4 py-3 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl flex items-center justify-between cursor-pointer active-scale shadow-2xs hover:border-primary/50 transition-all" 
            onClick={() => setShowAddressPopup(true)}
          >
            <div className="flex items-center space-x-3 mr-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-100/70 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary">Drop Coordinates</p>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {selectedJobLocation.completeAddress?.startsWith('Location at') && selectedJobLocation.landmark 
                    ? selectedJobLocation.landmark 
                    : selectedJobLocation.completeAddress}
                </p>
              </div>
            </div>
            <button className="text-[11px] font-black text-primary bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200/60 shrink-0 cursor-pointer">
              Change
            </button>
          </div>
        </div>
      )}

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
          <div className="flex-1 overflow-y-auto w-full pb-4 pr-1">
            {/* Centered inner form content */}
            <div className="space-y-8 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left pt-2">
            
            {/* Quest Hero Talent Section */}
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight mb-0.5">
                  Select Required Hero Talent
                </h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Specify the skill your quest requires from the Realm
                </p>
              </div>

              {/* Instant Skill Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={skillSearchQuery}
                  onChange={(e) => setSkillSearchQuery(e.target.value)}
                  placeholder="Search required talent (e.g. Drone, Chef, IKEA, Reels)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition-all shadow-inner"
                />
                {skillSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSkillSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Horizontal Discipline Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedDisciplineId('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedDisciplineId === 'all'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  All Disciplines
                </button>
                {HERO_DISCIPLINES.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDisciplineId(d.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedDisciplineId === d.id
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {d.shortTitle}
                  </button>
                ))}
              </div>

              {/* Skills Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredGameSkills.map((skill) => {
                  const isSelected = selectedSkillId === skill.id || selectedSkillId === skill.categoryId;
                  const SkillIcon = skill.icon || Zap;

                  return (
                    <div
                      key={skill.id}
                      onClick={() => {
                        setSelectedSkillId(prev => prev === skill.id ? '' : skill.id);
                        setSelectedTags([]);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                        isSelected
                          ? 'bg-orange-50/80 border-primary shadow-xs ring-1 ring-primary/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <SkillIcon className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-900 text-xs tracking-tight truncate leading-snug">
                              {skill.label}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5 leading-none">
                              {skill.tagline}
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100/80">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none">
                          {skill.type === 'remote' ? (
                            <>
                              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="leading-none">Remote Op</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="leading-none">Physical Raid</span>
                            </>
                          )}
                        </span>
                        {skill.isHighDemand && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-black tracking-wide leading-none bg-orange-50/90 px-1.5 py-0.5 rounded-md border border-orange-200/60">
                            <Flame className="w-3 h-3 text-orange-500 shrink-0 fill-orange-500/30" />
                            <span className="leading-none">High Demand</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredGameSkills.length === 0 && (
                  <div className="col-span-full p-4 rounded-2xl bg-orange-50/80 border border-orange-200 text-center space-y-2.5 my-2">
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center mx-auto shadow-xs">
                      <Zap className="w-5 h-5 fill-white/20" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs">
                        No standard skill for "{skillSearchQuery}"
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        Broadcast this bounty as a Custom Op with your custom tag.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSkillId('custom_physical_op');
                          const cleanTag = skillSearchQuery.trim().replace(/^#/, '');
                          if (cleanTag && !selectedTags.includes(cleanTag)) {
                            setSelectedTags(prev => [...prev, cleanTag]);
                          }
                        }}
                        className="px-3.5 py-2 bg-primary hover:bg-primary/95 text-white font-black text-xs rounded-xl shadow-xs transition-all active-scale cursor-pointer inline-flex items-center space-x-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white/20" />
                        <span>Custom Physical Op</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSkillId('custom_remote_op');
                          const cleanTag = skillSearchQuery.trim().replace(/^#/, '');
                          if (cleanTag && !selectedTags.includes(cleanTag)) {
                            setSelectedTags(prev => [...prev, cleanTag]);
                          }
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-xs transition-all active-scale cursor-pointer inline-flex items-center space-x-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white/20" />
                        <span>Custom Remote Op</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Skill / Equipment Tag Chips */}
              {selectedSkillId && (
                <div className="p-3.5 bg-orange-50/40 border border-orange-100/70 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Target Equipment &amp; Sub-Skill Tags
                    </span>
                    {selectedTags.length > 0 && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {selectedTags.length} tagged
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(SUB_SKILL_TAGS[currentSkill?.categoryId || currentSkill?.id] || ['Standard Specs', 'Priority Dispatch', 'Special Gear']).map((tag) => {
                      const isTagSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isTagSelected
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:bg-orange-50/50'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quest Rarity Tier Selector */}
            <div className="space-y-3 pt-1">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Quest Rarity Tier
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Defines the urgency and reward prestige on the Quest Radar
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestRarity('standard')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questRarity === 'standard'
                      ? 'bg-orange-50/90 border-primary ring-1 ring-primary/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <Target className="w-4 h-4 mx-auto mb-1 text-primary stroke-[2.2]" />
                  <p className="text-xs font-black text-slate-900 leading-tight">Standard</p>
                  <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Regular Quest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestRarity('legendary')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questRarity === 'legendary'
                      ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400/40 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <Trophy className="w-4 h-4 mx-auto mb-1 text-amber-600 stroke-[2.2]" />
                  <p className="text-xs font-black text-amber-900 leading-tight">Legendary</p>
                  <span className="text-[9px] font-bold text-amber-600 block mt-0.5">Gold Bounty</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestRarity('volunteer')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questRarity === 'volunteer'
                      ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-400/40 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4 mx-auto mb-1 text-teal-600 stroke-[2.2]" />
                  <p className="text-xs font-black text-teal-900 leading-tight">Volunteer</p>
                  <span className="text-[9px] font-bold text-teal-600 block mt-0.5">Community Aid</span>
                </button>
              </div>
            </div>

            {/* Description Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-dark tracking-tight mb-1">
                  Mission Directives & Briefing
                </h2>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-gray-600">
                    Directives & Scope
                  </label>
                  <span className={`text-[10px] font-bold ${description.length > 130 ? 'text-red-500' : 'text-gray-400'}`}>
                    {description.length}/150
                  </span>
                </div>
                <textarea
                  maxLength={150}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`e.g. ${activePlaceholder}`}
                  className="w-full bg-gray-50 border border-border focus:border-primary focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold outline-hidden transition-all resize-none text-dark"
                />
              </div>
            </div>

            {/* When do you need it? Section */}
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-black text-dark tracking-tight">
                  Deployment Window
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 overflow-hidden">
                  <label className="block text-xs font-extrabold text-slate-500">
                    Date
                  </label>
                  <div className="flex items-center overflow-x-auto no-scrollbar bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl h-[48px] border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)] snap-x">
                    {datesList.map((d, i) => {
                      const dIso = d.toISOString();
                      const isSelected = day === dIso;
                      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return (
                        <button
                          key={dIso}
                          type="button"
                          onClick={() => setDay(dIso)}
                          className={`shrink-0 px-3.5 h-full rounded-xl text-xs font-black transition-all cursor-pointer snap-start flex items-center justify-center ${
                            isSelected 
                              ? 'bg-white/95 backdrop-blur-md shadow-xs text-slate-900 border border-white/90' 
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-500">
                    Time
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTimePicker(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-primary/80 focus:border-primary rounded-2xl px-3 h-[48px] cursor-pointer transition-all shadow-2xs active-scale"
                  >
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-black text-slate-900 leading-none">
                      {hour}:{minute}
                    </span>
                    <span className="text-xs font-black text-primary bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200/60 leading-none inline-flex items-center">
                      {ampm}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Squad Format & Bounty Section (Solo vs Strike Team) */}
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-black text-dark tracking-tight mb-1">
                  Squad Format & Bounty Pool
                </h2>
                <div className="bg-orange-50/70 border border-orange-200/60 rounded-2xl p-3 flex items-start gap-2 mt-1.5">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 font-black">Contract Guarantee:</strong> Bounty is settled directly to each operative upon physical OTP verification.
                  </p>
                </div>
              </div>

              {/* Squad Format Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-200/50 backdrop-blur-xl p-1 rounded-2xl border border-white/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)]">
                <button
                  type="button"
                  onClick={() => setPeopleNeeded(1)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active-scale ${
                    peopleNeeded === 1
                      ? 'bg-white/95 backdrop-blur-md text-primary shadow-xs border border-white/90'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Solo Op (1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPeopleNeeded(Math.max(2, peopleNeeded))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active-scale ${
                    peopleNeeded > 1
                      ? 'bg-white/95 backdrop-blur-md text-primary shadow-xs border border-white/90'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Strike Team ({peopleNeeded > 1 ? peopleNeeded : 2})</span>
                </button>
              </div>

              {/* Strike Team Slot Selector (if > 1) */}
              {peopleNeeded > 1 && (
                <div className="bg-orange-50/50 border border-orange-200/60 rounded-2xl p-3.5 space-y-2 animate-[fadeIn_150ms_ease-out]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-dark">Strike Team Size</span>
                    <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                      {peopleNeeded} Slots Open
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5, 6].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPeopleNeeded(num)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          peopleNeeded === num
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-white text-gray-600 border border-border hover:border-gray-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Bounty Input & Split Math */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-600">
                    {peopleNeeded > 1 ? 'Bounty / Operative' : 'Bounty Payout'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(true)}
                    className="text-[11px] font-black text-primary hover:underline cursor-pointer flex items-center space-x-1"
                  >
                    <span>{currency?.flag} {currency?.code}</span>
                  </button>
                </div>

                <div className="flex items-center bg-white border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 rounded-2xl px-3.5 w-full h-[50px] shadow-2xs transition-all">
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(true)}
                    className="mr-2 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-black text-slate-700 cursor-pointer shrink-0 transition-colors"
                    title="Change Currency"
                  >
                    {currency?.symbol || '₹'}
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
                    min="0"
                    placeholder={peopleNeeded > 1 ? "Payout / Operative" : "Total Bounty Amount"}
                    className="w-full bg-transparent border-0 px-1 py-2 text-sm font-black outline-hidden text-slate-900 h-full"
                  />
                </div>

                {/* Live Split Math Indicator */}
                {amount && parseFloat(amount) > 0 && peopleNeeded > 1 && (
                  <div className="flex items-center justify-between text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-xl px-3 py-2 mt-1">
                    <span>Total Bounty Pool:</span>
                    <span className="font-black">
                      {formatCurrency(parseFloat(amount) * peopleNeeded, currency?.code)} ({formatCurrency(amount, currency?.code)} × {peopleNeeded} Ops)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

          <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-2 bg-transparent mt-2 shrink-0 flex justify-center">
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

      {showAddressPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleClosePopup}>
          {/* Backdrop: pure opacity fade on its own layer — no translateY, no blur animation */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-[overlayIn_180ms_ease-out]" />
          {/* Modal card: slides up independently on its own composited layer */}
          <div className="relative bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm sm:max-w-lg max-h-[90vh] shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col animate-[slideUp_200ms_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 relative flex items-center justify-between shrink-0">
              <h3 className="font-black text-sm text-slate-900 tracking-tight">{!isAddingNewAddress ? 'Set Drop Coordinates' : 'Add New Drop Coordinates'}</h3>
              <button onClick={handleClosePopup} className="p-1.5 -mr-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-0 pb-0">
              {!isAddingNewAddress ? (
                <div className="pt-4 pb-4 space-y-3">
                  {savedAddresses.map((address) => (
                    <div 
                      key={address.id} 
                      onClick={() => handleSelectExistingAddress(address)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${address.isDefault ? 'border-primary bg-orange-50/60 shadow-xs' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-100/80 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-black text-slate-900">{address.type || 'Drop Point'}</h4>
                            {address.isDefault && <span className="text-[9px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-md">Primary Base</span>}
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                            {address.completeAddress?.startsWith('Location at') && address.landmark 
                              ? address.landmark 
                              : address.completeAddress}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setIsAddingNewAddress(true)}
                    className="w-full py-3.5 mt-2 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/60 text-slate-600 hover:text-primary text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer active-scale"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Drop Coordinates</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="h-[200px] sm:h-[240px] mt-4 mb-4 relative rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                    <LocationPicker 
                      initialLat={lat}
                      initialLng={lng}
                      onLocationChange={(loc) => {
                        setCompleteAddress(loc.completeAddress);
                        setLat(loc.lat);
                        setLng(loc.lng);
                      }}
                      onLocationGranted={(coords) => setRealLocation(coords)}
                    />
                  </div>
                  <div className="space-y-4 mb-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-600">Nearest landmark</label>
                      <input
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="e.g. Near Community Center, opposite park"
                        className="bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-xl px-3.5 h-11 w-full text-xs font-bold outline-none text-slate-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-600 mb-1.5">Save location as</label>
                      <div className="flex space-x-2 w-full">
                        <button 
                          type="button"
                          onClick={() => setAddressType('Home')}
                          className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Home' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
                        >
                          <Home className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">Home</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setAddressType('Work')}
                          className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Work' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
                        >
                          <Briefcase className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">Work</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setAddressType('Other')}
                          className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Other' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
                        >
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">Other</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isAddingNewAddress && (
              <div className="px-6 pt-3 pb-4 bg-white shrink-0 flex flex-col items-center w-full space-y-2 border-t border-slate-100">
                <button 
                  onClick={handleSaveAddressAndPost} 
                  disabled={isSavingAddress}
                  className="w-full flex justify-center items-center gap-2 bg-primary hover:bg-primary/95 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-primary/25 active-scale transition-all cursor-pointer disabled:opacity-70 text-sm"
                >
                  {isSavingAddress ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  <span>{isSavingAddress ? 'Saving...' : 'Save & Continue'}</span>
                </button>
                {savedAddresses.length > 0 && (
                  <button 
                    onClick={() => setIsAddingNewAddress(false)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostJobScreen;
