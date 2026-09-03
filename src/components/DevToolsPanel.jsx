import React, { useState, useEffect, useContext } from 'react';
import { Terminal, User, Copy, Check, Zap, X, ShieldAlert, Smartphone, RotateCcw, Crown, Swords, Sparkles, Radio } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import BirdAvatar from './BirdAvatars';

const DevToolsPanel = () => {
  const { pushScreen, currentScreen, setRole, role, userProfile, userId } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState('');

  // Only render on localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocalhost) return null;

  const isGuest = !userId || userProfile?.isGuest;

  const personas = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Aeron Vance',
      role: 'poster',
      roleLabel: 'Quest Issuer',
      level: 10,
      badgeText: 'ISSUER',
      badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      desc: 'Apex Quest Issuer deploying multi-operative bounties & raid contracts (Bangalore Sector)',
      color: 'from-orange-500 to-amber-500',
      bird: 'sparrow',
      tasksCompleted: 24,
      rating: 5.0,
      skills: []
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Kaelen Voss',
      role: 'tasker',
      roleLabel: 'Elite Operative',
      level: 8,
      badgeText: 'ELITE FIXER',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      desc: 'High-stats fixer (35 Quests, 5.0★, Titan Muscle & Modular Assembly loadout)',
      color: 'from-emerald-500 to-teal-500',
      bird: 'falcon',
      tasksCompleted: 35,
      rating: 5.0,
      skills: ['titan_muscle', 'modular_assembly', 'velocity_sprint', 'crowd_command']
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Nova Sterling',
      role: 'tasker',
      roleLabel: 'Rookie Fixer',
      level: 1,
      badgeText: 'RECRUIT',
      badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      desc: 'Fresh recruit operative (0 Quests, ₹0 Stash, Starter Loadout baseline)',
      color: 'from-blue-500 to-cyan-500',
      bird: 'robin',
      tasksCompleted: 0,
      rating: 5.0,
      skills: ['titan_muscle', 'modular_assembly', 'code_hotfix']
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Cipher Ray',
      role: 'tasker',
      roleLabel: 'Cyber Specialist',
      level: 5,
      badgeText: 'CYBER OPS',
      badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      desc: 'Remote & Code Hotfix loadout (12 Quests, 4.9★, Media & Cyber abilities)',
      color: 'from-purple-500 to-pink-500',
      bird: 'owl',
      tasksCompleted: 12,
      rating: 4.9,
      skills: ['code_hotfix', 'lens_craft', 'velocity_sprint']
    }
  ];

  const handleLogin = (persona) => {
    localStorage.setItem('userId', persona.id);
    localStorage.setItem('activeRole', persona.role);
    
    const profile = {
      id: persona.id,
      name: persona.name,
      posterName: persona.name,
      taskerName: persona.name,
      role: persona.role,
      level: persona.level || 1,
      phone: '+91 99999 99901',
      posterPhone: '+91 99999 99901',
      taskerPhone: '+91 99999 99901',
      rating: persona.rating,
      taskerRating: persona.rating,
      tasksCompleted: persona.tasksCompleted,
      tasks_completed: persona.tasksCompleted,
      totalTasksCompletedCount: persona.tasksCompleted,
      bird: persona.bird,
      skills: persona.skills || [],
      location: { lat: 12.9716, lng: 77.5946 },
      city: 'Bangalore'
    };
    
    localStorage.setItem('userProfile', JSON.stringify(profile));
    window.location.reload();
  };

  const handleResetToGuest = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('activeRole');
    window.location.reload();
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const activeRoleLabel = isGuest
    ? 'Goated Guest Operative (Lv.12)'
    : role === 'poster'
    ? '👑 Quest Issuer'
    : '⚡ Fixer (Operative)';

  return (
    <>
      {/* Floating Gear Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-3 sm:bottom-4 sm:right-4 z-40 bg-gray-900 text-primary border border-primary/20 hover:border-primary/50 hover:bg-black p-3 sm:p-3.5 rounded-full shadow-[0_0_15px_rgba(242,100,25,0.25)] hover:shadow-[0_0_20px_rgba(242,100,25,0.4)] flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 group opacity-85 hover:opacity-100"
        title="HelpHive Developer Tools"
      >
        <Terminal className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-45 transition-transform duration-300" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 text-[10px] sm:text-[11px] font-black tracking-wider transition-all duration-300 uppercase shrink-0">
          Dev Console
        </span>
      </button>

      {/* Slide-out Sidebar */}
      <div
        className={`fixed inset-y-0 right-0 z-[9998] w-full sm:max-w-sm bg-gray-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col space-y-5 overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h2 className="text-sm font-black text-white tracking-widest uppercase">
                  HelpHive Dev Terminal
                </h2>
                <p className="text-[10px] font-bold text-gray-400">Operative & Sector Switcher</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Session Info */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Active Session Dossier</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                isGuest 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {isGuest ? 'Guest Preview' : 'Active Session'}
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                <BirdAvatar birdName={isGuest ? 'falcon' : (userProfile?.bird || 'falcon')} size={32} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-extrabold text-sm truncate">
                  {userProfile?.name || (isGuest ? 'Felix Wing' : 'Authenticated Operative')}
                </span>
                <span className="text-[11px] text-primary font-bold truncate">
                  {activeRoleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Test Routing Notice */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3.5 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex flex-col space-y-1">
              <span className="text-xs font-black text-orange-400">Tactical Matching Safeguard Active</span>
              <p className="text-[11px] text-gray-300 leading-relaxed font-semibold">
                To test live radar matching safely without broadcasting to real field operatives, prefix your bounty title with <strong className="text-white bg-orange-500/20 px-1 rounded">[TEST]</strong>. Matching will be strictly confined to test operatives.
              </p>
            </div>
          </div>

          {/* Switch Session Personas */}
          <div className="flex flex-col space-y-2.5">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Operative Personas</span>
            
            {/* Quick Button to Reset to Guest Persona */}
            <button
              onClick={handleResetToGuest}
              disabled={isGuest}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 group ${
                isGuest
                  ? 'bg-amber-500/10 border-amber-500/30 opacity-60 cursor-not-allowed'
                  : 'bg-primary/10 border-primary/30 hover:bg-primary/20 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 p-1">
                  <BirdAvatar birdName="falcon" size={28} />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-primary truncate">Felix Wing</span>
                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-md font-bold uppercase">Guest</span>
                  </div>
                  <span className="text-[10px] text-gray-300 font-semibold truncate">
                    Lv.12 • 42 Ops • ₹24,500 Stash
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-400 shrink-0">Reset</span>
            </button>

            {personas.map((p) => {
              const isActive = userId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleLogin(p)}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 group ${
                    isActive 
                      ? 'bg-white/5 border-white/20 opacity-50 cursor-not-allowed'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/5 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 p-1 mt-0.5">
                      <BirdAvatar birdName={p.bird} size={28} />
                    </div>
                    <div className="flex flex-col space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-white group-hover:text-primary transition-colors">
                          {p.name}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border ${p.badgeClass}`}>
                          {p.badgeText}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold leading-snug line-clamp-2">
                        {p.desc}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-white">
                      Lv.{p.level}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Mobile Screen Audit Navigator */}
          <div className="flex flex-col space-y-2">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>Jump to Screen (Mobile Audit)</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'landing', label: '1. Gateway Landing' },
                { id: 'tasker_home', label: '2. Live Quest Radar' },
                { id: 'post_job', label: '3. Deploy Bounty' },
                { id: 'poster_home', label: '4. Issuer Deck' },
                { id: 'operations', label: '5. Active Operations' },
                { id: 'my_profile', label: '6. Operative Dossier' },
                { id: 'tasker_activity', label: '7. Stash & Ledger' },
                { id: 'notifications', label: '8. Transmissions' },
                { id: 'address_book', label: '9. Sector Coordinates' },
                { id: 'add_edit_address', label: '10. Add Sector Node' },
                { id: 'about_us', label: '11. HelpHive Codex' },
                { id: 'admin_dashboard', label: '12. Overseer Admin' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id === 'poster_home' || s.id === 'post_job') setRole('poster');
                    if (s.id === 'tasker_home' || s.id === 'tasker_activity') setRole('tasker');
                    pushScreen(s.id, true);
                    setIsOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all text-left truncate cursor-pointer ${
                    currentScreen === s.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Copy Templates */}
          <div className="flex flex-col space-y-2.5">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Copy Bounty Test Presets</span>
            <div className="flex flex-col space-y-1.5">
              {[
                '[TEST] Titan Muscle heavy shift bounty (Solo Op)',
                '[TEST] Modular Assembly & Rigging contract (Crew Raid)',
                '[TEST] Code Hotfix & Cyber repair dispatch',
                '[TEST] Velocity Sprint priority sector courier'
              ].map((template) => {
                const isCopied = copiedText === template;
                return (
                  <div
                    key={template}
                    onClick={() => handleCopy(template)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/15 hover:bg-white/[0.03] cursor-pointer transition-all duration-300 font-mono text-[11px] text-gray-300 select-all active:scale-[0.99]"
                  >
                    <span className="truncate pr-2">{template}</span>
                    <button className="text-gray-400 hover:text-white shrink-0">
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-3 mt-4 shrink-0 flex items-center justify-between text-[10px] text-gray-500 font-semibold">
          <span>HelpHive Codex v2.0</span>
          <span>Localhost Console Only</span>
        </div>
      </div>
    </>
  );
};

export default DevToolsPanel;
