import React, { useState, useContext } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../data/mockData';
import IconLabel from '../../components/IconLabel';
import Tooltip from '../../components/Tooltip';

const TaskerOnboardingScreen = () => {
  const { setUserProfile, pushScreen, popScreen, userProfile, requireProfile } = useContext(AppContext);
  const [selectedSkills, setSelectedSkills] = useState(userProfile?.skills || []);
  const [isLoading, setIsLoading] = useState(false);

  // Skills toggle helper
  const handleToggleSkill = (skillId) => {
    if (selectedSkills.includes(skillId)) {
      setSelectedSkills(selectedSkills.filter(id => id !== skillId));
    } else {
      setSelectedSkills([...selectedSkills, skillId]);
    }
  };

  const handleNextStep = () => {
    if (selectedSkills.length === 0) {
      alert('Please select at least one skill task you can do');
      return;
    }
    
    requireProfile(() => {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        // Save profile skills
        setUserProfile({
          skills: selectedSkills,
        });
        pushScreen('tasker_home');
      }, 1000); // Simulated network delay
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-8 bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={popScreen}
          className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
          Select Services
        </span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col justify-start max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full my-6 text-left">
        <h2 className="text-2xl font-black text-dark tracking-tight mb-1">
          What Can You Do?
        </h2>
        <p className="text-xs font-semibold text-gray-400 mb-2">
          Tap categories of work you are comfortable doing.
        </p>
        <div className="bg-orange-50 border border-primary/20 rounded-xl p-3 mb-6 text-primary text-xs font-bold shrink-0">
          Don't worry, you can always change these services later!
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pr-1">
          {SKILLS.map((skill) => {
            const isSelected = selectedSkills.includes(skill.id);
            return (
              <IconLabel
                key={skill.id}
                icon={skill.icon}
                label={skill.label}
                tooltipText={`Toggle skill: ${skill.label}`}
                selected={isSelected}
                onClick={() => handleToggleSkill(skill.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Button footer */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 shrink-0 border-t border-border mt-4">
        <Tooltip text={'Start earning with selected skills'}>
          <button
            onClick={handleNextStep}
            disabled={isLoading}
            className={`w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Start Earning</span>
                <Check className="w-5 h-5" />
              </>
            )}
          </button>
        </Tooltip>
      </div>

    </div>
  );
};

export default TaskerOnboardingScreen;
