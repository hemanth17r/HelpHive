import React, { useContext } from 'react';
import { ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import { AppContext } from '../store/AppContext';

const AboutUsScreen = () => {
  const { popScreen } = useContext(AppContext);

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border bg-white sticky top-0 z-10 shrink-0">
        <button 
          onClick={popScreen}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black text-dark ml-2">About Us</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="flex justify-center mb-6">
          <div className="flex flex-col items-center">
            <div className="bg-primary text-white p-3 rounded-2xl shadow-xs mb-3">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-dark tracking-tight">
              Help<span className="text-primary">Hive</span>
            </h1>
            <span className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Version 1.0.0</span>
          </div>
        </div>

        <div className="space-y-5 text-sm font-medium text-gray-600 leading-relaxed">
          <p>
            HelpHive is a smart local service marketplace built to connect people with trusted service providers quickly and efficiently.
          </p>
          <p>
            The platform simplifies how users post tasks, discover skilled professionals, and get work completed with transparency and convenience.
          </p>
          <p>
            From urgent local needs to planned service requests, HelpHive creates a seamless experience for both customers and service providers.
          </p>
          <p>
            Our mission is to organize local services into a faster, smarter, and more reliable ecosystem that creates opportunity, trust, and convenience for everyone.
          </p>
          <p>
            HelpHive is continuously evolving to deliver a cleaner, faster, and more intuitive service experience.
          </p>
        </div>

        {/* Legal Links */}
        <div className="mt-10 border-t border-border pt-4 space-y-1">
          <button className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
            <span className="text-sm font-bold text-dark">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
            <span className="text-sm font-bold text-dark">Terms & Conditions</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center pb-8">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Designed by HelpHive Team</p>
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-1">© 2026 AHR Technologies</p>
        </div>
      </div>
    </div>
  );
};

export default AboutUsScreen;
