import React, { useState, useEffect, useRef, useContext } from 'react';
import MapView from './MapView';
import { searchAddress, reverseGeocode } from '../utils/geocoding';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { getCurrentLocation } from '../utils/location';
import { ToastContext } from '../store/ToastContext';

const LocationPicker = ({ initialLat = 17.3850, initialLng = 78.4867, onLocationChange, onLocationError }) => {
  const { showToast } = useContext(ToastContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [currentLat, setCurrentLat] = useState(initialLat);
  const [currentLng, setCurrentLng] = useState(initialLng);
  const [mapKey, setMapKey] = useState(0); // Used to remount map when searching
  
  const [resolvedAddressText, setResolvedAddressText] = useState('Fetching address...');
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    handleReverseGeocode(initialLat, initialLng);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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

  const handleSelectResult = (result) => {
    setSearchQuery(result.displayName);
    setCurrentLat(result.lat);
    setCurrentLng(result.lng);
    setMapKey(prev => prev + 1); // Force map to recenter
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
    setCurrentLat(lat);
    setCurrentLng(lng);
    handleReverseGeocode(lat, lng);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setCurrentLat(loc.lat);
      setCurrentLng(loc.lng);
      setMapKey(prev => prev + 1);
      handleReverseGeocode(loc.lat, loc.lng);
    } catch (e) {
      console.error('Failed to get current location', e);
      if (onLocationError) {
        onLocationError(e);
      } else {
        showToast(e.message || 'Failed to detect location. Please check browser settings.', 'error');
      }
    }
  };

  return (
    <div className="flex flex-col relative w-full h-full rounded-2xl overflow-hidden shadow-inner">
      
      {/* Floating Search Bar */}
      <div className="absolute top-2 left-2 right-12 z-20" ref={dropdownRef}>
        <div className="relative shadow-lg rounded-xl">
          <input 
            type="text" 
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            className="w-full bg-white border-none rounded-xl pl-9 pr-9 py-2 text-xs font-bold text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-all"
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
          key={mapKey}
          center={[currentLat, currentLng]}
          zoom={16}
          draggable={true}
          onDragEnd={handleDragEnd}
          height="100%"
          resolvedAddressText={isGeocoding ? 'Loading...' : resolvedAddressText}
        />
      </div>

      {/* Floating GPS Button */}
      <button 
        onClick={handleUseCurrentLocation}
        className="absolute bottom-2 right-2 z-20 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer border border-gray-100"
        aria-label="Use current location"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
};

export default LocationPicker;
