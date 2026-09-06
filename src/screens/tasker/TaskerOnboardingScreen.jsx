import React, { useState, useContext, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Search, Loader2, Navigation, Wifi, Flame, Zap } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { SKILLS } from '../../config/constants';
import SkillPicker from '../../components/SkillPicker';
import { MARKETPLACE_RULES } from '../../config/marketplaceRules';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';
import MapView from '../../components/MapView';
import LocationPicker from '../../components/LocationPicker';
import { api } from '../../services/api';
import { searchAddress, reverseGeocode } from '../../utils/geocoding';
import { getCurrentLocation, INDIA_CENTER } from '../../utils/location';

const TaskerOnboardingScreen = () => {
  const { setUserProfile, pushScreen, popScreen, userProfile, requireProfile, routeParams, userId, realLocation } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  const [step, setStep] = useState(() => routeParams?.editServiceAreaOnly ? 2 : 1); // 1: Skills, 2: Service Area
  const [selectedSkills, setSelectedSkills] = useState(userProfile?.skills || []);
  const [isLoading, setIsLoading] = useState(false);
  
  // Service Area state — initialise from the tasker's own saved profile data.
  // Do NOT use the global `userLocation` which is the hirer-side location state.
  const [coverageLevel, setCoverageLevel] = useState(userProfile?.coverageLevel || 'nearby');
  const [coverageRadius, setCoverageRadius] = useState(userProfile?.coverageRadius || 5000);
  const [serviceAreaLocation, setServiceAreaLocation] = useState(() => {
    if (userProfile?.serviceAreaLat && userProfile?.serviceAreaLng) {
      return { lat: userProfile.serviceAreaLat, lng: userProfile.serviceAreaLng };
    }
    return realLocation || INDIA_CENTER; // Default to real location or India center
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Auto-detect location on step 2 if not set yet (only if permission is already granted)
  useEffect(() => {
    if (step === 2 && (!userProfile?.serviceAreaLat || !userProfile?.serviceAreaLng)) {
      const detectLocation = async () => {
        let locationDetected = false;
        if (navigator.geolocation && navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
              const loc = await getCurrentLocation();
              setServiceAreaLocation(loc);
              const geoResult = await reverseGeocode(loc.lat, loc.lng);
              if (geoResult) setSearchQuery(geoResult.displayName);
              locationDetected = true;
            }
          } catch (e) {
            console.warn('Geolocation permission query failed:', e);
          }
        }
        
        if (!locationDetected) {
          try {
            const geoResult = await reverseGeocode(serviceAreaLocation.lat, serviceAreaLocation.lng);
            if (geoResult) setSearchQuery(geoResult.displayName);
          } catch (e) {
            console.error('Failed reverse geocoding default location:', e);
          }
        }
      };
      
      detectLocation();
    } else if (step === 2 && userProfile?.serviceAreaName) {
      setSearchQuery(userProfile.serviceAreaName);
    }
  }, [step, userProfile]);

  // Click outside listener for search autocomplete dropdown
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
    setServiceAreaLocation({ lat: result.lat, lng: result.lng });
    setShowDropdown(false);
  };

  const handleUseCurrentLocation = async () => {
    console.log('[GPS Clicked] Starting location detection...');
    setIsLocating(true);
    try {
      const loc = await getCurrentLocation();
      console.log('[GPS Resolved] Coordinates fetched:', loc);
      
      console.log('[GPS State Update] Setting service area location to:', loc);
      setServiceAreaLocation({ lat: loc.lat, lng: loc.lng });
      
      console.log('[GPS Geocoding] Starting reverse geocoding for:', loc);
      const result = await reverseGeocode(loc.lat, loc.lng);
      console.log('[GPS Geocoding Completed] Result:', result);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      console.error('[GPS Error] Failed to get current location:', e);
      showToast('Location permission denied or unavailable.', 'error');
    } finally {
      setIsLocating(false);
      console.log('[GPS Completed] Locator spinner stopped.');
    }
  };

  const handleDragEnd = async (pos) => {
    setServiceAreaLocation(pos);
    try {
      const result = await reverseGeocode(pos.lat, pos.lng);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      console.error('Failed to reverse geocode on marker drag', e);
    }
  };

  // Set default coverage based on selected skills when moving to step 2
  useEffect(() => {
    if (step === 2 && selectedSkills.length > 0 && !userProfile?.coverageLevel) {
      let maxRadius = 5000;
      let defaultLevel = 'nearby';
      
      selectedSkills.forEach(skillId => {
        const defaultLevelId = MARKETPLACE_RULES.CATEGORY_DEFAULTS[skillId] || 'local';
        const levelData = Object.values(MARKETPLACE_RULES.COVERAGE_LEVELS).find(l => l.id === defaultLevelId);
        if (levelData && levelData.radiusMeters > maxRadius) {
          maxRadius = levelData.radiusMeters;
          defaultLevel = defaultLevelId;
        }
      });
      
      setCoverageLevel(defaultLevel);
      setCoverageRadius(maxRadius);
    }
  }, [step, selectedSkills, userProfile]);

  const handleCoverageSelect = (levelId) => {
    const levelData = Object.values(MARKETPLACE_RULES.COVERAGE_LEVELS).find(l => l.id === levelId);
    if (levelData) {
      setCoverageLevel(levelId);
      setCoverageRadius(levelData.radiusMeters);
    }
  };

  const handleToggleSkill = (skillId) => {
    if (selectedSkills.includes(skillId)) {
      setSelectedSkills(selectedSkills.filter(id => id !== skillId));
    } else {
      setSelectedSkills([...selectedSkills, skillId]);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (selectedSkills.length === 0) {
        alert('Please select at least one skill task you can do');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      handleComplete();
    }
  };

  const handleComplete = () => {
    const performUpdate = async () => {
      setIsLoading(true);
      try {
        // Reverse-geocode the pin location using our cached utility
        let areaName = null;
        try {
          const result = await reverseGeocode(serviceAreaLocation.lat, serviceAreaLocation.lng);
          if (result) {
            const geo = result.address;
            areaName = geo?.suburb || geo?.village || geo?.town ||
                       geo?.city_district || geo?.city ||
                       geo?.county || geo?.state || result.displayName || null;
          }
        } catch (geoErr) {
          console.warn('Reverse geocode failed, skipping area name:', geoErr);
        }

        const result = await setUserProfile({
          skills: selectedSkills,
          coverageLevel: coverageLevel,
          coverageRadius: coverageRadius,
          categoryCoverage: {},
          serviceAreaName: areaName || `${serviceAreaLocation.lat.toFixed(4)}, ${serviceAreaLocation.lng.toFixed(4)}`,
          locationStr: `POINT(${serviceAreaLocation.lng} ${serviceAreaLocation.lat})`
        });

        // Analytics: V2 Marketplace Metric
        api.logEvent('coverage_area_defined', {
          userId: userProfile?.id || 'guest',
          role: 'tasker',
          level: coverageLevel,
          radius: coverageRadius,
          lat: serviceAreaLocation.lat,
          lng: serviceAreaLocation.lng
        });
        if (result && result.success === false) {
          showToast(result.error || 'Failed to save settings. Please try again.', 'error');
          return;
        }
        showToast('Settings saved successfully!', 'success');
        popScreen();
      } catch (err) {
        console.error('Failed to save skills and service area:', err);
        showToast('Failed to save settings. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (!userId) {
      performUpdate();
    } else {
      requireProfile(performUpdate);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-8 bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            if (step === 2 && !routeParams?.editServiceAreaOnly) setStep(1);
            else popScreen();
          }}
          className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
          {step === 1 ? 'Claimer Classes' : 'Sector Perimeter'}
        </span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col justify-start max-w-md lg:max-w-3xl lg:px-4 mx-auto w-full my-6 text-left">
        {step === 1 && (
          <>
            <h2 className="text-2xl font-black text-dark tracking-tight mb-1">
              Choose Your Claimer Classes
            </h2>
            <p className="text-xs font-semibold text-gray-400 mb-2">
              Select the tactical archetype skills you are ready to deploy in the real world.
            </p>
            <div className="bg-orange-50 border border-primary/20 rounded-xl p-3 mb-6 text-primary text-xs font-bold shrink-0">
              You can level up and calibrate additional classes at any time from your Dossier.
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <SkillPicker
                mode="multi"
                layout="grid"
                selected={selectedSkills}
                onSelect={(skillId) => handleToggleSkill(skillId)}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-black text-dark tracking-tight mb-1">
              Define Your Operational Sector
            </h2>
            <p className="text-xs font-semibold text-gray-400 mb-4">
              Calibrate your patrol radius to lock onto nearby sector bounties.
            </p>
            
            {/* Map Preview First */}
            <div className="mt-2 flex-1 flex flex-col min-h-[420px] mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Sector Grid Radar</label>
              <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
                <LocationPicker
                  initialLat={serviceAreaLocation.lat}
                  initialLng={serviceAreaLocation.lng}
                  coverageRadius={coverageRadius}
                  searchPlaceholder="Search base coordinate..."
                  onLocationChange={(loc) => {
                    setServiceAreaLocation({
                      lat: loc.lat,
                      lng: loc.lng
                    });
                    setSearchQuery(loc.completeAddress);
                  }}
                  onLocationGranted={(coords) => {
                    setServiceAreaLocation(coords);
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">Drag the pin or search to set your sector base coordinates.</p>
            </div>

            {/* Coverage Level Second */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Sector Patrol Radius</label>
              <div className="flex flex-col space-y-2">
                {Object.values(MARKETPLACE_RULES.COVERAGE_LEVELS).map((level) => {
                  const isSelected = coverageLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => handleCoverageSelect(level.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${isSelected ? 'border-primary/50 bg-primary/[0.03] shadow-xs' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                    >
                      <div>
                        <div className="font-bold text-dark">{level.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{level.desc}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-primary/50 bg-primary/10' : 'border-gray-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-primary" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Button footer */}
      <div className="max-w-md lg:max-w-3xl lg:px-4 mx-auto w-full pt-4 shrink-0 border-t border-border mt-4 flex justify-center">
        <Tooltip text={step === 1 ? 'Next to Sector Perimeter' : (routeParams?.editServiceAreaOnly ? 'Save sector changes' : 'Enter the Grid with calibrated perimeter')} className="w-full flex justify-center">
          <button
            onClick={handleNextStep}
            disabled={isLoading}
            className={`w-full max-w-md flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>{step === 1 ? 'Next' : (routeParams?.editServiceAreaOnly ? 'Save Sector' : 'Enter The Grid 🚀')}</span>
                {step === 1 ? <ArrowRight className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              </>
            )}
          </button>
        </Tooltip>
      </div>

    </div>
  );
};

export default TaskerOnboardingScreen;
