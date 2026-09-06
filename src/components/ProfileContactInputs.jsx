import React from 'react';
import { User, Phone } from 'lucide-react';
import { formatPhoneNumber } from '../utils/validation';

/**
 * Reusable Profile Contact Input Fields (Name + Phone)
 * Single source of truth for profile identity inputs with automatic phone formatting.
 */
const ProfileContactInputs = ({
  name,
  setName,
  phone,
  setPhone,
  namePlaceholder = 'e.g. Priya Sharma',
  phonePlaceholder = 'e.g. 987-654-3210',
  nameLabel = 'Full name',
  phoneLabel = 'Phone number',
  inputBg = 'bg-white'
}) => {
  const handlePhoneChange = (e) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  return (
    <div className="space-y-4">
      {/* Name Field */}
      <div className="space-y-1.5 text-left">
        <label className="block text-xs font-semibold text-gray-500">
          {nameLabel}
        </label>
        <div className={`flex items-center ${inputBg} border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[50px] transition-all`}>
          <User className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full bg-transparent border-0 px-2.5 py-2 text-xs sm:text-sm font-semibold outline-hidden text-dark h-full"
          />
        </div>
      </div>

      {/* Phone Field */}
      <div className="space-y-1.5 text-left">
        <label className="block text-xs font-semibold text-gray-500">
          {phoneLabel}
        </label>
        <div className={`flex items-center ${inputBg} border border-border focus-within:border-primary focus-within:bg-white rounded-xl px-3 w-full h-[50px] transition-all`}>
          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="tel"
            value={phone}
            maxLength={12}
            onChange={handlePhoneChange}
            placeholder={phonePlaceholder}
            className="w-full bg-transparent border-0 px-2.5 py-2 text-xs sm:text-sm font-semibold outline-hidden text-dark h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileContactInputs;
