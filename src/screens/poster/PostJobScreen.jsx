import React, { useState, useContext, useRef } from 'react';
import { ArrowLeft, Minus, Plus, IndianRupee, Radio, Info, Calendar, MapPin, Home, Briefcase, Wifi } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';
import LocationPicker from '../../components/LocationPicker';
import { ToastContext } from '../../store/ToastContext';
import { evaluateMarketplaceMaturity } from '../../utils/marketplaceMaturity';
import { api } from '../../services/api';
const PostJobScreen = () => {
  const { userLocation, postJob, popScreen, editJobData, setEditJobData, savedAddresses, addSavedAddress, userProfile, setUserProfile, realLocation, setRealLocation } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const [selectedSkillId, setSelectedSkillId] = useState(editJobData?.skillId || '');
  const [description, setDescription] = useState(editJobData?.description || '');
  const [peopleNeeded, setPeopleNeeded] = useState(editJobData?.peopleNeeded || 1);
  const [amount, setAmount] = useState(editJobData?.amount ? String(editJobData.amount) : '');
  
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
  const currentSkill = SKILLS.find(s => s.id === selectedSkillId) || SKILLS[0];
  const activeExamples = currentSkill?.examples || ['Describe your task here'];

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
      lat: address.lat || realLocation?.lat || 12.9352, 
      lng: address.lng || realLocation?.lng || 77.6245 
    };
    setIsLoading(true);
    const result = await postJob({
      id: editJobData?.id,
      skillId: selectedSkillId,
      description: description,
      peopleNeeded: peopleNeeded,
      amount: parsedAmount,
      day: day,
      time: time,
      posterName: userProfile?.posterName || userProfile?.name || 'You',
      lat: coords.lat,
      lng: coords.lng,
      address: address
    });
    setIsLoading(false);
    if (!result || !result.success) {
      showToast(result?.error || 'Failed to post task. Please try again.', 'error');
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
    <div className="flex-1 flex flex-col justify-between bg-white px-6 pt-3 pb-8 lg:pt-4 lg:px-8 overflow-hidden select-none">
      
      {/* Header */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-3 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (maturityInfo && !maturityInfo.isActive) {
                setSelectedSkillId('');
              } else {
                popScreen();
              }
            }}
            className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
            Post a Task
          </span>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Selected Location Banner */}
      {selectedJobLocation && (
        <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full mb-3 shrink-0">
          <div className="px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setShowAddressPopup(true)}>
            <div className="flex items-center space-x-3 mr-4">
              <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                <MapPin className="w-4 h-4 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Task Location</p>
                <p className="text-xs font-black text-dark line-clamp-1 mt-0.5">
                  {selectedJobLocation.completeAddress?.startsWith('Location at') && selectedJobLocation.landmark 
                    ? selectedJobLocation.landmark 
                    : selectedJobLocation.completeAddress}
                </p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-orange-600 bg-white px-2 py-1 rounded-md shadow-sm border border-orange-100 shrink-0">Change</button>
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
          <h2 className="text-2xl font-black text-dark mb-3">Not Active Here Yet</h2>
          <p className="text-sm font-semibold text-gray-500 mb-8 max-w-xs">
            We don't have enough taskers for <strong className="text-dark">{currentSkill?.label}</strong> near this location yet. Join the waitlist to be notified!
          </p>
          
          {isWaitlisted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 w-full max-w-xs">
              <p className="font-black text-green-700 text-lg mb-1">You're on the list!</p>
              <p className="text-xs font-bold text-green-600/80">
                {waitlistCount} {waitlistCount === 1 ? 'person is' : 'people are'} waiting in this area. We'll alert you soon.
              </p>
            </div>
          ) : (
            <button 
              onClick={handleJoinWaitlist}
              disabled={isLoading}
              className="w-full max-w-xs flex items-center justify-center space-x-2 bg-dark hover:bg-dark/90 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-[0.99] transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>Join Waitlist</span>
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
            
            {/* Category Section */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-black text-dark tracking-tight mb-1">
                  What kind of help do you need?
                </h2>
              </div>

              {/* Physical & On-site Section */}
              {showPhysical && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 px-1">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium text-slate-700 tracking-wide">
                      On-site & Physical Services
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 max-w-md mx-auto">
                    {SKILLS.filter(s => s.type === 'physical').map((skill) => {
                      const isSelected = selectedSkillId === skill.id;
                      return (
                        <IconLabel
                          key={skill.id}
                          icon={skill.icon}
                          label={skill.label}
                          selected={isSelected}
                          onClick={() => setSelectedSkillId(prev => prev === skill.id ? '' : skill.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Online & Remote Section */}
              {showRemote && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 px-1">
                    <Wifi className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium text-slate-700 tracking-wide">
                      Online & Remote Services
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 max-w-md mx-auto">
                    {SKILLS.filter(s => s.type === 'remote').map((skill) => {
                      const isSelected = selectedSkillId === skill.id;
                      return (
                        <IconLabel
                          key={skill.id}
                          icon={skill.icon}
                          label={skill.label}
                          selected={isSelected}
                          onClick={() => setSelectedSkillId(prev => prev === skill.id ? '' : skill.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-dark tracking-tight mb-1">
                  Describe what you need
                </h2>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Description
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
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-dark tracking-tight mb-1">
                  When do you need it?
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 overflow-hidden">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Date
                  </label>
                  <div className="flex overflow-x-auto no-scrollbar bg-gray-100 p-1 rounded-xl h-[52px] snap-x">
                    {datesList.map((d, i) => {
                      const dIso = d.toISOString();
                      const isSelected = day === dIso;
                      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return (
                        <button
                          key={dIso}
                          type="button"
                          onClick={() => setDay(dIso)}
                          className={`shrink-0 px-4 rounded-lg text-sm font-bold transition-all cursor-pointer snap-start ${
                            isSelected ? 'bg-white shadow-xs text-dark' : 'text-gray-500 hover:text-dark'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Time
                  </label>
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => setShowTimePicker(true)}
                      className="flex items-center justify-center bg-gray-50 border border-border hover:border-primary hover:bg-white rounded-xl px-2 h-[52px] flex-1 cursor-pointer transition-all"
                    >
                      <span className="text-sm font-black text-dark">
                        {hour}:{minute}
                      </span>
                    </button>
                    
                    <div className="flex bg-gray-100 p-1 rounded-xl h-[52px] shrink-0">
                      <button
                        type="button"
                        onClick={() => setAmpm('AM')}
                        className={`px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          ampm === 'AM' ? 'bg-white shadow-xs text-dark' : 'text-gray-500 hover:text-dark'
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmpm('PM')}
                        className={`px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          ampm === 'PM' ? 'bg-white shadow-xs text-dark' : 'text-gray-500 hover:text-dark'
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* People & Payout Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-dark tracking-tight mb-1">
                  People & Payout
                </h2>
                <div className="bg-orange-50/50 border border-primary/10 rounded-xl p-3 flex items-center space-x-2 mt-2">
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[10px] font-semibold text-gray-500 leading-tight">
                    <strong className="text-dark font-black">Note:</strong> Payout is for service only. Excludes cost of any items involved.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Helpers Needed
                  </label>
                  <div className="flex items-center justify-between bg-gray-50 border border-border rounded-xl p-1.5 w-full">
                    <Tooltip text="Decrease crew count">
                      <button type="button" onClick={decrementPeople} className="p-2.5 rounded-lg bg-white border border-border hover:bg-gray-50 active:scale-95 text-gray-500 cursor-pointer">
                        <Minus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <span className="text-base font-black text-dark">{peopleNeeded}</span>
                    <Tooltip text="Increase crew count">
                      <button type="button" onClick={incrementPeople} className="p-2.5 rounded-lg bg-white border border-border hover:bg-gray-50 active:scale-95 text-gray-500 cursor-pointer">
                        <Plus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Payout Per Helper (₹)
                  </label>
                  <div className="flex items-center bg-gray-50 border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                    <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
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
                      placeholder="Amount"
                      className="w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-1 bg-white mt-2 shrink-0 flex justify-center">
            <button
              onClick={handlePost}
              disabled={isPostDisabled}
              className={`w-full max-w-md h-14 flex items-center justify-center space-x-2 font-black rounded-2xl shadow-lg active:scale-[0.99] transition-all cursor-pointer text-base ${
                isPostDisabled 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-primary hover:bg-primary/95 text-white shadow-primary/20'
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Radio className="w-5 h-5 text-white" />
                  <span>Post</span>
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
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-widest">Select Time</h3>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={handleClosePopup}>
          {/* Backdrop: pure opacity fade on its own layer — no translateY, no blur animation */}
          {/* This prevents the camera-flash tile artifact caused by animating backdrop-blur */}
          <div className="absolute inset-0 bg-dark/50 animate-[overlayIn_180ms_ease-out]" />
          {/* Modal card: slides up independently on its own composited layer */}
          <div className="relative bg-white rounded-[32px] w-full max-w-sm max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-[slideUp_200ms_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border relative flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm text-dark tracking-wide">{!isAddingNewAddress ? 'Pick the task location' : 'Add a new task location'}</h3>
              <button onClick={handleClosePopup} className="text-gray-400 hover:text-dark text-xl leading-none">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {!isAddingNewAddress ? (
                <div className="space-y-4">
                  {savedAddresses.map((address) => (
                    <div 
                      key={address.id}
                      onClick={() => handleSelectExistingAddress(address)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${address.isDefault ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-white'}`}
                    >
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-black text-dark uppercase">{address.type || 'Location'}</h4>
                            {address.isDefault && <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 rounded-sm uppercase tracking-wider">Default</span>}
                          </div>
                          <p className="text-xs font-semibold text-gray-500 mt-1 line-clamp-2">
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
                    className="w-full py-3 mt-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 text-sm font-bold transition-all flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add a new task location</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col space-y-4">
                  <div className="h-[35vh] min-h-[200px] relative rounded-2xl overflow-hidden border border-border">
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
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400">Nearest Landmark</label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Community Center, opposite park"
                      className="bg-white border border-border focus:border-primary rounded-xl px-3 h-10 w-full text-xs font-semibold outline-none text-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Save Location As</label>
                    <div className="flex space-x-2 w-full">
                      <button 
                        type="button"
                        onClick={() => setAddressType('Home')}
                        className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer transition-all ${addressType === 'Home' ? 'border-primary bg-primary/5 text-primary shadow-sm font-bold' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Home className="w-3.5 h-3.5 mr-1" />
                        <span className="text-[10px]">Home</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAddressType('Work')}
                        className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer transition-all ${addressType === 'Work' ? 'border-primary bg-primary/5 text-primary shadow-sm font-bold' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Briefcase className="w-3.5 h-3.5 mr-1" />
                        <span className="text-[10px]">Work</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAddressType('Other')}
                        className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer transition-all ${addressType === 'Other' ? 'border-primary bg-primary/5 text-primary shadow-sm font-bold' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        <span className="text-[10px]">Other</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isAddingNewAddress && (
              <div className="p-4 bg-white border-t border-border shrink-0">
                <button 
                  onClick={handleSaveAddressAndPost} 
                  disabled={isSavingAddress}
                  className="w-full flex justify-center items-center gap-2 bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70"
                >
                  {isSavingAddress ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  <span>{isSavingAddress ? 'Saving...' : 'Save & Continue'}</span>
                </button>
                {savedAddresses.length > 0 && (
                  <button 
                    onClick={() => setIsAddingNewAddress(false)}
                    className="w-full py-3 mt-2 text-sm font-bold text-gray-500 hover:text-dark transition-colors"
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
