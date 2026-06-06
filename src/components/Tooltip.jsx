import React, { useState, useRef, useEffect } from 'react';

const Tooltip = ({ text, children, position = 'bottom' }) => {
  const [visible, setVisible] = useState(false);
  const pressTimer = useRef(null);

  // Desktop hover triggers
  const handleMouseEnter = () => {
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  // Mobile long press triggers
  const handleTouchStart = () => {
    pressTimer.current = setTimeout(() => {
      setVisible(true);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    // Keep it visible for 1.5 seconds on mobile so they can read it, then hide
    setTimeout(() => {
      setVisible(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  return (
    <div 
      className="relative inline-block cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      {visible && (
        <div 
          className="absolute z-50 whitespace-nowrap bg-dark text-white text-xs px-2.5 py-1.5 rounded-lg shadow-md transition-all duration-200 ease-out border border-white/10 top-full left-1/2 -translate-x-1/2 mt-2"
        >
          {text}
          {/* Arrow */}
          <div 
            className="absolute w-2 h-2 bg-dark border-l border-t border-white/10 rotate-45 bottom-full left-1/2 -translate-x-1/2 translate-y-1"
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
