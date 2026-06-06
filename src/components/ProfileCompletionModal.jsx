import React, { useState, useEffect, useContext } from 'react';
import { User, Phone, CheckCircle2, X, Download } from 'lucide-react';
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

  const currentName = userProfile?.name;
  const currentPhone = userProfile?.phone;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      setName(currentName || '');
      setPhone(currentPhone || '');
      setError('');
    } else {
      if (shouldRender) {
        setIsAnimatingOut(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsAnimatingOut(false);
        }, 200); // Match closing transition duration (200ms)
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length < 10) {
      setError('Please enter a valid phone number.');
      return;
    }

    setError('');
    onSubmit(name.trim(), rawPhone);
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
            <h2 className="text-lg font-black text-dark">Complete Profile</h2>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Required to continue</p>
          </div>
          <div className="flex items-center space-x-3">

            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            
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

          </form>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-border shrink-0 pb-8 sm:pb-4">
          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Save & Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;
