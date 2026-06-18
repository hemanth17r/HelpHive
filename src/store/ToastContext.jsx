import React, { createContext, useState, useCallback, useRef, useEffect } from 'react';

export const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // { message, type }
  const activeTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
    }
    setToast({ message, type });
    activeTimerRef.current = setTimeout(() => {
      setToast(null);
      activeTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (activeTimerRef.current) {
        clearTimeout(activeTimerRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down w-full max-w-[90vw] sm:max-w-md flex justify-center">
          <div className={`px-5 py-3 rounded-2xl shadow-lg text-sm font-bold flex items-center space-x-2 text-center ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-primary text-white'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
