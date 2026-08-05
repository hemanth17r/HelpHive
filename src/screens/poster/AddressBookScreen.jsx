import React, { useContext, useState } from 'react';
import { ArrowLeft, MapPin, MoreVertical, Plus, Check } from 'lucide-react';
import { AppContext } from '../../store/AppContext';

const AddressBookScreen = () => {
  const { popScreen, pushScreen, savedAddresses, removeSavedAddress, setDefaultAddress, changeLocation, setEditAddressData } = useContext(AppContext);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    removeSavedAddress(id);
    setActiveMenuId(null);
  };

  const handleSetDefault = (e, address) => {
    e.stopPropagation();
    setDefaultAddress(address.id);
    const addressName = address.completeAddress?.startsWith('Location at') && address.landmark
      ? address.landmark
      : (address.completeAddress?.split(',')[0] || address.type || 'Location');
    changeLocation({ name: addressName, lat: address.lat || 0, lng: address.lng || 0 });
    setActiveMenuId(null);
  };

  const handleEdit = (e, address) => {
    e.stopPropagation();
    setEditAddressData(address);
    pushScreen('add_edit_address');
    setActiveMenuId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-white sticky top-0 z-10 shrink-0">
        <div className="flex items-center">
          <button 
            onClick={popScreen}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-dark ml-2">Saved Locations</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-xl mx-auto w-full">
          {savedAddresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-primary opacity-50" />
              </div>
              <h3 className="text-lg font-black text-dark mb-1">No saved locations</h3>
              <p className="text-xs font-bold text-gray-400">Add a location to book services faster.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedAddresses.map((address) => (
                <div 
                  key={address.id} 
                  className={`bg-white rounded-2xl p-4 border shadow-sm relative cursor-pointer hover:border-primary/50 transition-colors ${address.isDefault ? 'border-primary' : 'border-border'}`}
                  onClick={(e) => handleSetDefault(e, address)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-dark">{address.type || 'Location'}</h4>
                        {address.isDefault && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">Default</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === address.id ? null : address.id);
                        }}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {activeMenuId === address.id && (
                        <>
                          {/* Click-away backdrop */}
                          <div 
                            className="fixed inset-0 z-20 cursor-default" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                            }}
                          />
                          <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-border overflow-hidden z-30 animate-[fadeIn_150ms_ease-out]">
                            <button onClick={(e) => handleEdit(e, address)} className="w-full text-left px-4 py-3 text-xs font-bold text-dark hover:bg-gray-50 cursor-pointer">Edit</button>
                            <button onClick={(e) => handleSetDefault(e, address)} className="w-full text-left px-4 py-3 text-xs font-bold text-dark hover:bg-gray-50 cursor-pointer">Set as Default</button>
                            <button onClick={(e) => handleDelete(e, address.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 cursor-pointer">Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs font-medium text-gray-600 pl-[3.25rem] space-y-1">
                    <p className="line-clamp-2 leading-relaxed">
                      {address.completeAddress?.startsWith('Location at') && address.landmark 
                        ? address.landmark 
                        : address.completeAddress}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-20 pointer-events-none">
        <div className="max-w-xl mx-auto w-full pointer-events-auto flex justify-center">
          <button 
            onClick={() => { setEditAddressData(null); pushScreen('add_edit_address'); }}
            className="w-full max-w-xs flex items-center justify-center space-x-2 bg-primary hover:bg-primary/95 text-white py-4 rounded-2xl shadow-lg font-black tracking-wide cursor-pointer active:scale-[0.99] transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressBookScreen;
