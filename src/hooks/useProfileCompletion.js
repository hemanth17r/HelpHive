import { useContext, useState, useEffect } from 'react';
import { AppContext } from '../store/AppContext';
import { NotificationContext } from '../store/NotificationContext';

export const useProfileCompletion = () => {
  const { userProfile, role, realLocation, savedAddresses = [] } = useContext(AppContext);
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

  let completionPercentage = 0;
  const missingItems = [];


  if (role === 'tasker') {
    if (hasValidNameAndPhone) completionPercentage += 20;
    else missingItems.push('profile');

    if (hasSkills) completionPercentage += 20;
    else missingItems.push('skills');

    if (hasUpiId) completionPercentage += 20;
    else missingItems.push('upi');

    if (hasOsLocation) completionPercentage += 20;
    else missingItems.push('os_location');

    if (hasNotifications) completionPercentage += 20;
    else missingItems.push('notifications');

  } else {
    // Poster (Hirer)
    if (hasJobLocation) completionPercentage += 30;
    else missingItems.push('job_location');

    if (hasValidNameAndPhone) completionPercentage += 30;
    else missingItems.push('profile');

    if (hasNotifications) completionPercentage += 20;
    else missingItems.push('notifications');

    if (hasOsLocation) completionPercentage += 20;
    else missingItems.push('os_location');
  }

  return {
    completionPercentage,
    missingItems,
    hasJobLocation,
    hasOsLocation,
    hasNotifications,
    hasValidNameAndPhone,
    hasSkills,
    hasUpiId,
    hasEmail
  };
};
