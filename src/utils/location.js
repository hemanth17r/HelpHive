export const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
export const INDIA_MAP_ZOOM = 5;

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
export const getCurrentLocation = (options = {}) => {
  const { onQuickFix = null } = options;

  return new Promise((resolve, reject) => {
    let resolved = false;
    let quickFixCoords = null;

    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    // Overall safety timeout (25s) to guard against browser hangs while user grants permissions
    const overallTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (quickFixCoords) {
          resolve(quickFixCoords);
        } else {
          const err = new Error('Location request timed out. Please check that GPS/location services are enabled and try again.');
          err.code = 3;
          reject(err);
        }
      }
    }, 25000);

    const finish = (fn, val) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(overallTimeout);
      fn(val);
    };

    // Stage 1: Quick cached check (Google Maps behavior)
    // If the device recently acquired a GPS fix (e.g. within 5 mins), return it immediately (<500ms)
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          quickFixCoords = coords;
          if (typeof onQuickFix === 'function') {
            try {
              onQuickFix(coords);
            } catch (e) {
              console.warn('onQuickFix handler error:', e);
            }
          }
        },
        () => {
          // Cached lookup failed/unavailable; proceed with active high-accuracy acquisition
        },
        { enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 }
      );
    } catch {
      // Ignore initial check failure
    }

    // Stage 2: Genuine High-Accuracy Satellite GPS Request
    // 14 seconds gives cold-start mobile GPS hardware (and A-GPS) ample time to lock onto satellites
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          finish(resolve, {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('High accuracy GPS acquisition failed or timed out:', error);

          // If user clicked "Deny", immediately fail without retrying
          if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
            const err = new Error('Location permission denied. Please enable location access in your browser settings.');
            err.code = 1;
            finish(reject, err);
            return;
          }

          // If Stage 1 already gave us a cached fix, we can safely resolve with it!
          if (quickFixCoords) {
            finish(resolve, quickFixCoords);
            return;
          }

          // Stage 3: Low-accuracy fallback (network / cell towers) with 8s timeout
          navigator.geolocation.getCurrentPosition(
            (position2) => {
              finish(resolve, {
                lat: position2.coords.latitude,
                lng: position2.coords.longitude
              });
            },
            (error2) => {
              console.warn('Native geolocation failed or denied:', error2);
              let message;
              switch (error2.code) {
                case 1:
                case error2.PERMISSION_DENIED:
                  message = 'Location permission denied. Please enable location access in your browser settings.';
                  break;
                case 2:
                case error2.POSITION_UNAVAILABLE:
                  message = 'Location information is unavailable. Please check that GPS/location services are enabled on your device.';
                  break;
                case 3:
                case error2.TIMEOUT:
                  message = 'Location request timed out. Please check that GPS is enabled and try again.';
                  break;
                default:
                  message = error2.message || 'An unknown error occurred while getting your location.';
              }
              const enrichedError = new Error(message);
              enrichedError.code = error2.code;
              enrichedError.originalError = error2;
              finish(reject, enrichedError);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
          );
        },
        { enableHighAccuracy: true, timeout: 14000, maximumAge: 60000 }
      );
    } catch (err) {
      if (quickFixCoords) {
        finish(resolve, quickFixCoords);
      } else {
        finish(reject, new Error(err.message || 'Failed to request location.'));
      }
    }
  });
};

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
