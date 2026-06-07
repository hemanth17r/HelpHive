import React, { useState, useEffect, useContext } from 'react';
import { Mail, CheckCircle2, X } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';

const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithEmail, loginWithGoogle } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [email, setEmail] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      setEmail('');
      setError('');
      setSuccessMsg('');
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

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleLogin = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const response = await loginWithEmail(email);
      
      if (response?.success) {
        setSuccessMsg("Check your email! We sent you a magic link to sign in.");
      } else {
        setError(response?.reason || "Network error. Please check your connection and try again.");
      }
    } catch (e) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await loginWithGoogle();
      if (!response?.success) {
        setError(response?.reason || "Failed to login with Google.");
      }
    } catch (e) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs ${
        isAnimatingOut ? 'modal-backdrop-close' : 'modal-backdrop-open'
      }`}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] flex flex-col overflow-hidden shadow-2xl ${
          isAnimatingOut ? 'modal-content-close' : 'modal-content-open'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-white shrink-0">
          <div>
            <h2 className="text-lg font-black text-dark">Welcome</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Log in or sign up to continue</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50">
          <div className="space-y-4">
            
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 text-dark font-black py-3 px-6 rounded-2xl shadow-sm active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <div className="flex items-center bg-white border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  placeholder="name@example.com"
                  className={`w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full ${isLoading ? 'text-gray-500 cursor-not-allowed' : ''}`}
                />
                
                {email.includes('@') && email.includes('.') && !isLoading && (
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="bg-dark hover:bg-black text-white px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ml-2 cursor-pointer shrink-0 transition-colors"
                  >
                    Send Link
                  </button>
                )}
              </div>
            </div>
            
            {isLoading && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {successMsg && (
              <div className="pt-1">
                <div className="flex items-start space-x-2 bg-green-50 p-3 rounded-xl border border-green-100">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-green-600 leading-relaxed">
                    {successMsg}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="pt-1">
                <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100/50 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
