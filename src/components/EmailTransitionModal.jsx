import React, { useState, useEffect, useContext } from 'react';
import { Mail, CheckCircle2, X } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';
import { api } from '../services/api';

const EmailTransitionModal = ({ isOpen, onClose }) => {
  const { userProfile, setUserProfile } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const isLoading = loadingAction !== null;
  const [view, setView] = useState('main'); // 'main', 'magic_link_sent'

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      setEmail('');
      setError('');
      setView('main');
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsAnimatingOut(false);
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleGoogleLink = async () => {
    setLoadingAction('google');
    setError('');
    try {
      // By calling api.loginWithGoogle, the user is redirected to Google.
      // We rely on onAuthStateChange to link the session if the backend logic allows it.
      // However, if their email is not yet saved, onAuthStateChange might create a new user.
      // That's why we encourage Magic Link, but provide this as requested.
      const { error } = await api.loginWithGoogle();
      if (error) throw error;
    } catch (e) {
      console.error(e);
      setError("Failed to initialize Google Login. Please try again.");
      setLoadingAction(null);
    }
  };

  const handleMagicLink = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoadingAction('magic');
    setError('');

    try {
      // Check if email already exists on another account
      const { data: existingProfile } = await api.findProfileByEmail(trimmedEmail);
      if (existingProfile && existingProfile.id !== userProfile?.id) {
        setError('This email is already registered to another account.');
        setLoadingAction(null);
        return;
      }

      // Save email to the user's profile first so that when they click the magic link,
      // onAuthStateChange can find the existing profile by email and link the auth_id
      const res = await setUserProfile({ email: trimmedEmail });
      if (res && res.success === false) {
        setError(res.error || 'Failed to prepare email link.');
        setLoadingAction(null);
        return;
      }

      // Send the magic link
      const { error: magicError } = await api.loginWithMagicLink(trimmedEmail);
      if (magicError) throw magicError;
      
      setView('magic_link_sent');
    } catch (err) {
      console.error(err);
      if (err.message?.includes('rate limit')) {
        setError("Too many requests. Please wait a minute and try again.");
      } else {
        setError("Failed to send magic link. Please check your email and try again.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div 
      onClick={onClose}
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 ${
        isAnimatingOut ? 'modal-backdrop-close' : 'modal-backdrop-open'
      }`}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] flex flex-col overflow-hidden shadow-2xl ${
          isAnimatingOut ? 'modal-content-close' : 'modal-content-open'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-dark tracking-tight">Secure Your Account</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Link an email to switch to passwordless sign-in</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50">
          {view === 'main' && (
            <div className="space-y-6">
              
              <button 
                onClick={handleGoogleLink}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 text-slate-700 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50 active-press cursor-pointer shadow-xs"
              >
                {loadingAction === 'google' ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{loadingAction === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-gray-50/50 text-gray-400 font-semibold text-xs">or</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">
                  Email address
                </label>
                <div className="flex items-center bg-white border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoading) {
                        handleMagicLink();
                      }
                    }}
                    disabled={isLoading}
                    placeholder="name@example.com"
                    className={`w-full bg-transparent border-0 px-3 py-2 text-sm font-semibold outline-hidden text-dark h-full ${isLoading ? 'text-gray-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed pt-1">
                  HelpHive is moving to a modern, email-first sign-in system. By linking your email, you will be able to sign in easily without entering a phone number again.
                </p>
              </div>

              {error && (
                <div className="pt-1">
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100/50 leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleMagicLink}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70 mt-4"
              >
                {loadingAction === 'magic' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : null}
                <span>{loadingAction === 'magic' ? 'Sending...' : 'Continue'}</span>
              </button>
            </div>
          )}

          {view === 'magic_link_sent' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-dark">Check your email</h3>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed max-w-xs mx-auto">
                We sent a magic link to <span className="text-dark font-bold">{email}</span>. Click the link to complete linking your account.
              </p>
              <button 
                onClick={() => setView('main')}
                className="text-xs font-bold text-gray-400 hover:text-dark transition-colors mt-6"
              >
                Use a different email
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EmailTransitionModal;
