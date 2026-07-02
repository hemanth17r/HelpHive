import React, { useContext, useState } from 'react';
import { ArrowLeft, Sparkles, ChevronRight, X } from 'lucide-react';
import { AppContext } from '../store/AppContext';

const AboutUsScreen = () => {
  const { popScreen } = useContext(AppContext);
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20">
      {/* Header */}
      <div className="flex items-center px-4 py-4 bg-white sticky top-0 z-10 shrink-0">
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
            <h1 className="text-[22px] font-black text-dark tracking-tight">
              Help<span className="text-primary">Hive</span>
            </h1>
            <span className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Version 6.0.0</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 text-center space-y-6 text-sm font-medium text-gray-600 leading-relaxed">
          <p>
            HelpHive is a trusted, hyperlocal service marketplace built to connect you with skilled professionals for both physical and remote tasks.
          </p>
          <p>
            While our core focus remains on delivering fast, reliable help for physical jobs in your neighborhood, HelpHive also seamlessly supports remote tasks to handle all your service needs.
          </p>
          <p>
            By combining transparency, verified providers, and smart matching, we are building a safer, more convenient ecosystem for everyone.
          </p>
        </div>

        {/* Legal Links */}
        <div className="mt-10 border-t border-border pt-4 space-y-1">
          <button 
            onClick={() => setActiveModal('privacy')}
            className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold text-dark">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button 
            onClick={() => setActiveModal('terms')}
            className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
          >
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

      {/* Modal overlay */}
      {activeModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-[fadeIn_200ms_ease-in-out]">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80%] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-black text-dark">
                {activeModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 text-xs font-semibold text-gray-600 leading-relaxed space-y-4">
              {activeModal === 'privacy' ? (
                <>
                  <p className="text-gray-400">Last updated: July 2026</p>
                  <p>
                    At HelpHive, we respect your privacy and are committed to protecting the personal data you share with us. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
                  </p>
                  <div>
                    <h4 className="font-bold text-dark mb-1">1. Information We Collect</h4>
                    <p>
                      We collect information you provide directly to us, including your profile details (name, email, phone number, and UPI ID), location data (to connect posters and taskers based on proximity), job details, and communication logs.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">2. How We Use Your Information</h4>
                    <p>
                      We use your information to facilitate matching between taskers and posters, provide, maintain, and improve our services (for both physical and remote tasks), enable secure payments, and send important service notifications.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">3. Sharing of Information</h4>
                    <p>
                      We share information necessary to fulfill service agreements. Your contact details (like phone number) are only shared with matching taskers or posters after a job is accepted. We do not sell your personal data to third parties.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">4. Data Security</h4>
                    <p>
                      We implement industry-standard security measures to protect your data, but please note that no method of transmission over the internet is 100% secure.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400">Last updated: July 2026</p>
                  <p>
                    Welcome to HelpHive! By accessing or using our platform, you agree to comply with and be bound by these Terms & Conditions.
                  </p>
                  <div>
                    <h4 className="font-bold text-dark mb-1">1. Services Provided</h4>
                    <p>
                      HelpHive is a platform connecting users who need tasks completed (Posters) with service providers (Taskers). We facilitate matching for both physical (local) and remote tasks. HelpHive acts as a marketplace and is not an employer of the Taskers.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">2. User Accounts & Verification</h4>
                    <p>
                      You must provide accurate and complete information during registration. Taskers must provide a valid UPI ID for receiving payments. You are responsible for keeping your account credentials secure.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">3. Payments & Jobs</h4>
                    <p>
                      Posters agree to pay the agreed-upon amount upon successful completion of the job. Taskers agree to perform services professionally and verify job start using the security OTP. HelpHive is not responsible for disputes regarding the quality of work.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">4. Acceptable Use</h4>
                    <p>
                      You agree not to use the platform for any illegal activities, harassment, or to post fraudulent jobs. We reserve the right to suspend or terminate accounts that violate these terms.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-dark mb-1">5. Limitation of Liability</h4>
                    <p>
                      HelpHive is provided 'as is' without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-dark hover:bg-dark/95 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
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
