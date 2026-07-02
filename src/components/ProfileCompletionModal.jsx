import React, { useState, useEffect, useContext, useRef } from 'react';
import { User, Phone, CheckCircle2, X } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';

const ProfileCompletionModal = ({ isOpen, onClose, onSubmit }) => {
  const { role, userProfile } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentName = userProfile?.name;
  const currentPhone = userProfile?.phone;

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      
      const cleanName = currentName === 'New User' || currentName === 'Guest User' ? '' : currentName || '';
      const cleanPhone = currentPhone === 'Add Phone' ? '' : currentPhone || '';
      setName(cleanName);

      // Format phone number
      const rawPhone = cleanPhone.replace(/\D/g, '');
      let formatted = rawPhone;
      if (rawPhone.length > 3 && rawPhone.length <= 6) {
        formatted = `${rawPhone.slice(0, 3)}-${rawPhone.slice(3)}`;
      } else if (rawPhone.length > 6) {
        formatted = `${rawPhone.slice(0, 3)}-${rawPhone.slice(3, 6)}-${rawPhone.slice(6, 10)}`;
      }
      setPhone(formatted);

      setError('');
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true);
        const timer = setTimeout(() => {
          if (isMounted.current) {
            setShouldRender(false);
            setIsAnimatingOut(false);
          }
        }, 200); // Match closing transition duration (200ms)
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, currentName, currentPhone, shouldRender]);

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
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    
    // Remove formatting characters to get raw 10 digits
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      console.log('handleSubmit: Before onSubmit');
      const res = await onSubmit(name.trim(), rawPhone);
      console.log('handleSubmit: After onSubmit, res:', res);
      if (res && res.success === false && isMounted.current) {
        setError(res.error);
      }
    } catch (err) {
      console.error('handleSubmit: Error in onSubmit', err);
      if (isMounted.current) {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      console.log('handleSubmit: finally setting isSubmitting(false)');
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div 
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 ${
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
            <h2 className="text-lg font-black text-dark">Complete Profile</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Required to continue</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Form Container wrapping both body and footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50 space-y-4">
            
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
                Name
              </label>
              <div className="flex items-center bg-white border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[52px]">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full"
                />
              </div>
            </div>

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
                  placeholder="e.g. 987-654-3210"
                  className="w-full bg-transparent border-0 px-2 py-2 text-sm font-semibold outline-hidden text-dark h-full"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                {error}
              </p>
            )}

          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 bg-white border-t border-border shrink-0 pb-8 sm:pb-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center space-x-2 font-black py-4 rounded-2xl transition-all cursor-pointer ${
                isSubmitting ? 'bg-primary/70 text-white cursor-not-allowed' : 'bg-primary hover:bg-primary/95 text-white shadow-lg shadow-primary/20 active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <span>{isSubmitting ? 'Saving...' : 'Save & Continue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;
