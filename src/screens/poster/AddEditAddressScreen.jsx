import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, Home, Briefcase, MapPin } from 'lucide-react';
import LocationPicker from '../../components/LocationPicker';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';

const AddEditAddressScreen = () => {
  const { popScreen, addSavedAddress, updateSavedAddress, editAddressData, setEditAddressData, userProfile } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const isEdit = !!editAddressData;

  const [addressType, setAddressType] = useState(isEdit ? editAddressData.type : 'Home'); 
  const [completeAddress, setCompleteAddress] = useState(isEdit ? editAddressData.completeAddress : '');
  const [lat, setLat] = useState(isEdit ? editAddressData.lat : 17.3850);
  const [lng, setLng] = useState(isEdit ? editAddressData.lng : 78.4867);

  const handleLocationChange = (loc) => {
    setCompleteAddress(loc.completeAddress);
    setLat(loc.lat);
    setLng(loc.lng);
  };

  const handleSave = () => {
    if (!completeAddress || completeAddress === 'Fetching address...') {
      showToast('Please wait for the location to resolve.', 'error');
      return;
    }

    // Default contact details from profile, even if they aren't fully filled.
    // The main flow ensures profile completion happens elsewhere if needed.
    const contactName = userProfile?.name && userProfile.name !== 'New User' ? userProfile.name : 'Poster';
    const contactPhone = userProfile?.phone && userProfile.phone !== 'Add Phone' ? userProfile.phone : '';

    const newAddress = {
      type: addressType,
      completeAddress,
      contactName,
      contactPhone,
      lat,
      lng
    };

    if (isEdit) {
      updateSavedAddress(editAddressData.id, newAddress);
      showToast('Location updated successfully!', 'success');
    } else {
      addSavedAddress(newAddress);
      showToast('Location saved successfully!', 'success');
    }
    
    setEditAddressData(null);
    popScreen();
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border bg-white shrink-0 z-30 shadow-sm relative">
        <button 
          onClick={() => { setEditAddressData(null); popScreen(); }}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black text-dark ml-2">{isEdit ? 'Edit Location' : 'Pin Location'}</h2>
      </div>

      {/* Main Map Container */}
      <div className="flex-1 relative w-full bg-gray-100 flex flex-col min-h-0">
        <div className="flex-1 w-full relative">
          <LocationPicker 
            initialLat={lat}
            initialLng={lng}
            onLocationChange={handleLocationChange}
          />
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30 pt-4 px-5 pb-5 shrink-0 relative flex flex-col space-y-4">
        
        {/* Address Type Selector */}
        <div>
          <h3 className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2 text-center">Save Location As</h3>
          <div className="flex space-x-2 max-w-sm mx-auto w-full">
            <button 
              onClick={() => setAddressType('Home')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all ${addressType === 'Home' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Home className="w-4 h-4 mr-1.5" />
              <span className="text-xs font-bold">Home</span>
            </button>
            <button 
              onClick={() => setAddressType('Work')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all ${addressType === 'Work' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Briefcase className="w-4 h-4 mr-1.5" />
              <span className="text-xs font-bold">Work</span>
            </button>
            <button 
              onClick={() => setAddressType('Other')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all ${addressType === 'Other' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <MapPin className="w-4 h-4 mr-1.5" />
              <span className="text-xs font-bold">Other</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          className="w-full flex items-center justify-center bg-primary hover:bg-primary/95 text-white py-3.5 rounded-xl shadow-lg shadow-primary/20 font-black tracking-wide cursor-pointer active:scale-[0.99] transition-all text-sm"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
};

export default AddEditAddressScreen;
