import React, { useState, useEffect } from 'react';
import BirdAvatar, { BIRD_LIST } from './BirdAvatars';
import { X } from 'lucide-react';

const BirdSelector = ({ isOpen, onClose, selectedBird, onSelectBird }) => {
  const [animatingBird, setAnimatingBird] = useState(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
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
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  const selectTimeoutRef = React.useRef(null);

  const handleSelect = (birdId) => {
    setAnimatingBird(birdId);
    onSelectBird(birdId);

    // Close after 300ms
    if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    selectTimeoutRef.current = setTimeout(() => {
      setAnimatingBird(null);
      onClose();
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    };
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/50 ${
        isAnimatingOut ? 'modal-backdrop-close' : 'modal-backdrop-open'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-[32px] shadow-2xl border-t sm:border border-border px-6 pt-5 pb-8 relative ${
          isAnimatingOut ? 'modal-content-close' : 'modal-content-open'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full cursor-pointer" onClick={onClose} />
        </div>
        
        {/* Desktop Close Button */}
        <button 
          onClick={onClose}
          className="hidden sm:flex absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h3 className="text-sm font-black text-dark text-center mb-1">
          Choose Your Bird
        </h3>
        <p className="text-[10px] font-semibold text-gray-400 text-center mb-5">
          Each bird reflects a personality trait
        </p>

        {/* 3×2 Grid */}
        <div className="grid grid-cols-3 gap-3">
          {BIRD_LIST.map((bird) => {
            const isSelected = selectedBird === bird.id;
            const isAnimating = animatingBird === bird.id;

            return (
              <button
                key={bird.id}
                onClick={() => handleSelect(bird.id)}
                className="flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer focus:outline-none"
                style={{
                  borderColor: isSelected ? '#FF6B35' : '#F0F0F0',
                  backgroundColor: isSelected ? '#FFF3ED' : '#FAFAFA',
                  transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms ease, background-color 150ms ease'
                }}
              >
                <div
                  className="rounded-full overflow-hidden mb-1.5"
                  style={{
                    border: isSelected ? '3px solid #FF6B35' : '3px solid transparent',
                    transition: 'border-color 150ms ease'
                  }}
                >
                  <BirdAvatar birdName={bird.id} size={56} />
                </div>
                <span className="text-[10px] font-black text-dark leading-tight">
                  {bird.name}
                </span>
                <span
                  className="text-[8px] font-bold uppercase tracking-wider mt-0.5"
                  style={{ color: isSelected ? '#FF6B35' : '#9CA3AF' }}
                >
                  {bird.trait}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BirdSelector;
