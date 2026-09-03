import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if the user dismissed recently
    const shouldShow = () => {
      const dismissedTime = localStorage.getItem('pwa_install_dismissed');
      if (!dismissedTime) return true;
      
      // If it's the old 'true' string (never show again), let's clear it so they see it again for testing
      if (dismissedTime === 'true') {
        localStorage.removeItem('pwa_install_dismissed');
        return true;
      }
      
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return (Date.now() - parseInt(dismissedTime, 10)) > sevenDays;
    };

    // Check if app is already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isStandalone) {
      return; // Already installed, don't show prompt
    }

    // Detect iOS/iPadOS devices (including desktop Safari on modern iPads)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.maxTouchPoints > 1 && /macintosh|mac os x/i.test(userAgent));
    
    if (isIOSDevice && shouldShow()) {
      setIsIOS(true);
      setShowPrompt(true);
    }

    // 1. Check if the event was already captured globally by index.html script
    if (window.deferredPrompt && !isIOSDevice) {
      setDeferredPrompt(window.deferredPrompt);
      if (shouldShow()) {
        setShowPrompt(true);
      }
    }

    // 2. Standard handler for beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      window.deferredPrompt = e;
      
      if (shouldShow() && !isIOSDevice) {
        setShowPrompt(true);
      }
    };

    // 3. Custom event handler if the global script caught it and dispatched it
    const handleGlobalPromptAvailable = (e) => {
      const promptEvent = e.detail || window.deferredPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
        if (shouldShow() && !isIOSDevice) {
          setShowPrompt(true);
        }
      }
    };

    const handleAppInstalled = () => {
      // Clear the deferredPrompt so it can be garbage collected
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      setShowPrompt(false);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleGlobalPromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleGlobalPromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (!promptEvent) return;
    
    // Show the install prompt
    promptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    window.deferredPrompt = null;
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl p-4 z-50 flex flex-col border border-gray-100 animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#FF6B35] p-2 rounded-lg text-white">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">
              Install <span className="font-black text-dark">Help<span className="text-primary">Hive</span></span>
            </h3>
            <p className="text-sm text-gray-500">Add to home screen for quick access</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={20} />
        </button>
      </div>
      
      {isIOS ? (
        <div className="bg-orange-50 text-orange-800 text-sm p-3 rounded-lg flex flex-col gap-2">
          <p className="font-semibold">To install on iOS:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Tap the Share button <Share size={14} className="inline-block align-middle mx-1" /> in Safari
            </li>
            <li>Scroll down and select <strong>"Add to Home Screen"</strong></li>
          </ol>
        </div>
      ) : (
        <button 
          onClick={handleInstallClick}
          className="w-full bg-[#FF6B35] hover:bg-[#e85a25] text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Install App
        </button>
      )}
    </div>
  );
};

export default PWAInstallPrompt;
