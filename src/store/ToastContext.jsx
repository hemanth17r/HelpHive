import React, { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

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

  const getIcon = () => {
    if (!toast) return null;
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-primary shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-primary shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-primary shrink-0" />;
    }
  };

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[90vw] sm:max-w-md flex justify-center">
          <div className="animate-slide-down bg-dark/95 backdrop-blur-md text-white border border-white/10 px-5 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 w-auto max-w-[90vw]">
            {getIcon()}
            <span className="text-[13px] font-bold tracking-wide text-white/95 leading-tight">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
