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
    userProfile.name.toLowerCase().includes('tester') || 
    userProfile.name.toLowerCase().includes('debug') || 
    userProfile.name === 'HR'
  );

  let completionPercentage = 100;
  const missingItems = [];
  const missingWizardItems = [];

  if (!isTestUser) {
    completionPercentage = 0;
    if (role === 'tasker') {
    // 4 Steps: 1. Auth (25%), 2. Skills (25%), 3. Service Area (25%), 4. Profile & UPI (25%)
    const hasAuth = !!userId;
    if (hasAuth) completionPercentage += 25;
    
    if (hasSkills) completionPercentage += 25;
    else {
      missingItems.push('skills');
      missingWizardItems.push('skills');
    }

    if (hasServiceArea) completionPercentage += 25;
    else {
      missingItems.push('service_area');
      missingWizardItems.push('service_area');
    }

    if (hasValidNameAndPhone && hasUpiId) completionPercentage += 25;
    else {
      if (!hasValidNameAndPhone) {
        missingItems.push('profile');
        missingWizardItems.push('profile');
      }
      if (!hasUpiId) {
        missingItems.push('upi');
        missingWizardItems.push('upi');
      }
    }

    if (hasOsLocation) completionPercentage += 0; // Excluded from loading percentage calculation
    else missingItems.push('os_location');

    if (hasNotifications) completionPercentage += 0; // Excluded from loading percentage calculation
    else missingItems.push('notifications');

  } else {
    // Poster (Hirer)
    // 3 Steps: 1. Auth (34%), 2. Profile/Name/Phone (33%), 3. Address setup (33%)
    const hasAuth = !!userId;
    if (hasAuth) completionPercentage += 34;

    if (hasValidNameAndPhone) completionPercentage += 33;
    else {
      missingItems.push('profile');
      missingWizardItems.push('profile');
    }

    if (hasJobLocation) completionPercentage += 33;
    else {
      missingItems.push('job_location');
      missingWizardItems.push('job_location');
    }

    if (hasNotifications) completionPercentage += 0; // Excluded from loading percentage
    else missingItems.push('notifications');

    if (hasOsLocation) completionPercentage += 0; // Excluded from loading percentage
    else missingItems.push('os_location');
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
