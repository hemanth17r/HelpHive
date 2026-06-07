/**
 * Request the user's current GPS location.
 * 
 * On mobile browsers, this can fail with various errors:
 * - PERMISSION_DENIED (1): User clicked "deny" or permission is blocked
 * - POSITION_UNAVAILABLE (2): GPS is off or device can't determine location
 * - TIMEOUT (3): Took too long to get a fix
 * - NotAllowedError: Browser blocked the permission prompt (e.g., overlay apps on Android)
 * 
 * @returns {Promise<{lat: number, lng: number}>}
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    // Check if we can query the permission state first (supported in modern browsers)
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          reject(new Error('Location permission has been denied. Please enable it in your browser settings.'));
          return;
        }
        // Permission is 'granted' or 'prompt' - proceed to get position
        requestPosition(resolve, reject);
      }).catch(() => {
        // permissions.query not supported for geolocation in this browser, try directly
        requestPosition(resolve, reject);
      });
    } else {
      requestPosition(resolve, reject);
    }
  });
};

function requestPosition(resolve, reject) {
  try {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let message;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable. Please check that GPS/location services are enabled on your device.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
          default:
            message = 'An unknown error occurred while getting your location.';
        }
        const enrichedError = new Error(message);
        enrichedError.code = error.code;
        enrichedError.originalError = error;
        reject(enrichedError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  } catch (err) {
    // Handle the case where the browser blocks the call entirely (e.g., NotAllowedError from overlay apps on Android)
    reject(new Error('Your browser blocked the location request. Close any overlays or bubbles from other apps, then try again.'));
  }
}

export const getTimeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  if (typeof timestamp === 'string' && timestamp.includes('ago')) return timestamp;
  
  // Try to parse the timestamp properly
  const timeStr = typeof timestamp === 'string' && !timestamp.includes('T') ? timestamp.replace(' ', 'T') : timestamp;
  const date = new Date(timeStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (isNaN(seconds) || seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};
