import React, { useState, useContext, useRef } from 'react';
import { ArrowLeft, Minus, Plus, IndianRupee, Send, Info, Calendar } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../data/mockData';
import Tooltip from '../../components/Tooltip';
import { ToastContext } from '../../store/ToastContext';
const PostJobScreen = () => {
  const { userLocation, postJob, popScreen, editJobData, setEditJobData, saveDraftJob, savedAddresses, setSavedAddresses, userProfile, setUserProfile, realLocation } = useContext(AppContext);
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

  // Address Popup States
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [contactMode, setContactMode] = useState('myself');
  const [city, setCity] = useState('Jalandhar');
  const [area, setArea] = useState('LPU');
  const [completeAddress, setCompleteAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [receiverName, setReceiverName] = useState(userProfile?.posterName || userProfile?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(userProfile?.posterPhone || userProfile?.phone || '');

  React.useEffect(() => {
    if (contactMode === 'myself') {
      const pName = userProfile?.posterName || userProfile?.name || '';
      const pPhone = userProfile?.posterPhone || userProfile?.phone || '';
      setReceiverName(pName);
      setReceiverPhone(pPhone);
    } else {
      setReceiverName('');
      setReceiverPhone('');
    }
  }, [contactMode, userProfile]);

  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.slice(0, 10);
    
    let formatted = val;
    if (val.length > 6) {
      formatted = `${val.slice(0, 3)} ${val.slice(3, 6)} ${val.slice(6)}`;
    } else if (val.length > 3) {
      formatted = `${val.slice(0, 3)} ${val.slice(3)}`;
    }
    
    setReceiverPhone(formatted);
  };

  // Draft Saving Logic
  const formStateRef = useRef({ selectedSkillId, description, peopleNeeded, amount, day, time });
  React.useEffect(() => {
    formStateRef.current = { selectedSkillId, description, peopleNeeded, amount, day, time };
  }, [selectedSkillId, description, peopleNeeded, amount, day, time]);

  const isPostedRef = useRef(false);

  React.useEffect(() => {
    return () => {
      // Clean up edit mode if unmounted without posting
      if (!isPostedRef.current && (formStateRef.current.selectedSkillId || formStateRef.current.description || formStateRef.current.amount)) {
        saveDraftJob({
          id: editJobData?.id,
          skillId: formStateRef.current.selectedSkillId,
          description: formStateRef.current.description,
          peopleNeeded: formStateRef.current.peopleNeeded,
          amount: parseFloat(formStateRef.current.amount) || 0,
          day: formStateRef.current.day,
          time: formStateRef.current.time,
        });
      }
      if (editJobData) setEditJobData(null);
    };
  }, [editJobData, setEditJobData, saveDraftJob]);

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
    if (!selectedSkillId) return;
    const parsedAmount = parseFloat(amount);
    if (amount === '' || isNaN(parsedAmount) || parsedAmount < 0) return;

    setShowAddressPopup(true);
  };

  const submitJob = (address) => {
    const parsedAmount = parseFloat(amount);
    const coords = { 
      lat: realLocation?.lat || address.lat || 12.9352, 
      lng: realLocation?.lng || address.lng || 77.6245 
    };
    setIsLoading(true);
    isPostedRef.current = true;
    setTimeout(() => {
      setIsLoading(false);
      postJob({
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
    }, 1000); // Simulate network delay
  };

  const handleSaveAddressAndPost = () => {
    if (!area || !completeAddress) {
      showToast('Area and complete address are required', 'error');
      return;
    }

    if (!receiverName || !receiverPhone) {
      showToast('Contact details are required', 'error');
      return;
    }

    // Update global profile if in 'myself' mode
    if (contactMode === 'myself') {
      const rawPhone = receiverPhone.replace(/\D/g, '');
      setUserProfile({ ...userProfile, name: receiverName, phone: rawPhone });
    }

    const newAddress = {
      id: Date.now().toString(),
      type: 'Other',
      city,
      area,
      completeAddress,
      landmark,
      contactName: receiverName,
      contactPhone: receiverPhone,
      isDefault: true,
      lat: 17.3850 + (Math.random() * 0.01),
      lng: 78.4867 + (Math.random() * 0.01)
    };

    setSavedAddresses([...savedAddresses, newAddress]);
    setShowAddressPopup(false);
    submitJob(newAddress);
  };

  const parsedAmount = parseFloat(amount);
  const isPostDisabled = !selectedSkillId || amount === '' || isNaN(parsedAmount) || parsedAmount < 0 || !time || isLoading;

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 overflow-hidden select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <button
          onClick={popScreen}
          className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
          Post a Job
        </span>
        <div className="w-10"></div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-8 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left overflow-y-auto pb-4 pr-1">
        
        {/* Category Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-dark tracking-tight mb-1">
              What kind of help do you need?
            </h2>
          </div>
          {/* Responsive 3x3 category grid */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {SKILLS.map((skill) => {
              const isSelected = selectedSkillId === skill.id;
              const Icon = skill.icon;
              return (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                  className={`flex flex-col items-center justify-center w-full aspect-square rounded-2xl transition-all cursor-pointer border ${
                    isSelected 
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                      : 'bg-gray-50 border-border text-gray-500 hover:bg-orange-50 hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  <Icon className="w-7 h-7 mb-1" />
                  <span className={`text-[10px] font-black truncate w-full px-1 text-center ${isSelected ? 'text-white' : 'text-dark'}`}>
                    {skill.shortLabel || skill.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
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
              placeholder="e.g. Need 2 people to move boxes from 3rd floor to ground floor."
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
                Total Payout (₹)
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

      {/* Button footer */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 border-t border-border bg-white mt-4 shrink-0">
        <button
          onClick={handlePost}
          disabled={isPostDisabled}
          className={`w-full flex items-center justify-center space-x-2 font-black py-4 px-6 rounded-2xl shadow-lg active:scale-[0.99] transition-all cursor-pointer ${
            isPostDisabled 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
              : 'bg-primary hover:bg-primary/95 text-white shadow-primary/20'
          }`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Post Job Now</span>
            </>
          )}
        </button>
      </div>

      {showTimePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/40 backdrop-blur-xs animate-[fadeIn_200ms_ease-in-out]" onClick={() => setShowTimePicker(false)}>
          <div className="bg-white rounded-[32px] w-full max-w-xs shadow-2xl overflow-hidden flex flex-col animate-[slideUp_200ms_ease-in-out]" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/40 backdrop-blur-xs animate-[fadeIn_200ms_ease-in-out]">
          <div className="bg-white rounded-[32px] w-full max-w-sm max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-[slideUp_200ms_ease-in-out]">
            <div className="p-5 border-b border-border relative flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm text-dark tracking-wide">Add Address</h3>
              <button onClick={() => setShowAddressPopup(false)} className="text-gray-400 hover:text-dark text-xl leading-none">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">City</label>
                  <input 
                    type="text" 
                    value={city}
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Area / Street *</label>
                  <input 
                    type="text" 
                    value={area}
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Complete Address *</label>
                  <textarea 
                    value={completeAddress}
                    onChange={(e) => setCompleteAddress(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors resize-none"
                    placeholder="House No, Building Name"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-gray-100">
                <h3 className="text-xs font-black text-dark tracking-wide">CONTACT DETAILS</h3>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setContactMode('myself')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${contactMode === 'myself' ? 'bg-white shadow-sm text-dark' : 'text-gray-500 hover:text-dark'}`}
                  >
                    For Myself
                  </button>
                  <button 
                    onClick={() => setContactMode('someone_else')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${contactMode === 'someone_else' ? 'bg-white shadow-sm text-dark' : 'text-gray-500 hover:text-dark'}`}
                  >
                    Someone Else
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <input 
                      type="text" 
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                      placeholder="Name"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="tel" 
                      value={receiverPhone}
                      onChange={handlePhoneChange}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                      placeholder="123-456-7890"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-border shrink-0">
              <button 
                onClick={handleSaveAddressAndPost} 
                className="w-full bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostJobScreen;
