import React, { useContext, useState } from 'react';
import { MapPin, Mail, ArrowLeft, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import Tooltip from '../components/Tooltip';

const ServiceUnavailableScreen = () => {
  const { userLocation, addLeadNotification, popScreen } = useContext(AppContext);
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const cityName = userLocation ? userLocation.name.split(',')[1]?.trim() || userLocation.name : 'your city';
  const neighborhoodName = userLocation ? userLocation.name.split(',')[0]?.trim() : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      alert('Please enter your email or phone number');
      return;
    }

    addLeadNotification(inputValue, userLocation?.name || 'Unknown');
    setSubmitted(true);

    // Alert toast simulation
    alert(`Got it! We will notify you when HelpHive reaches ${cityName}`);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-8 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <Tooltip text="Change location">
          <button
            onClick={() => popScreen()}
            className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Tooltip>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
          Coming Soon
        </span>
        <div className="w-10"></div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 my-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-center">
        
        {/* LIGHT ILLUSTRATION - Location pin with coming soon symbol */}
        <div className="relative flex items-center justify-center w-24 h-24 bg-orange-50 rounded-full border border-primary/10">
          <div className="absolute top-1 right-1 bg-primary text-white p-1 rounded-full shadow-xs">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <MapPin className="w-12 h-12 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-dark tracking-tight leading-tight">
            HelpHive isn't here yet
          </h2>
          <p className="text-xs font-semibold text-gray-400 leading-relaxed px-2">
            We are currently expanding HelpHive across India. We will be in your area soon!
          </p>
        </div>

        {submitted ? (
          /* Success message block */
          <div className="w-full bg-green-50 border border-green-200/50 p-5 rounded-3xl space-y-2 animate-scale-up">
            <div className="flex justify-center text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xs font-black text-green-800 uppercase tracking-wider">Interest Saved</h3>
            <p className="text-[11px] text-green-600 font-bold leading-normal">
              Got it! We will notify you at <span className="underline">{inputValue}</span> when HelpHive reaches your area.
            </p>
          </div>
        ) : (
          /* Form Input */
          <form onSubmit={handleSubmit} className="w-full space-y-3.5">
            <div className="text-left space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                Notify me on launch
              </label>
              <div className="flex items-center bg-gray-50 border border-border focus-within:border-primary focus-within:bg-white rounded-2xl px-3.5 py-1.5 w-full">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter email or phone number"
                  className="w-full bg-transparent border-0 px-2.5 py-2 text-xs font-semibold outline-hidden text-dark"
                />
              </div>
            </div>

            <Tooltip text="Submit your notification request" position="bottom" className="w-full flex justify-center">
              <button
                type="submit"
                className="w-full max-w-sm flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer text-xs"
              >
                <Send className="w-4.5 h-4.5" />
                <span>Notify Me</span>
              </button>
            </Tooltip>
          </form>
        )}
      </div>

      {/* Footer Area List */}
      <div className="text-center py-2 shrink-0 border-t border-border w-full">
        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">
          Currently Live In
        </span>
        <p className="text-[10px] font-black text-dark tracking-wide">
          Nationwide <span className="text-[8px] font-bold text-gray-500">across India</span>
        </p>
      </div>

    </div>
  );
};

export default ServiceUnavailableScreen;
