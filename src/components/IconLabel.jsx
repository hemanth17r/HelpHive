import React from 'react';

const IconLabel = ({ 
  icon: Icon, 
  label, 
  tooltipText, 
  selected = false, 
  onClick = null,
  isNew = false,
  activeColor = 'bg-primary text-white border-primary',
  inactiveColor = 'bg-white text-dark border-border hover:border-primary/50'
}) => {
  const isClickable = typeof onClick === 'function';

  const content = (
    <button
      disabled={!isClickable}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl border transition-all duration-200 w-full select-none cursor-pointer ${
        isClickable ? 'active:scale-95' : ''
      } ${
        selected ? activeColor : inactiveColor
      }`}
    >
      {isNew && (
        <span className={`absolute -top-1.5 -right-1.5 text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-xs border transition-all duration-300 flex items-center gap-1 ${
          selected 
            ? 'bg-white text-primary border-white scale-105' 
            : 'bg-primary text-white border-primary'
        }`}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selected ? 'bg-primary' : 'bg-white'}`}></span>
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${selected ? 'bg-primary' : 'bg-white'}`}></span>
          </span>
          NEW
        </span>
      )}
      <div className={`p-2 rounded-xl transition-all duration-200 ${selected ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
        <Icon className="w-6 h-6 shrink-0" />
      </div>
      <span className="text-[11px] font-bold text-center mt-2 leading-tight tracking-wide break-words max-w-[85px]">
        {label}
      </span>
    </button>
  );

  return content;
};

export default IconLabel;
