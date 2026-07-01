import React, { useContext } from 'react';
import { ArrowRight, UserCheck } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const ProfileProgressBar = () => {
  const { openOnboardingWizard, role } = useContext(AppContext);
  const { completionPercentage, missingWizardItems } = useProfileCompletion();

  // Hide if fully configured
  if (missingWizardItems.length === 0) {
    return null;
  }

  const handleClick = () => {
    openOnboardingWizard();
  };

  const titleText = role === 'tasker' ? 'Complete Helper Profile' : 'Complete Poster Profile';
  const subtext = role === 'tasker'
    ? 'Set up profile to start getting task notifications'
    : 'Set up profile to start posting tasks';

  return (
    <button
      onClick={handleClick}
      className="w-full max-w-md mx-auto flex flex-col bg-white border-2 border-border hover:border-primary/40 hover:shadow-md rounded-3xl p-5 transition-all duration-200 text-left active:scale-[0.99] cursor-pointer space-y-3.5 select-none relative overflow-hidden group"
    >
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all"></div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            <UserCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-dark tracking-tight leading-none">{titleText}</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-1.5">
              {subtext}
            </p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
      </div>

      <div className="w-full">
        {/* Horizontal Progress Track */}
        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-100/50">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
    </button>
  );
};

export default ProfileProgressBar;
