import React, { useContext } from 'react';
import { Compass, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppContext } from '../store/AppContext';

export const GuestTourBanner = ({ className = '' }) => {
  const { isGuest, openLoginModal } = useContext(AppContext);

  if (!isGuest) return null;

  return (
    <div className={`w-full bg-gradient-to-r from-dark via-slate-900 to-dark text-white px-4 py-3 shadow-lg border-b border-primary/20 transition-all ${className}`}>
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                Guest Tour Mode
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <ShieldCheck className="w-3 h-3" /> Goated Account Preview
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5">
              Exploring as peak user <strong className="text-white">Felix Wing</strong> (4.98★ Pro). Sign in to create your own!
            </p>
          </div>
        </div>

        <button
          onClick={() => openLoginModal()}
          className="shrink-0 bg-primary hover:bg-primary/90 text-dark font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95"
        >
          <span>Join HelpHive</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default GuestTourBanner;
