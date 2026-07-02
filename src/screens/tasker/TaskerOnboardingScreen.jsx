import React, { useState, useContext, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Search, Loader2, Navigation, Wifi, Flame, Zap } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { SKILLS } from '../../config/constants';
import { MARKETPLACE_RULES } from '../../config/marketplaceRules';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';
import MapView from '../../components/MapView';
import { api } from '../../services/api';
import { searchAddress, reverseGeocode } from '../../utils/geocoding';
import { getCurrentLocation } from '../../utils/location';

const TaskerOnboardingScreen = () => {
  const { setUserProfile, pushScreen, popScreen, userProfile, requireProfile, routeParams, userId } = useContext(AppContext);
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
    return { lat: 12.9716, lng: 77.5946 }; // Default to Bengaluru center
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Auto-detect location on step 2 if not set yet
  useEffect(() => {
    if (step === 2 && (!userProfile?.serviceAreaLat || !userProfile?.serviceAreaLng)) {
      getCurrentLocation()
        .then(loc => {
          setServiceAreaLocation(loc);
          reverseGeocode(loc.lat, loc.lng).then(result => {
            if (result) setSearchQuery(result.displayName);
          });
        })
        .catch(err => {
          console.warn('Initial geolocation for service area failed/denied, using default:', err);
          reverseGeocode(serviceAreaLocation.lat, serviceAreaLocation.lng).then(result => {
            if (result) setSearchQuery(result.displayName);
          });
        });
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

  const handleSelectResult = (result) => {
    setSearchQuery(result.displayName);
    setServiceAreaLocation({ lat: result.lat, lng: result.lng });
    setShowDropdown(false);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setServiceAreaLocation({ lat: loc.lat, lng: loc.lng });
      
      const result = await reverseGeocode(loc.lat, loc.lng);
      if (result) {
        setSearchQuery(result.displayName);
      }
    } catch (e) {
      console.error('Failed to get current location', e);
      showToast('Location permission denied or unavailable.', 'error');
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
          {step === 1 ? 'Select Services' : 'Service Area'}
        </span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col justify-start max-w-md lg:max-w-3xl lg:px-4 mx-auto w-full my-6 text-left">
        {step === 1 && (
          <>
            <h2 className="text-2xl font-black text-dark tracking-tight mb-1">
              What Can You Do?
            </h2>
            <p className="text-xs font-semibold text-gray-400 mb-2">
              Tap categories of work you are comfortable doing.
            </p>
            <div className="bg-orange-50 border border-primary/20 rounded-xl p-3 mb-6 text-primary text-xs font-bold shrink-0">
              Don't worry, you can always change these services later!
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {/* On-site Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-1">
                  <MapPin className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">On-site &amp; Physical Services</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SKILLS.filter(s => s.type === 'physical').map((skill) => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return (
                      <IconLabel
                        key={skill.id}
                        icon={skill.icon}
                        label={skill.label}
                        isNew={skill.isNew}
                        isHighDemand={skill.isHighDemand}
                        isUrgent={skill.isUrgent}
                        tooltipText={`Toggle skill: ${skill.label}`}
                        selected={isSelected}
                        onClick={() => handleToggleSkill(skill.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Online Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-1">
                  <Wifi className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Online &amp; Remote Services</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SKILLS.filter(s => s.type === 'remote').map((skill) => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return (
                      <IconLabel
                        key={skill.id}
                        icon={skill.icon}
                        label={skill.label}
                        isNew={skill.isNew}
                        isHighDemand={skill.isHighDemand}
                        isUrgent={skill.isUrgent}
                        tooltipText={`Toggle skill: ${skill.label}`}
                        selected={isSelected}
                        onClick={() => handleToggleSkill(skill.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="pt-5 mt-4 border-t border-border flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary text-white border border-primary">
                    NEW
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">Newly Added</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                    <Flame className="w-2.5 h-2.5 fill-current text-white" />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">High Demand</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="p-1 rounded-full bg-primary text-white flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 fill-current text-white" />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">Quick Match</span>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-black text-dark tracking-tight mb-1">
              Where Can You Work?
            </h2>
            <p className="text-xs font-semibold text-gray-400 mb-4">
              Set your coverage area so we can match you with local jobs.
            </p>
            
            {/* Map Preview First */}
            <div className="mt-2 flex-1 flex flex-col min-h-[420px] mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Map Preview</label>
              <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
                {/* Floating Search Bar */}
                <div className="absolute top-4 left-4 max-w-[320px] sm:max-w-[400px] w-[calc(100%-80px)] z-20" ref={dropdownRef}>
                  <div className="relative shadow-lg rounded-xl">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                      className="w-full bg-white border-none rounded-xl pl-11 pr-10 py-2.5 text-sm font-bold text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Search for your location..."
                    />
                    <Search className="absolute left-4 top-2.5 w-5 h-5 text-gray-400" />
                    {isSearching && (
                      <Loader2 className="absolute right-4 top-2.5 w-5 h-5 text-primary animate-spin" />
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

                <MapView
                  center={[serviceAreaLocation.lat, serviceAreaLocation.lng]}
                  zoom={coverageRadius > 10000 ? 10 : coverageRadius > 5000 ? 11 : 12}
                  draggable={true}
                  onDragEnd={handleDragEnd}
                  coverageRadius={coverageRadius}
                  height="100%"
                />

                {/* Floating GPS Button */}
                <button 
                  onClick={handleUseCurrentLocation}
                  className="absolute bottom-6 right-4 z-20 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer border border-gray-100"
                  aria-label="Use current location"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">Drag the pin or use search to adjust the center of your service area.</p>
            </div>

            {/* Coverage Level Second */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Coverage Level</label>
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
      <div className="max-w-md lg:max-w-3xl lg:px-4 mx-auto w-full pt-4 shrink-0 border-t border-border mt-4">
        <Tooltip text={step === 1 ? 'Next to Service Area' : (routeParams?.editServiceAreaOnly ? 'Save service area changes' : 'Start earning with selected area')}>
          <button
            onClick={handleNextStep}
            disabled={isLoading}
            className={`w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>{step === 1 ? 'Next' : (routeParams?.editServiceAreaOnly ? 'Save Changes' : 'Start Earning')}</span>
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
