import React from 'react';
import { MapPin, X } from 'lucide-react';

const LocationPermissionModal = ({ isOpen, onClose, onAllow, role }) => {
  if (!isOpen) return null;

  const title = role === 'tasker' ? 'Find Nearby Jobs' : 'Get Faster Responses';
  const description = role === 'tasker' 
    ? 'To show you jobs that are close to you, we need your current location.' 
    : 'To accurately calculate the distance for taskers and help you get faster responses, we need your current location.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/40 backdrop-blur-xs animate-[fadeIn_200ms_ease-in-out]">
      <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-[slideUp_200ms_ease-in-out]">
        <div className="p-5 relative flex items-center justify-between shrink-0">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-dark p-2 rounded-full hover:bg-gray-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 pb-6 pt-2 text-center flex-1">
          <h3 className="text-xl font-black text-dark mb-3">{title}</h3>
          <p className="text-sm font-semibold text-gray-500 mb-8">
            {description}
          </p>
          
          <button 
            onClick={onAllow}
            className="w-full bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer mb-3"
          >
            Allow Location
          </button>
          
          <button 
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl transition-all cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionModal;
