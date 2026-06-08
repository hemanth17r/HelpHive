import React, { useContext } from 'react';
import { Star, ShieldAlert, Award, Calendar, Phone, ArrowLeft, Check } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import Tooltip from '../../components/Tooltip';
import BirdAvatar from '../../components/BirdAvatars';

const TaskerProfileScreen = () => {
  const { userProfile, userLocation, resetApp, selectedBird } = useContext(AppContext);

  // Fallback profile if onboarding wasn't done
  const profile = userProfile || {
    name: 'Suresh Kumar',
    phone: '+91 98765 43210',
    skills: ['moving', 'travel'],
    rating: 4.8,
    tasksCompleted: 42
  };

  return (
    <div className="flex-1 flex flex-col bg-light-gray h-full overflow-y-auto pb-20">
      {/* Top Banner Cover */}
      <div className="relative bg-linear-to-r from-primary to-orange-400 h-28 shrink-0">
        <div className="absolute inset-0 bg-black/10"></div>
        {/* Back Button */}
        <Tooltip text="Switch Role / Home" position="right">
          <button
            onClick={resetApp}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Profile info block */}
      <div className="px-6 -mt-12 relative z-10 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left">
        {/* Main Profile Info Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-border flex flex-col items-center text-center space-y-3">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-md -mt-16 overflow-hidden bg-orange-50 flex items-center justify-center">
            <BirdAvatar birdName={selectedBird} size={80} />
          </div>
          <div>
            <h2 className="text-lg font-black text-dark leading-tight">{profile.name}</h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">{profile.phone}</p>
          </div>
          
        </div>

        {/* Reputation Section (Tasker) */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-border space-y-5 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Reputation</h3>
              <div className="flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-lg">
                <Award className="w-3 h-3" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider">Verified Local</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5 text-primary">
                  <span className="text-3xl font-black leading-none tracking-tight text-dark">{profile.rating.toFixed(1)}</span>
                  <Star className="w-5 h-5 fill-primary" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Average Rating</span>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-dark leading-none tracking-tight">{profile.tasksCompleted}</span>
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Jobs Completed</span>
              </div>
            </div>

            {/* Trust Badges - Tasker specific */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Trust Badges</h4>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-200/50 flex items-center space-x-1 shadow-xs">
                  <Check className="w-3 h-3"/>
                  <span>Reliable Helper</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200/50 flex items-center space-x-1 shadow-xs">
                  <Award className="w-3 h-3"/>
                  <span>On Time</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200/50 flex items-center space-x-1 shadow-xs">
                  <Star className="w-3 h-3"/>
                  <span>Professional</span>
                </span>
              </div>
            </div>
          </div>

        {/* Secondary Info (Area) */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-border mt-4 space-y-3">
          <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Service Scope</h3>
          <div className="flex items-center space-x-2 text-xs font-bold text-dark">
            <Calendar className="w-4.5 h-4.5 text-primary" />
            <span>Active in {userLocation?.name || 'Koramangala, Bangalore'}</span>
          </div>
        </div>

        {/* Skill tags */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-border mt-4 space-y-3">
          <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Approved Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skillId) => {
              const skill = SKILLS.find((s) => s.id === skillId);
              if (!skill) return null;
              const SkillIcon = skill.icon;
              return (
                <Tooltip key={skillId} text={`Skill: ${skill.label}`}>
                  <div className="flex items-center space-x-1.5 bg-gray-50 border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-dark">
                    <SkillIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{skill.label}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Account Settings / Actions */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-border mt-4 space-y-1">
          <button className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-2 rounded-xl transition-colors cursor-pointer">
            <span>Payment History</span>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">₹1,240 Pending</span>
          </button>
          <button className="w-full flex items-center justify-between text-left text-xs font-bold text-dark hover:bg-gray-50 p-2 rounded-xl transition-colors cursor-pointer">
            <span>Support Helpdesk</span>
            <ShieldAlert className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskerProfileScreen;
