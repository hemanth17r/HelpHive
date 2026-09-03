import React, { useContext, useState } from 'react';
import { ArrowLeft, ChevronRight, X, Radio, Users, ShieldCheck, Zap } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import BirdAvatar from '../components/BirdAvatars';

const AboutUsScreen = () => {
  const { popScreen, selectedBird } = useContext(AppContext);
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full relative z-20 overflow-hidden select-none">
      {/* Frameless Top Header */}
      <div 
        className="flex items-center justify-between px-4 pb-2 pt-3 bg-transparent shrink-0 z-10 max-w-md mx-auto w-full"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button 
          onClick={popScreen}
          className="p-2 -ml-2 rounded-full hover:bg-slate-200/60 text-slate-700 transition-colors cursor-pointer active-scale"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">About HelpHive</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 pb-24 space-y-4 max-w-md mx-auto w-full">
        {/* Brand Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-[28px] p-6 border border-slate-200/80 shadow-xs text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-orange-50/80 flex items-center justify-center border-2 border-white shadow-inner mx-auto mb-3">
            <BirdAvatar birdName={selectedBird || 'falcon'} size={44} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Help<span className="text-primary">Hive</span>
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/70 text-primary text-[10px] font-black tracking-wide mt-2">
            <Zap className="w-3 h-3 fill-primary/20" />
            <span>Hyperlocal Bounty Network • v7.2.0</span>
          </div>
          <p className="text-xs font-bold text-slate-600 leading-relaxed mt-4">
            HelpHive is a real-world platform connecting people for local missions, physical assistance, and direct peer-to-peer task settlements.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">How We Operate</h2>
          
          <div className="bg-white/90 rounded-2xl p-4 border border-slate-200/70 shadow-2xs flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-primary flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight">Live Proximity Radar</h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 leading-snug">
                Detect contracts and available operative support right in your sector with real-time GPS distance calculation.
              </p>
            </div>
          </div>

          <div className="bg-white/90 rounded-2xl p-4 border border-slate-200/70 shadow-2xs flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight">Solo & Strike Teams</h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 leading-snug">
                Broadcast solo bounties or deploy full squads with automated split-pool payouts for group efforts.
              </p>
            </div>
          </div>

          <div className="bg-white/90 rounded-2xl p-4 border border-slate-200/70 shadow-2xs flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight">Safe OTP Settlements</h3>
              <p className="text-[11px] font-bold text-slate-500 mt-1 leading-snug">
                Bounties are locked securely and settled directly to operatives upon physical clearance code verification.
              </p>
            </div>
          </div>
        </div>

        {/* Legal & Trust Links */}
        <div className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-2xs overflow-hidden divide-y divide-slate-100">
          <button 
            onClick={() => setActiveModal('privacy')}
            className="w-full flex items-center justify-between py-3.5 px-4 text-left hover:bg-slate-50 transition-colors cursor-pointer active-scale"
          >
            <span className="text-xs font-black text-slate-900">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <button 
            onClick={() => setActiveModal('terms')}
            className="w-full flex items-center justify-between py-3.5 px-4 text-left hover:bg-slate-50 transition-colors cursor-pointer active-scale"
          >
            <span className="text-xs font-black text-slate-900">Terms & Conditions</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        
        {/* Footer */}
        <div className="text-center pt-2 pb-4 space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Built for the community</p>
          <p className="text-[10px] font-bold text-slate-400">© 2026 HelpHive Community</p>
        </div>
      </div>

      {/* Modal overlay */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-[fadeIn_150ms_ease-out]" onClick={() => setActiveModal(null)}>
          <div 
            className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border-t sm:border border-slate-200 overflow-hidden animate-[slideUp_200ms_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-black text-slate-900">
                {activeModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 text-xs font-bold text-slate-600 leading-relaxed space-y-4">
              {activeModal === 'privacy' ? (
                <>
                  <p className="text-slate-400 text-[11px]">Last updated: July 2026</p>
                  <p>
                    At HelpHive, we respect your privacy and are committed to protecting the personal data you share with us. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
                  </p>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">1. Information We Collect</h4>
                    <p>
                      We collect profile details (name, email, and phone number), location data (to connect posters and taskers based on proximity), task details, and communication logs.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">2. How We Use Your Information</h4>
                    <p>
                      We use your information to facilitate matching between taskers and posters, provide services, and send important service notifications.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">3. Sharing of Information</h4>
                    <p>
                      Your contact details (like phone number) are only shared with matching operatives after a mission contract is accepted. We do not sell your personal data.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">4. Data Security</h4>
                    <p>
                      We implement industry-standard security measures to protect your data across all interactions.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-[11px]">Last updated: July 2026</p>
                  <p>
                    Welcome to HelpHive! By accessing or using our platform, you agree to comply with and be bound by these Terms & Conditions.
                  </p>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">1. Services Provided</h4>
                    <p>
                      HelpHive is a platform connecting users who need tasks completed (Posters) with service providers (Taskers). We facilitate matching for both physical and remote tasks.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">2. User Accounts & Verification</h4>
                    <p>
                      You must provide accurate information during registration. Both parties agree to settle task payments directly upon verified completion.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">3. Payments & Tasks</h4>
                    <p>
                      Posters agree to pay the agreed-upon bounty upon successful completion. Taskers agree to verify task start using the security OTP.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">4. Acceptable Use</h4>
                    <p>
                      You agree not to use the platform for illegal activities, harassment, or fraudulent tasks.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active-scale"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutUsScreen;
