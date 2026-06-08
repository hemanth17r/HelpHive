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

export const formatSelectedTime = (expiresAt) => {
  if (!expiresAt) return 'No time specified';
  
  const date = new Date(expiresAt);
  if (isNaN(date.getTime())) return expiresAt;

  const now = new Date();
  
  // Reset hours to compare dates only
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = targetDate - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Format the time part (e.g. 3 PM, 4 PM)
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
  const timeStr = `${hours}${minStr} ${ampm}`;

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Tomorrow, ${timeStr}`;
  } else if (diffDays === -1) {
    return `Yesterday, ${timeStr}`;
  } else {
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    return `${day} ${month}, ${timeStr}`;
  }
};

/**
 * Parses a PostGIS Point geometry hex string (EWKB) into longitude and latitude coordinates.
 * @param {string|object} ewkb The PostGIS point hex string or GeoJSON point object.
 * @returns {{lng: number, lat: number} | null}
 */
export const parseEWKBPoint = (ewkb) => {
  if (!ewkb) return null;
  if (typeof ewkb === 'object') {
    if (ewkb.coordinates) return { lng: ewkb.coordinates[0], lat: ewkb.coordinates[1] };
    if (ewkb.lng !== undefined && ewkb.lat !== undefined) return { lng: ewkb.lng, lat: ewkb.lat };
    return null;
  }
  
  try {
    if (ewkb.startsWith('{')) {
      const geo = JSON.parse(ewkb);
      return { lng: geo.coordinates[0], lat: geo.coordinates[1] };
    }
    
    const hexToDouble = (hexStr) => {
      const bytes = new Uint8Array(hexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const buffer = bytes.buffer;
      const dataView = new DataView(buffer);
      return dataView.getFloat64(0, true);
    };
    
    const isLittleEndian = ewkb.startsWith('01');
    if (!isLittleEndian) {
      const hexToDoubleBE = (hexStr) => {
        const bytes = new Uint8Array(hexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const buffer = bytes.buffer;
        const dataView = new DataView(buffer);
        return dataView.getFloat64(0, false);
      };
      const typeByte = ewkb.slice(2, 10);
      const hasSRID = (parseInt(typeByte, 16) & 0x20000000) !== 0;
      const offset = hasSRID ? 18 : 10;
      const lngHex = ewkb.slice(offset, offset + 16);
      const latHex = ewkb.slice(offset + 16, offset + 32);
      return { lng: hexToDoubleBE(lngHex), lat: hexToDoubleBE(latHex) };
    }
    
    const hasSRID = ewkb.slice(8, 10) === '20';
    const offset = hasSRID ? 18 : 10;
    const lngHex = ewkb.slice(offset, offset + 16);
    const latHex = ewkb.slice(offset + 16, offset + 32);
    
    return {
      lng: hexToDouble(lngHex),
      lat: hexToDouble(latHex)
    };
  } catch (e) {
    console.error("Failed to parse EWKB Point:", ewkb, e);
    return null;
  }
};
