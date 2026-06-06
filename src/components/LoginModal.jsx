import React, { useState, useEffect, useContext } from 'react';
import { Phone, CheckCircle2, X } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';

const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithPhone } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [phone, setPhone] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');


  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      setPhone('');
      setError('');
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

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, ''); // Keep only digits
    let formatted = input;
    if (input.length > 3 && input.length <= 6) {
      formatted = `${input.slice(0, 3)}-${input.slice(3)}`;
    } else if (input.length > 6) {
      formatted = `${input.slice(0, 3)}-${input.slice(3, 6)}-${input.slice(6, 10)}`;
    }
    setPhone(formatted);
    setError('');
  };

  const handleLogin = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length < 10) {
      showToast('Enter a valid 10-digit phone number.', 'error');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await loginWithPhone(rawPhone);
      
      if (response?.success) {
        onClose();
      } else {
        if (response?.reason === 'network') {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError("We couldn't find an account associated with this phone number. Please check the number or create a new account.");
        }
      }
    } catch (e) {
      setError("An unexpected error occurred. Please try again.");
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
            <h2 className="text-lg font-black text-dark">Welcome Back</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Log in with your phone number</p>
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
            
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                Phone Number
              </label>
              <div className="flex items-center bg-white border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  maxLength={12}
                  onChange={handlePhoneChange}
                  disabled={isLoading}
                  placeholder="e.g. 987-654-3210"
                  className={`w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full ${isLoading ? 'text-gray-500 cursor-not-allowed' : ''}`}
                />
                
                {phone.replace(/\D/g, '').length >= 10 && !isLoading && (
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="bg-dark text-white px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ml-2 cursor-pointer shrink-0"
                  >
                    Log In
                  </button>
                )}
              </div>
            </div>
            
            {isLoading && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
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
