import { useContext, useState, useEffect } from 'react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';

export const useProfileCompletion = () => {
  const { userId, userProfile, role, realLocation, savedAddresses = [] } = useContext(AppContext);
  const { pushPermission, pushSupported } = useContext(NotificationContext);
  
  const [locationPermission, setLocationPermission] = useState('prompt');

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(res => {
        setLocationPermission(res.state);
        res.onchange = () => setLocationPermission(res.state);
      }).catch(e => {
        // Handle browsers where geolocation permission query is unsupported
        setLocationPermission(realLocation ? 'granted' : 'prompt');
      });
    } else {
      setLocationPermission(realLocation ? 'granted' : 'prompt');
    }
  }, [realLocation]);

  const hasValidNameAndPhone = userProfile?.name && 
                               userProfile.name !== 'Guest User' && 
                               userProfile.name !== 'New User' &&
                               userProfile?.phone &&
                               userProfile.phone !== 'Add Phone';

  const hasSkills = userProfile?.skills && Array.isArray(userProfile.skills) && userProfile.skills.length > 0;
  const hasUpiId = !!userProfile?.upiId;
  const hasJobLocation = savedAddresses.length > 0;
  const hasOsLocation = locationPermission === 'granted' || !!realLocation;
  const hasNotifications = !pushSupported || pushPermission === 'granted';
  const hasEmail = !!userProfile?.email && userProfile.email !== 'Add Email';
  const hasServiceArea = !!(userProfile?.serviceAreaLat && userProfile?.serviceAreaLng);

  const isTestUser = userProfile?.name && (
    userProfile.name.toLowerCase().includes('test')
  );

  let completionPercentage = 100;
  const missingItems = [];
  const missingWizardItems = [];

  if (!isTestUser) {
    completionPercentage = 0;
    
    // Unified 4 Core Pillars for every User (25% each):
    // 1. Auth (25%)
    const hasAuth = !!userId;
    if (hasAuth) completionPercentage += 25;

    // 2. Identity: Name & Phone (25%)
    if (hasValidNameAndPhone) {
      completionPercentage += 25;
    } else {
      missingItems.push('profile');
      missingWizardItems.push('profile');
    }

    // 3. Tactical Skills (25%)
    if (hasSkills) {
      completionPercentage += 25;
    } else {
      missingItems.push('skills');
      missingWizardItems.push('skills');
    }

    // 4. Sector Calibration: Service Area or Saved Location (25%)
    const hasSectorLocation = hasServiceArea || hasJobLocation;
    if (hasSectorLocation) {
      completionPercentage += 25;
    } else {
      missingItems.push('service_area');
      missingWizardItems.push('service_area');
    }

    // Secondary system access (Location & Notifications)
    if (!hasOsLocation) {
      missingItems.push('os_location');
    }
    if (!hasNotifications) {
      missingItems.push('notifications');
    }
  }

  return {
    completionPercentage,
    missingItems,
    missingWizardItems,
    hasJobLocation,
    hasOsLocation,
    hasNotifications,
    hasValidNameAndPhone,
    hasSkills,
    hasUpiId,
    hasEmail
  };
};
