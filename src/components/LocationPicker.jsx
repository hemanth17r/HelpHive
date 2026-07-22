import React, { useState, useEffect, useRef, useContext } from 'react';
import MapView from './MapView';
import { searchAddress, reverseGeocode } from '../utils/geocoding';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { getCurrentLocation } from '../utils/location';
import { ToastContext } from '../store/ToastContext';

/**
 * LocationPicker
 *
 * Props:
 *   initialLat / initialLng  — starting map center (required)
 *   onLocationChange(loc)    — called whenever the selected location changes
 *                              loc = { lat, lng, completeAddress }
 *   onLocationError(err)     — optional; overrides default toast on GPS errors
 *   onLocationGranted(coords)— optional; called when the user explicitly taps
 *                              the GPS button AND we successfully obtain coords.
 *                              Useful for the parent to persist realLocation.
 */
const LocationPicker = ({
  initialLat = 20.5937,  // Geographic center of India
  initialLng = 78.9629,
  onLocationChange,
  onLocationError,
  onLocationGranted
}) => {
  const { showToast } = useContext(ToastContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [currentLat, setCurrentLat] = useState(initialLat);
  const [currentLng, setCurrentLng] = useState(initialLng);
  const [mapZoom, setMapZoom] = useState(() => (
    Math.abs(initialLat - 20.5937) < 0.01 && Math.abs(initialLng - 78.9629) < 0.01 ? 5 : 16
  ));

  const [resolvedAddressText, setResolvedAddressText] = useState('Fetching address...');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false); // Loading state for GPS button

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Initial reverse geocode for the starting position
  useEffect(() => {
    handleReverseGeocode(initialLat, initialLng);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether we've already applied the async parent update once.
  const hasAppliedAsyncCenter = useRef(false);

  // If the parent updates initialLat/initialLng after mount (e.g. async fallback
  // resolution in AddEditAddressScreen), recenter the map once.
  useEffect(() => {
    if (hasAppliedAsyncCenter.current) return;
    if (initialLat === currentLat && initialLng === currentLng) return; // No change yet

    hasAppliedAsyncCenter.current = true;
    setCurrentLat(initialLat);
    setCurrentLng(initialLng);
    if (Math.abs(initialLat - 20.5937) > 0.01 || Math.abs(initialLng - 78.9629) > 0.01) {
      setMapZoom(16);
    }
    handleReverseGeocode(initialLat, initialLng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setIsSearching(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 800); // 800ms debounce
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectResult(searchResults[0]);
      } else if (searchQuery.trim().length >= 3) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setIsSearching(true);
        const results = await searchAddress(searchQuery.trim());
        setIsSearching(false);
        if (results && results.length > 0) {
          handleSelectResult(results[0]);
        }
      }
    }
  };

  const handleSelectResult = (result) => {
    setSearchQuery(result.displayName);
    setCurrentLat(result.lat);
    setCurrentLng(result.lng);
    setMapZoom(16);
    setShowDropdown(false);
    setResolvedAddressText(result.displayName);

    if (onLocationChange) {
      onLocationChange({ lat: result.lat, lng: result.lng, completeAddress: result.displayName });
    }
  };

  async function handleReverseGeocode(lat, lng) {
    setIsGeocoding(true);
    setResolvedAddressText('Fetching address...');

    const result = await reverseGeocode(lat, lng);
    setIsGeocoding(false);

    const displayName = result?.displayName && result.displayName !== 'Unknown Location'
      ? result.displayName
      : `Location at ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;

    setSearchQuery(displayName);
    setResolvedAddressText(displayName);

    if (onLocationChange) {
      onLocationChange({ lat, lng, completeAddress: displayName });
    }
  }

  const handleDragEnd = ({ lat, lng }) => {
    hasAppliedAsyncCenter.current = true;
    setCurrentLat(lat);
    setCurrentLng(lng);
    handleReverseGeocode(lat, lng);
  };

  // Called ONLY when the user explicitly taps "Use my location".
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getCurrentLocation();
      setCurrentLat(loc.lat);
      setCurrentLng(loc.lng);
      setMapZoom(16);
      handleReverseGeocode(loc.lat, loc.lng);

      // Notify parent so it can persist realLocation for future use
      if (onLocationGranted) {
        onLocationGranted(loc);
      }
    } catch (e) {
      console.error('Failed to get current location', e);
      if (onLocationError) {
        onLocationError(e);
      } else {
        showToast(e.message || 'Failed to detect location. Please check browser settings.', 'error');
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="flex flex-col relative w-full h-full rounded-2xl overflow-hidden shadow-inner">

      {/* Floating Search Bar */}
      <div className="absolute top-3 left-3 sm:left-4 max-w-[320px] sm:max-w-[400px] w-[calc(100%-80px)] z-20" ref={dropdownRef}>
        <div className="relative shadow-lg rounded-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            className="w-full bg-white border border-border rounded-xl pl-9 pr-9 py-2 text-xs font-bold text-dark focus:outline-none focus:border-primary transition-all"
            placeholder="Search for your location..."
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          )}
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectResult(result)}
                className="p-3.5 border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors flex items-start space-x-3"
              >
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs font-semibold text-dark line-clamp-2 leading-relaxed">
                  {result.displayName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The Map itself */}
      <div className="w-full h-full flex-1 relative z-10">
        <MapView
          center={[currentLat, currentLng]}
          zoom={mapZoom}
          draggable={true}
          onDragEnd={handleDragEnd}
          height="100%"
          resolvedAddressText={isGeocoding ? 'Loading...' : resolvedAddressText}
        />
      </div>

      {/* GPS Button — placed in the bottom right corner as a circular button */}
      <button
        onClick={handleUseCurrentLocation}
        disabled={isLocating}
        className="absolute bottom-5 right-4 z-20 w-10 h-10 flex items-center justify-center bg-white text-primary rounded-full shadow-lg hover:bg-orange-50/50 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none"
        title="Use my current location"
        aria-label="Use my current location"
      >
        {isLocating
          ? <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
          : <Navigation className="w-5 h-5 text-primary shrink-0" />
        }
      </button>
    </div>
  );
};

export default LocationPicker;
