import React, { useContext } from 'react';
import { HeartHandshake, Briefcase, Sparkles, ChevronRight } from 'lucide-react';
import { AppContext } from '../store/AppContext';

const LandingScreen = () => {
  const { switchRole } = useContext(AppContext);

  const selectRole = (selectedRole) => {
    switchRole(selectedRole);
  };

  return (
    <div 
      className="flex-1 flex flex-col justify-between px-6 pb-8 bg-linear-to-b from-orange-50 via-white to-orange-50/50 min-h-[550px] overflow-y-auto no-scrollbar select-none pt-safe"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 2rem)' }}
    >
      
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center mt-6 space-y-2.5">
        <div className="bg-primary text-white p-4 rounded-3xl shadow-lg shadow-primary/30 relative animate-bounce">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black text-dark tracking-tight">
          Help<span className="text-primary">Hive</span>
        </h1>
        <p className="text-xs font-semibold text-gray-500 max-w-[240px] leading-relaxed">
          Get trusted local help, fast.
        </p>
      </div>

      {/* Main Entry Cards */}
      <div className="flex flex-col space-y-4 my-6 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full">
        {/* Hirer Entrance */}
        <button
          onClick={() => selectRole('poster')}
          className="w-full flex items-center bg-white border border-border hover:border-primary/50 hover:shadow-md rounded-2xl p-5 transition-all duration-200 group cursor-pointer text-left active:scale-[0.98]"
        >
          <div className="bg-primary/10 text-primary p-3.5 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-250 shrink-0">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div className="ml-4 flex-1">
            <h2 className="text-base font-bold text-dark group-hover:text-primary transition-colors mb-0.5">
              I Need Help
            </h2>
            <p className="text-[10px] font-semibold text-gray-400">
              Post a task and connect with nearby helpers.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
        </button>

        {/* Tasker Entrance */}
        <button
          onClick={() => selectRole('tasker')}
          className="w-full flex items-center bg-white border border-border hover:border-primary/50 hover:shadow-md rounded-2xl p-5 transition-all duration-200 group cursor-pointer text-left active:scale-[0.98]"
        >
          <div className="bg-primary/10 text-primary p-3.5 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-250 shrink-0">
            <Briefcase className="w-7 h-7" />
          </div>
          <div className="ml-4 flex-1">
            <h2 className="text-base font-bold text-dark group-hover:text-primary transition-colors mb-0.5">
              I Want to Work
            </h2>
            <p className="text-[10px] font-semibold text-gray-400">
              Find local tasks and start earning.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
        </button>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-[9px] font-black text-gray-400 tracking-wider uppercase shrink-0 pt-2 border-t border-border/10">
        Connect • Help • Earn
      </div>
    </div>
  );
};

export default LandingScreen;
