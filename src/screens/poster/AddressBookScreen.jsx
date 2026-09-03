import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, MapPin, MoreVertical, Plus, Check } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';

const AddressBookScreen = () => {
  const { popScreen, pushScreen, savedAddresses, removeSavedAddress, setDefaultAddress, changeLocation, setEditAddressData } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Close menu on Escape or click outside
  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-menu-container]')) {
        setActiveMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveMenuId(null);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuId]);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    removeSavedAddress(id);
    setActiveMenuId(null);
    showToast('Location removed from saved bases.', 'info');
  };

  const handleSetDefault = (e, address) => {
    e.stopPropagation();
    if (address.isDefault && activeMenuId !== address.id) {
      return;
    }
    setDefaultAddress(address.id);
    const addressName = address.completeAddress?.startsWith('Location at') && address.landmark
      ? address.landmark
      : (address.completeAddress?.split(',')[0] || address.type || 'Location');
    changeLocation({ name: addressName, lat: address.lat || 0, lng: address.lng || 0 });
    setActiveMenuId(null);
    if (!address.isDefault) {
      showToast(`Set "${address.type || 'Location'}" as Primary Base`, 'success');
    }
  };

  const handleEdit = (e, address) => {
    e.stopPropagation();
    setEditAddressData(address);
    pushScreen('add_edit_address');
    setActiveMenuId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full relative z-20 overflow-hidden select-none">
      {/* Fullscreen backdrop when any card menu is active */}
      {activeMenuId && (
        <div 
          className="fixed inset-0 z-30 bg-black/10 animate-[overlayIn_120ms_ease-out] cursor-default"
          style={{ transform: 'translateZ(0)' }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenuId(null);
          }}
        />
      )}

      {/* Frameless Header */}
      <div 
        className="flex items-center justify-between px-4 pb-2 pt-3 bg-transparent shrink-0 z-10 max-w-md lg:max-w-xl mx-auto w-full"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button 
          onClick={popScreen}
          className="p-2 -ml-2 rounded-full hover:bg-slate-200/60 text-slate-700 transition-colors cursor-pointer active-scale"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Saved Locations</h2>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 pb-28">
        <div className="max-w-md lg:max-w-xl mx-auto w-full">
          {savedAddresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-orange-100/70 text-primary rounded-full flex items-center justify-center mb-4 border border-orange-200/60 shadow-inner">
                <MapPin className="w-8 h-8 opacity-75" />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1">No Saved Locations</h3>
              <p className="text-xs font-bold text-slate-400">Add a location to deploy and dispatch bounties faster.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedAddresses.map((address) => {
                const isMenuOpen = activeMenuId === address.id;
                return (
                  <div 
                    key={address.id} 
                    className={`bg-white rounded-2xl p-4 border shadow-2xs ${
                      isMenuOpen ? 'relative z-40' : 'relative z-10 cursor-pointer hover:border-primary/50'
                    } ${address.isDefault ? 'border-primary ring-1 ring-primary/20 shadow-xs' : 'border-slate-200/80'}`}
                    onClick={(e) => {
                      if (!isMenuOpen) handleSetDefault(e, address);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100/80 text-primary flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{address.type || 'Location'}</h4>
                          {address.isDefault && (
                            <span className="text-[9px] font-extrabold text-primary bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-md mt-0.5 inline-block">Primary Base</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="relative" data-menu-container>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : address.id);
                          }}
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                            isMenuOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                          }`}
                          aria-label="Location options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {isMenuOpen && (
                          <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right animate-[scaleIn_120ms_cubic-bezier(0.16,1,0.3,1)] transform-gpu divide-y divide-slate-100">
                            <button onClick={(e) => handleEdit(e, address)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer transition-colors">Edit</button>
                            <button onClick={(e) => handleSetDefault(e, address)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer transition-colors">Set as Default</button>
                            <button onClick={(e) => handleDelete(e, address.id)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 cursor-pointer transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2.5 text-[11px] font-bold text-slate-500 pl-[3.25rem] space-y-1">
                      <p className="line-clamp-2 leading-relaxed">
                        {address.completeAddress?.startsWith('Location at') && address.landmark 
                          ? address.landmark 
                          : address.completeAddress}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      <div className="absolute bottom-6 left-0 right-0 px-4 z-20 pointer-events-none">
        <div className="max-w-md lg:max-w-xl mx-auto w-full pointer-events-auto flex justify-center">
          <button 
            onClick={() => { setEditAddressData(null); pushScreen('add_edit_address'); }}
            className="w-full max-w-xs flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white py-3.5 rounded-2xl shadow-lg shadow-primary/25 font-black text-xs uppercase tracking-wide cursor-pointer active-scale transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressBookScreen;
