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
            onLocationGranted={handleLocationGranted}
          />
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30 pt-4 px-5 pb-5 shrink-0 relative flex flex-col space-y-4">

        {/* Landmark Input */}
        <div>
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Nearest Landmark</label>
          <input
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="e.g. Near Metro Station, Beside Mall"
            className="w-full px-4 py-3 border border-border rounded-xl text-sm font-semibold text-dark placeholder-gray-400 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

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
