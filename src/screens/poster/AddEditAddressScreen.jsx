import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, Home, Briefcase, MapPin, User, Phone, Edit2, CheckCircle2 } from 'lucide-react';
import Tooltip from '../../components/Tooltip';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';

const AddEditAddressScreen = () => {
  const { popScreen, savedAddresses, setSavedAddresses, userProfile, setUserProfile } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [contactMode, setContactMode] = useState('myself'); // 'myself' | 'someone_else'
  const [addressType, setAddressType] = useState('Home'); // 'Home' | 'Work' | 'Other'

  // Form states
  const [city, setCity] = useState('Jalandhar');
  const [area, setArea] = useState('LPU');
  const [completeAddress, setCompleteAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  
  useEffect(() => {
    if (userProfile && !editedName && !editedPhone) {
      setEditedName(userProfile.name === 'New User' ? '' : userProfile.name);
      setEditedPhone(userProfile.phone === 'Add Phone' ? '' : userProfile.phone);
    }
  }, [userProfile]);

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

  const handleReceiverPhoneChange = (e) => {
    const formattedPhoneNumber = formatPhone(e.target.value);
    setReceiverPhone(formattedPhoneNumber);
  };

  const handleSave = async () => {
    if (!area || !completeAddress) {
      showToast('Area and complete address are required', 'error');
      return;
    }


    let contactName = '';
    let contactPhone = '';

    if (contactMode === 'myself') {
      contactName = editedName.trim() || 'New User';
      contactPhone = editedPhone.trim() || 'Add Phone';
      
      const updates = {};
      if (contactName !== userProfile?.name) updates.name = contactName;
      if (contactPhone !== userProfile?.phone) updates.phone = contactPhone;
      
      if (Object.keys(updates).length > 0) {
        const res = await setUserProfile({ ...userProfile, ...updates });
        if (res && res.success === false) {
          showToast(res.error, 'error');
          return;
        }
      }
    } else {
      contactName = receiverName.trim();
      contactPhone = receiverPhone.trim();
    }

    if (!contactName || !contactPhone) {
      showToast('Contact details are required', 'error');
      return;
    }

    const newAddress = {
      id: Date.now().toString(),
      type: addressType,
      city,
      area,
      completeAddress,
      landmark,
      contactName,
      contactPhone,
      isDefault: savedAddresses.length === 0, // make default if it's the first one
      lat: 17.3850,
      lng: 78.4867
    };

    setSavedAddresses([...savedAddresses, newAddress]);
    showToast('Address saved successfully!', 'success');
    popScreen();
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border bg-white sticky top-0 z-10 shrink-0">
        <button 
          onClick={popScreen}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black text-dark ml-2">Add New Address</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28 space-y-8">
        
        {/* Address Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-dark tracking-wide">ADDRESS DETAILS</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">City</label>
              <input 
                type="text" 
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                placeholder="E.g. Hyderabad"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Area / Street *</label>
              <input 
                type="text" 
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                placeholder="E.g. Kukatpally, KPHB Phase 3"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Complete Address *</label>
              <textarea 
                value={completeAddress}
                onChange={(e) => setCompleteAddress(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors resize-none"
                placeholder="House No, Building Name, Floor"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Landmark (Optional)</label>
              <input 
                type="text" 
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                placeholder="Near which famous place?"
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-dark tracking-wide">CONTACT DETAILS</h3>
          
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

          {contactMode === 'myself' ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                <div className="flex items-center space-x-2">
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
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Receiver Name</label>
                <input 
                  type="text" 
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Receiver Phone</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="tel" 
                    value={receiverPhone}
                    onChange={handleReceiverPhoneChange}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark transition-colors focus:outline-none focus:border-primary focus:bg-white"
                    placeholder="123-456-7890"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Address Type */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-dark tracking-wide">SAVE ADDRESS AS</h3>
          
          <div className="flex space-x-3">
            <button 
              onClick={() => setAddressType('Home')}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${addressType === 'Home' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Home className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-bold">Home</span>
            </button>
            <button 
              onClick={() => setAddressType('Work')}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${addressType === 'Work' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Briefcase className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-bold">Work</span>
            </button>
            <button 
              onClick={() => setAddressType('Other')}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${addressType === 'Other' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <MapPin className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-bold">Other</span>
            </button>
          </div>
        </div>

      </div>

      {/* Sticky Bottom CTA */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-20">
        <button 
          onClick={handleSave}
          className="w-full flex items-center justify-center bg-primary hover:bg-primary/95 text-white py-4 rounded-2xl shadow-lg font-black tracking-wide cursor-pointer active:scale-[0.99] transition-all"
        >
          Save Address
        </button>
      </div>
    </div>
  );
};

export default AddEditAddressScreen;
