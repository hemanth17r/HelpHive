import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import LocationPicker from './LocationPicker';
import { MapPin, Navigation, Home, Briefcase, Compass, X, ArrowLeft, Loader2 } from 'lucide-react';
import { getCurrentLocation } from '../utils/location';
import { reverseGeocode } from '../utils/geocoding';

const POPULAR_CITIES = [
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 }
];

const LocationSelectorModal = () => {
  const {
    userLocation,
    changeLocation,
    isLocationModalOpen,
    setLocationModalOpen,
    showBlinkitPrompt,
    setShowBlinkitPrompt,
    savedAddresses,
    realLocation
  } = useContext(AppContext);

  const { showToast } = useContext(ToastContext);

  const [view, setView] = useState('prompt'); // 'prompt' | 'manual'
  const [isDetecting, setIsDetecting] = useState(false);

  // States to drive the LocationPicker remounting
  const [pickerLat, setPickerLat] = useState(12.9716); // Default to Bengaluru
  const [pickerLng, setPickerLng] = useState(77.5946);
  const [pickerKey, setPickerKey] = useState(0);

  // Holds the resolved address details during manual selection
  const [tempLocation, setTempLocation] = useState(null);

  // Decide if the modal is currently visible
  const isOpen = showBlinkitPrompt || isLocationModalOpen;

  // Decide if the modal can be closed by the user
  // If the user has no location saved yet, they MUST select one (non-dismissible)
  const isDismissible = userLocation !== null && !showBlinkitPrompt;

  useEffect(() => {
    if (isOpen) {
      if (showBlinkitPrompt) {
        setView('prompt');
      } else {
        setView('manual');
      }

      // Initialize picker coordinates
      const startLat = userLocation?.lat || realLocation?.lat || 12.9716;
      const startLng = userLocation?.lng || realLocation?.lng || 77.5946;
      setPickerLat(startLat);
      setPickerLng(startLng);
      setPickerKey(prev => prev + 1);
      setTempLocation(userLocation);
    }
  }, [isOpen, showBlinkitPrompt, userLocation]);

  if (!isOpen) return null;

  const handleEnableLocation = async () => {
    setIsDetecting(true);
    try {
      const coords = await getCurrentLocation();
      const details = await reverseGeocode(coords.lat, coords.lng);
      if (details) {
        const resolved = {
          id: 'detected',
          name: details.displayName,
          lat: details.lat,
          lng: details.lng
        };
        await changeLocation(resolved);
        showToast('Location detected successfully!', 'success');
        setLocationModalOpen(false);
      } else {
        showToast('Failed to resolve address. Please try manual selection.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Location access denied or failed.', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectCity = (city) => {
    setPickerLat(city.lat);
    setPickerLng(city.lng);
    setPickerKey(prev => prev + 1);
    
    const resolved = {
      id: 'city_quick',
      name: `${city.name}, India`,
      lat: city.lat,
      lng: city.lng
    };
    setTempLocation(resolved);
  };

  const handleSelectAddress = (address) => {
    const resolved = {
      id: address.id || 'address_saved',
      name: address.completeAddress,
      lat: address.lat,
      lng: address.lng
    };
    changeLocation(resolved);
    showToast(`Switched to address: ${address.type}`, 'success');
    setLocationModalOpen(false);
  };

  const handleConfirmManualLocation = () => {
    if (!tempLocation || tempLocation.name === 'Fetching address...' || tempLocation.name === 'Unknown Location') {
      showToast('Please wait for the location to resolve on the map.', 'error');
      return;
    }
    changeLocation(tempLocation);
    showToast('Location set successfully!', 'success');
    setLocationModalOpen(false);
  };

  const handleClose = () => {
    if (isDismissible) {
      setLocationModalOpen(false);
      setShowBlinkitPrompt(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-[fadeIn_200ms_ease-in-out]">
      {/* Backdrop click (only if dismissible) */}
      <div className="absolute inset-0" onClick={handleClose} />

      {view === 'prompt' ? (
        /* HelpHive style Location Permission Not Enabled Prompt */
        <div className="relative bg-white text-dark rounded-[32px] w-full max-w-sm shadow-2xl p-6 text-center flex flex-col items-center border border-border animate-[scaleUp_250ms_ease-in-out]">
          
          {/* Circular Pin Slash Icon */}
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 mt-4 border border-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
              <line x1="3" y1="3" x2="21" y2="21" className="stroke-red-500 stroke-[3px]" />
            </svg>
          </div>

          <h3 className="text-xl font-black mb-2.5">Location permission not enabled</h3>
          <p className="text-sm text-gray-500 font-semibold px-4 mb-8 leading-relaxed">
            Please enable location permission for a better delivery experience
          </p>

          <button
            onClick={handleEnableLocation}
            disabled={isDetecting}
            className="w-full bg-primary hover:bg-primary/95 disabled:bg-primary/70 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer mb-3.5 flex items-center justify-center space-x-2 text-sm"
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Detecting location...</span>
              </>
            ) : (
              <span>Enable device location</span>
            )}
          </button>

          <button
            onClick={() => setView('manual')}
            className="w-full bg-transparent hover:bg-light-gray text-gray-500 hover:text-dark font-black py-3.5 rounded-2xl transition-all cursor-pointer text-sm"
          >
            Select location manually
          </button>
        </div>
      ) : (
        /* Manual Map & Autocomplete Picker Mode */
        <div className="relative bg-white rounded-[32px] w-full max-w-lg h-[90vh] md:h-[80vh] shadow-2xl flex flex-col overflow-hidden animate-[scaleUp_250ms_ease-in-out]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white shrink-0 relative z-30 shadow-xs">
            <div className="flex items-center space-x-3">
              {showBlinkitPrompt && (
                <button
                  onClick={() => setView('prompt')}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
                  aria-label="Back to prompt"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="text-lg font-black text-dark">Choose Location</h3>
            </div>
            {isDismissible && (
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-dark transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Map & Search Container */}
          <div className="flex-1 min-h-0 relative z-10">
            <LocationPicker
              key={pickerKey}
              initialLat={pickerLat}
              initialLng={pickerLng}
              onLocationChange={(loc) => {
                setTempLocation({
                  id: 'custom',
                  name: loc.completeAddress,
                  lat: loc.lat,
                  lng: loc.lng
                });
              }}
            />
          </div>

          {/* Bottom Panel */}
          <div className="bg-white border-t border-border p-5 shrink-0 z-30 flex flex-col space-y-4 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] max-h-[45%] overflow-y-auto no-scrollbar">
            
            {/* Current GPS Location button inside manual view */}
            <button
              onClick={handleEnableLocation}
              disabled={isDetecting}
              className="flex items-center justify-between w-full p-3.5 bg-orange-50/50 hover:bg-orange-50 border border-orange-100 rounded-2xl text-left cursor-pointer transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3 text-primary">
                <Navigation className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-sm font-black">Use Current Location</div>
                  <div className="text-xs text-gray-500 font-semibold mt-0.5">Detect location using device GPS</div>
                </div>
              </div>
              {isDetecting && <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />}
            </button>

            {/* Saved Addresses Section */}
            {savedAddresses && savedAddresses.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-gray-400 tracking-wider uppercase mb-2">Saved Addresses</h4>
                <div className="flex flex-col space-y-2">
                  {savedAddresses.slice(0, 3).map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className="flex items-start space-x-3 p-3 bg-light-gray hover:bg-orange-50/30 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-orange-100"
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-border">
                        {addr.type === 'Home' ? (
                          <Home className="w-4 h-4 text-primary" />
                        ) : addr.type === 'Work' ? (
                          <Briefcase className="w-4 h-4 text-primary" />
                        ) : (
                          <MapPin className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-dark">{addr.type}</div>
                        <div className="text-[11px] font-semibold text-gray-400 truncate mt-0.5">{addr.completeAddress}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Cities in India */}
            <div>
              <h4 className="text-[10px] font-black text-gray-400 tracking-wider uppercase mb-2">Popular Cities</h4>
              <div className="flex flex-wrap gap-2">
                {POPULAR_CITIES.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => handleSelectCity(city)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-border bg-white hover:bg-orange-50 hover:border-orange-200 transition-colors text-xs font-extrabold text-gray-600 hover:text-primary cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>{city.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Selection Button */}
            <div className="pt-2">
              <button
                onClick={handleConfirmManualLocation}
                className="w-full bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer text-sm"
              >
                Confirm Location
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelectorModal;
