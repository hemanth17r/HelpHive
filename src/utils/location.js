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
    const overallTimeout = setTimeout(() => {
      reject(new Error('Location request timed out (user did not respond to prompt or system hung).'));
    }, 15000); // 15 seconds max wait time for the whole process including prompt

    const clearOverallTimeout = () => clearTimeout(overallTimeout);

    if (!navigator.geolocation) {
      clearOverallTimeout();
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    requestPosition(
      (pos) => { clearOverallTimeout(); resolve(pos); },
      (err) => { clearOverallTimeout(); reject(err); }
    );
  });
};

async function fetchIpLocation() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lng: data.longitude
        };
      }
    }
  } catch (e) {
    console.warn('Failed to fetch location from ipapi.co:', e);
  }
  return null;
}

function requestPosition(resolve, reject) {
  const handleFailure = async (originalError) => {
    console.warn('Native geolocation failed or denied, trying IP fallback...', originalError);
    try {
      const ipLoc = await fetchIpLocation();
      if (ipLoc) {
        resolve(ipLoc);
        return;
      }
    } catch (ipErr) {
      console.warn('IP Geolocation fallback failed:', ipErr);
    }

    // If IP fallback also fails, reject with original error
    let message;
    switch (originalError.code) {
      case originalError.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable location access in your browser settings.';
        break;
      case originalError.POSITION_UNAVAILABLE:
        message = 'Location information is unavailable. Please check that GPS/location services are enabled on your device.';
        break;
      case originalError.TIMEOUT:
        message = 'Location request timed out. Please try again.';
        break;
      default:
        message = 'An unknown error occurred while getting your location.';
    }
    const enrichedError = new Error(message);
    enrichedError.code = originalError.code;
    enrichedError.originalError = originalError;
    reject(enrichedError);
  };

  try {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        // Try fallback to lower accuracy first
        if (error.code === error.PERMISSION_DENIED) {
          // If denied, do not try lower accuracy (it will just fail), try IP fallback directly
          handleFailure(error);
          return;
        }

        console.warn('High accuracy geolocation failed or timed out, trying low accuracy...', error);
        navigator.geolocation.getCurrentPosition(
          (position2) => {
            resolve({
              lat: position2.coords.latitude,
              lng: position2.coords.longitude
            });
          },
          (error2) => {
            handleFailure(error2);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  } catch (err) {
    handleFailure({ code: 0, message: err.message });
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
    if (ewkb.toLowerCase().startsWith('point')) {
      const match = ewkb.match(/point\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
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
