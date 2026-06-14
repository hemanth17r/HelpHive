import React, { useContext, useState } from 'react';
import { Home, User, RefreshCw } from 'lucide-react';
import { AppContext } from '../store/AppContext';

const BottomNav = () => {
  const { activeTab, setActiveTab, switchRole, role, pushScreen } = useContext(AppContext);
  const [isRotating, setIsRotating] = useState(false);

  const handleSwitchMode = () => {
    setIsRotating(true);
    setTimeout(() => {
      setIsRotating(false);
      switchRole(role === 'tasker' ? 'poster' : 'tasker');
    }, 400);
  };

  const handleHomeClick = () => {
    if (role === 'tasker') setActiveTab('home');
    else pushScreen('poster_home');
  };

  const handleProfileClick = () => {
    if (role === 'tasker') setActiveTab('profile');
    else pushScreen('my_profile');
  };

  return (
    <div className="grid grid-cols-3 items-center bg-white border-t border-border py-2.5 pb-safe shadow-lg shrink-0 w-full">
      <button
        onClick={handleHomeClick}
        className={`flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl transition-all cursor-pointer ${
          role === 'tasker' && activeTab === 'profile' ? 'text-gray-400 hover:text-dark' : 'text-primary'
        }`}
      >
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-bold">Home</span>
      </button>

      <button
        onClick={handleProfileClick}
        className={`flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl transition-all cursor-pointer justify-center ${
          role === 'tasker' && activeTab === 'profile' ? 'text-primary' : 'text-gray-400 hover:text-dark'
        }`}
      >
        <User className="w-6 h-6" />
        <span className="text-[10px] font-bold">Profile</span>
      </button>

      <button
        onClick={handleSwitchMode}
        className="flex flex-col items-center space-y-1 px-1 py-1.5 rounded-xl text-gray-400 hover:text-primary transition-all cursor-pointer justify-center"
      >
        <RefreshCw className={`w-6 h-6 transition-transform duration-300 ${isRotating ? 'rotate-180' : ''}`} />
        <span className="text-[10px] font-bold">
          {role === 'tasker' ? 'Switch to Hirer' : 'Switch to Tasker'}
        </span>
      </button>
    </div>
  );
};

export default BottomNav;
