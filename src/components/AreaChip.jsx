import React, { useContext } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import Tooltip from './Tooltip';

const AreaChip = () => {
  const { selectedArea, pushScreen } = useContext(AppContext);

  return (
    <div 
      className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full cursor-pointer text-sm font-medium"
      onClick={() => pushScreen('area_select')}
    >
      <div className="flex items-center space-x-2">
        <MapPin className="text-primary w-5 h-5 shrink-0" />
        <div className="flex flex-col text-left">
          <span className="text-xs text-gray-500 font-medium">Selected Area</span>
          <span className="text-sm font-semibold text-dark leading-tight">
            {selectedArea ? `${selectedArea.name} (${selectedArea.pincode})` : 'Select Area'}
          </span>
        </div>
      </div>
      <Tooltip text="Change your current location">
        <button
          onClick={() => setCurrentScreen('area_select')}
          className="flex items-center space-x-1 text-xs text-primary font-bold hover:bg-orange-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <span>Change</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
};

export default AreaChip;
