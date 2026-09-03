import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, Home, Briefcase, MapPin } from 'lucide-react';
import LocationPicker from '../../components/LocationPicker';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';

// Geographic center of India — used only as a last resort when we have zero
// location context. Far better than a city-specific hardcoded default.
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

/**
 * Silently resolves the best initial map center without triggering any
 * browser permission dialog.
 *
 * Priority:
 *  1. realLocation  — already-captured GPS coords (e.g. from tasker side or
 *                     a previous explicit grant this session)
 *  2. savedAddresses default — the user's own pinned address; most relevant
 *  3. Permissions API silent check — if permission is already 'granted',
 *     fetch coords silently (no prompt, no popup)
 *  4. INDIA_CENTER — geographic center; far less jarring than a specific city
 */
async function resolveSilentCenter(realLocation, savedAddresses) {
  // 1. Already have GPS coords in session
  if (realLocation?.lat && realLocation?.lng) {
    return { lat: realLocation.lat, lng: realLocation.lng };
  }

  // 2. User has a pinned default address
  if (Array.isArray(savedAddresses) && savedAddresses.length > 0) {
    const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
    if (defaultAddr?.lat && defaultAddr?.lng) {
      return { lat: defaultAddr.lat, lng: defaultAddr.lng };
    }
  }

  // 3. Silently use GPS only if permission is already granted (no popup)
  if (navigator.geolocation && navigator.permissions?.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'granted') {
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
          );
        });
        return coords;
      }
    } catch {
      // Permissions API or GPS unavailable — fall through to default
    }
  }

  // 4. Last resort — geographic center of India
  return INDIA_CENTER;
}

const AddEditAddressScreen = () => {
  const {
    popScreen,
    addSavedAddress,
    updateSavedAddress,
    editAddressData,
    setEditAddressData,
    userProfile,
    realLocation,
    savedAddresses = [],
    setRealLocation
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const isEdit = !!editAddressData;

  const [addressType, setAddressType] = useState(isEdit ? editAddressData.type : 'Home');
  const [completeAddress, setCompleteAddress] = useState(isEdit ? editAddressData.completeAddress : '');
  const [landmark, setLandmark] = useState(isEdit ? (editAddressData.landmark || '') : '');

  // For edit mode, start at the saved coords. For add mode, start with the
  // best available fallback while the async resolver runs in the background.
  const editCoords = isEdit
    ? { lat: editAddressData.lat, lng: editAddressData.lng }
    : null;

  const [lat, setLat] = useState(editCoords?.lat ?? (realLocation?.lat ?? INDIA_CENTER.lat));
  const [lng, setLng] = useState(editCoords?.lng ?? (realLocation?.lng ?? INDIA_CENTER.lng));

  // On mount in "add" mode: silently resolve the best center without any popup.
  // We run this only once. If the silent check yields a better position than
  // the initial render value, we update the map center via the key-based
  // remount in LocationPicker (by updating lat/lng, which are passed as
  // initialLat/initialLng props).
  useEffect(() => {
    if (isEdit) return; // Edit mode already has precise coords — nothing to do

    let cancelled = false;
    resolveSilentCenter(realLocation, savedAddresses).then(coords => {
      if (cancelled) return;
      setLat(coords.lat);
      setLng(coords.lng);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  const handleLocationChange = (loc) => {
    setCompleteAddress(loc.completeAddress);
    setLat(loc.lat);
    setLng(loc.lng);
  };

  // Called by LocationPicker when the user explicitly taps the GPS button and
  // we get real coordinates back. Store them in AppContext so they can be
  // reused for map centering elsewhere in the session.
  const handleLocationGranted = (coords) => {
    setRealLocation(coords);
  };

  const handleSave = () => {
    if (!completeAddress || completeAddress === 'Fetching address...') {
      showToast('Please wait for the location to resolve.', 'error');
      return;
    }

    if (!landmark.trim()) {
      showToast('Please enter a landmark.', 'error');
      return;
    }

    const contactName = userProfile?.name && userProfile.name !== 'New User' ? userProfile.name : 'Poster';
    const contactPhone = userProfile?.phone && userProfile.phone !== 'Add Phone' ? userProfile.phone : '';

    const newAddress = {
      type: addressType,
      completeAddress,
      landmark: landmark.trim(),
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
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full relative z-20 overflow-hidden select-none">
      {/* Frameless Top Header */}
      <div 
        className="flex items-center justify-between px-4 pb-2 pt-3 bg-transparent shrink-0 z-30 max-w-md lg:max-w-xl mx-auto w-full"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={() => { setEditAddressData(null); popScreen(); }}
          className="p-2 -ml-2 rounded-full hover:bg-slate-200/60 text-slate-700 transition-colors cursor-pointer active-scale"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
          {isEdit ? 'Edit Location' : 'Pin Drop Location'}
        </h2>
        <div className="w-9" />
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-md lg:max-w-xl mx-auto w-full flex flex-col min-h-0 px-4 pb-6 space-y-3 overflow-y-auto no-scrollbar">
        {/* Map Card */}
        <div className="flex-1 relative w-full rounded-[28px] overflow-hidden border border-slate-200 shadow-2xs min-h-[300px] sm:min-h-[380px] bg-white">
          <LocationPicker
            initialLat={lat}
            initialLng={lng}
            onLocationChange={handleLocationChange}
            onLocationGranted={handleLocationGranted}
          />
        </div>

        {/* Bottom Form Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-[28px] border border-slate-200/80 shadow-xs p-4 sm:p-5 shrink-0 space-y-4">
          {/* Landmark Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-600 block">Nearest landmark</label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Metro Station, Beside Mall"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          {/* Address Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-600 block text-center">Save location as</label>
            <div className="flex space-x-2 w-full">
              <button
                type="button"
                onClick={() => setAddressType('Home')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Home' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
              >
                <Home className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Home</span>
              </button>
              <button
                type="button"
                onClick={() => setAddressType('Work')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Work' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
              >
                <Briefcase className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Work</span>
              </button>
              <button
                type="button"
                onClick={() => setAddressType('Other')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer transition-all active-scale ${addressType === 'Other' ? 'border-primary bg-primary/10 text-primary shadow-xs font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 font-bold'}`}
              >
                <MapPin className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Other</span>
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full flex items-center justify-center bg-primary hover:bg-primary/95 text-white py-3.5 rounded-2xl shadow-lg shadow-primary/25 font-black tracking-wide cursor-pointer active-scale transition-all text-xs uppercase"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEditAddressScreen;
