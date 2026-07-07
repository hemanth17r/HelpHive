import React, { useState, useEffect } from 'react';
import { Terminal, User, Copy, Check, Sparkles, X, ShieldAlert } from 'lucide-react';

const DevToolsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [currentSession, setCurrentSession] = useState(null);

  // Only render on localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  useEffect(() => {
    const cachedProfile = localStorage.getItem('userProfile');
    if (cachedProfile) {
      try {
        setCurrentSession(JSON.parse(cachedProfile));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  if (!isLocalhost) return null;

  const personas = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'tester1_poster',
      role: 'poster',
      desc: 'Test Poster to post new tasks (Bangalore location)',
      color: 'from-orange-500 to-amber-500'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'tester2_tasker_near',
      role: 'tasker',
      desc: 'Test Tasker close by (1.5km, online, moving & events skills)',
      color: 'from-teal-500 to-emerald-500'
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'tester6_tasker_near2',
      role: 'tasker',
      desc: 'Second Test Tasker close by (1.5km, online, moving & video skills)',
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: '77777777-7777-7777-7777-777777777777',
      name: 'tester7_tasker_near3',
      role: 'tasker',
      desc: 'Third Test Tasker close by (1.5km, online, moving & video skills)',
      color: 'from-purple-500 to-pink-500'
    }
  ];

  const handleLogin = (persona) => {
    localStorage.setItem('userId', persona.id);
    localStorage.setItem('activeRole', persona.role);
    
    const profile = {
      id: persona.id,
      name: persona.name,
      role: persona.role,
      bird: persona.role === 'tasker' ? 'falcon' : 'sparrow',
      skills: persona.role === 'tasker' ? ['moving', 'events', 'video_editing'] : []
    };
    
    localStorage.setItem('userProfile', JSON.stringify(profile));
    window.location.reload();
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <>
      {/* Floating Gear Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-900 text-primary border border-primary/20 hover:border-primary/50 hover:bg-black p-3.5 rounded-full shadow-[0_0_15px_rgba(242,100,25,0.2)] hover:shadow-[0_0_20px_rgba(242,100,25,0.4)] flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 group"
        title="HelpHive Developer Tools"
      >
        <Terminal className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 text-[11px] font-black tracking-wider transition-all duration-300 uppercase shrink-0">
          Dev Console
        </span>
      </button>

      {/* Slide-out Sidebar */}
      <div
        className={`fixed inset-y-0 right-0 z-[9998] w-full sm:max-w-sm bg-gray-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col space-y-6 overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-sm font-black text-white tracking-widest uppercase">
                HelpHive Test Console
              </h2>
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
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Active Persona</span>
            {currentSession ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-white font-extrabold text-sm">{currentSession.name}</span>
                  <span className="text-[11px] text-primary font-bold capitalize">{currentSession.role}</span>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                  Logged In
                </div>
              </div>
            ) : (
              <span className="text-gray-500 font-semibold text-xs italic">No developer session loaded. Using real auth.</span>
            )}
          </div>

          {/* Test Routing Notice */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex flex-col space-y-1">
              <span className="text-xs font-black text-orange-400">Notification Protection Active</span>
              <p className="text-[11px] text-gray-300 leading-relaxed font-semibold">
                To test matching safely without notifying real users, prefix your task description with <strong className="text-white bg-orange-500/20 px-1 rounded">[TEST]</strong>. The system will restrict matching strictly to test accounts.
              </p>
            </div>
          </div>

          {/* Switch Session Personas */}
          <div className="flex flex-col space-y-3">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Switch Personas</span>
            {personas.map((p) => {
              const isActive = currentSession?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleLogin(p)}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-300 group ${
                    isActive 
                      ? 'bg-white/5 border-white/20 opacity-50 cursor-not-allowed'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/5 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex flex-col space-y-1 flex-1 pr-3">
                    <span className="text-xs font-extrabold text-white group-hover:text-primary transition-colors">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold leading-snug">
                      {p.desc}
                    </span>
                  </div>
                  <div className={`shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr ${p.color} flex items-center justify-center text-white text-[10px] font-black uppercase shadow-lg shadow-black/30`}>
                    {p.role[0]}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Copy Templates */}
          <div className="flex flex-col space-y-3">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Copy Test Templates</span>
            <div className="flex flex-col space-y-2">
              {[
                '[TEST] Physical moving task',
                '[TEST] Remote website design support'
              ].map((template) => {
                const isCopied = copiedText === template;
                return (
                  <div
                    key={template}
                    onClick={() => handleCopy(template)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/15 hover:bg-white/[0.03] cursor-pointer transition-all duration-300 font-mono text-[11px] text-gray-300 select-all active:scale-[0.99]"
                  >
                    <span>{template}</span>
                    <button className="text-gray-400 hover:text-white shrink-0 pl-2">
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 mt-6 shrink-0 flex items-center justify-between text-[10px] text-gray-500 font-semibold">
          <span>HelpHive v2.0-dev</span>
          <span>Localhost Mode Only</span>
        </div>
      </div>
    </>
  );
};

export default DevToolsPanel;
