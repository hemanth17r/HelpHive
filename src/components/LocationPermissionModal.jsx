import React, { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';

const LocationPermissionModal = ({ isOpen, onClose, onAllow, role }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsAnimatingOut(false);
        }, 300); // Match closing transition duration
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  const title = role === 'tasker' ? 'Activate Sector Radar' : 'Calibrate Drop Coordinates';
  const description = role === 'tasker' 
    ? 'To ping open bounties within your tactical patrol perimeter, activate live GPS radar.' 
    : 'To calculate vector distance for Operators and dispatch strike teams with zero lag, calibrate your drop coordinates.';

  const handleClose = () => {
    if (isWorking) return;
    setIsAnimatingOut(true);
    onClose();
  };

  const handleAllow = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await onAllow();
    } catch (e) {
      console.error(e);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark/40 transition-opacity duration-300 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col ${isAnimatingOut ? 'slide-out-left' : 'slide-in-right'}`}>
        <div className="p-5 relative flex items-center justify-between shrink-0">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <button 
            onClick={handleClose} 
            disabled={isWorking}
            className="text-gray-400 hover:text-dark p-2 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 pb-6 pt-2 text-center flex-1">
          <h3 className="text-xl font-black text-dark mb-3">{title}</h3>
          <p className="text-sm font-semibold text-gray-500 mb-8">
            {description}
          </p>
          
          <button 
            onClick={handleAllow}
            disabled={isWorking}
            className="w-full bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer mb-3 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isWorking ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : null}
            <span>{isWorking ? 'Calibrating...' : 'Activate GPS Radar'}</span>
          </button>
          
          <button 
            onClick={handleClose}
            disabled={isWorking}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stand Down For Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionModal;
