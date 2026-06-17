import React, { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
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
