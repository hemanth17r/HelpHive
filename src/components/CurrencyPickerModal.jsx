import React, { useState, useContext } from 'react';
import { AppContext } from '../store/AppContext';
import { SUPPORTED_CURRENCIES, hasManualCurrencyOverride } from '../utils/currency';
import { X, Search, Check, Globe, RotateCcw, Sparkles } from 'lucide-react';

export const CurrencyPickerModal = ({ isOpen, onClose }) => {
  const { currency, setCurrency, resetCurrency } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const isManual = hasManualCurrencyOverride();

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (cur) => {
    setCurrency(cur.code);
    onClose();
  };

  const handleReset = () => {
    resetCurrency();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-[28px] w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-dark leading-tight">Select Currency</h3>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                {isManual ? 'Custom selection active' : 'Auto-detected based on your region'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-dark hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 pb-2">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search currency by code or country..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Auto-Detect Reset Banner */}
        {isManual && (
          <div className="px-4 py-1">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-between p-2.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-xl text-amber-800 transition-colors cursor-pointer text-xs font-bold"
            >
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Reset to Auto-Detect</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-md">
                Restore default
              </span>
            </button>
          </div>
        )}

        {/* Currency List */}
        <div className="p-4 pt-2 overflow-y-auto space-y-2 divide-y divide-gray-50 flex-1">
          {filteredCurrencies.map((cur) => {
            const isSelected = currency?.code === cur.code;
            return (
              <button
                key={cur.code}
                onClick={() => handleSelect(cur)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-primary/10 border-2 border-primary text-primary font-black shadow-xs' 
                    : 'bg-white hover:bg-gray-50 border border-gray-100 text-dark'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl leading-none">{cur.flag}</span>
                  <div className="text-left">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-black">{cur.code}</span>
                      <span className="text-xs font-extrabold text-gray-500">({cur.symbol})</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 block">{cur.name}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isSelected && (
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {filteredCurrencies.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs font-bold">
              No currencies match "{searchQuery}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Applies across all task bounties & earnings</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-dark font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
export default CurrencyPickerModal;
