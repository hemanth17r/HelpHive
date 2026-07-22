const rawKey = import.meta.env.VITE_OLA_MAPS_API_KEY || '';
const OLA_MAPS_API_KEY = rawKey;
const OLA_MAPS_BASE_URL = 'https://api.olamaps.io/places/v1';

// Delay tracking to prevent rapid firing during typing
let searchTimeout = null;

const formatShortAddress = (prediction) => {
  if (!prediction) return 'Unknown Location';
  // Ola Maps returns a formatted description. We take the first few parts.
  const parts = prediction.description.split(',').map(s => s.trim());
  if (parts.length > 3) {
    return parts.slice(0, 3).join(', ');
  }
  return prediction.description;
};

/**
 * Perform a forward geocoding/autocomplete search for an address
 * @param {string} query 
 * @returns {Promise<Array>} List of results
 */
export const searchAddress = async (query) => {
  if (!query || query.length < 3) return [];
  if (!OLA_MAPS_API_KEY) {
    console.warn('Ola Maps API key is missing. Please add VITE_OLA_MAPS_API_KEY to your .env file.');
    return [];
  }
  
  try {
    const response = await fetch(`${OLA_MAPS_BASE_URL}/autocomplete?input=${encodeURIComponent(query)}&api_key=${OLA_MAPS_API_KEY}`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    
    if (!response.ok) throw new Error('Ola Maps Autocomplete request failed');
    const data = await response.json();
    
    if (!data.predictions) return [];

    return data.predictions.map(item => ({
      lat: item.geometry?.location?.lat || 0,
      lng: item.geometry?.location?.lng || 0,
      displayName: formatShortAddress(item),
      fullAddress: item.description,
      address: item.structured_formatting
    })).filter(item => item.lat !== 0 && item.lng !== 0); // Exclude items without geometry
  } catch (error) {
    console.error('Error in searchAddress:', error);
    return [];
  }
};

/**
 * Fetch the closest landmark name using Ola Maps Nearby Search API
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<string|null>}
 */
export const getNearbyLandmark = async (lat, lng) => {
  if (!OLA_MAPS_API_KEY) return null;
  try {
    const response = await fetch(`${OLA_MAPS_BASE_URL}/nearbysearch?location=${lat},${lng}&api_key=${OLA_MAPS_API_KEY}`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status === 'ok' && data.predictions && data.predictions.length > 0) {
      const best = data.predictions[0];
      return best.structured_formatting?.main_text || best.name || best.description;
    }
  } catch (error) {
    console.error('Error fetching nearby landmark:', error);
  }
  return null;
};

// In-memory cache for reverse geocoding results to prevent redundant API calls
const reverseGeocodeCache = {};

/**
 * Perform a reverse geocode from coordinates
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<Object|null>}
 */
export const reverseGeocode = async (lat, lng) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }
  
  const cacheKey = `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  if (reverseGeocodeCache[cacheKey]) {
    return reverseGeocodeCache[cacheKey];
  }

  if (!OLA_MAPS_API_KEY) {
    console.warn('Ola Maps API key is missing. Please add VITE_OLA_MAPS_API_KEY to your .env file.');
    const result = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      displayName: `Location at ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
      fullAddress: `Location at Latitude ${lat}, Longitude ${lng}`,
      address: []
    };
    reverseGeocodeCache[cacheKey] = result;
    return result;
  }

  try {
    const response = await fetch(`${OLA_MAPS_BASE_URL}/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_MAPS_API_KEY}`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    
    if (!response.ok) throw new Error('Ola Maps Reverse Geocoding failed');
    const data = await response.json();
    
    if (data.status === 'ok' && data.results && data.results.length > 0) {
      const bestResult = data.results[0];
      let displayName = bestResult.formatted_address.split(',').slice(0, 3).join(', ').trim();
      
      if (!displayName || displayName.toLowerCase().includes('unknown location')) {
        const landmark = await getNearbyLandmark(lat, lng);
        displayName = landmark ? `Near ${landmark}` : `Location at ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
      }
      
      const result = {
        lat: parseFloat(bestResult.geometry?.location?.lat || lat),
        lng: parseFloat(bestResult.geometry?.location?.lng || lng),
        displayName: displayName,
        fullAddress: bestResult.formatted_address,
        address: bestResult.address_components
      };
      reverseGeocodeCache[cacheKey] = result;
      return result;
    }
    
    const landmark = await getNearbyLandmark(lat, lng);
    const result = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      displayName: landmark ? `Near ${landmark}` : `Location at ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
      fullAddress: `Location at Latitude ${lat}, Longitude ${lng}`,
      address: []
    };
    reverseGeocodeCache[cacheKey] = result;
    return result;
  } catch (error) {
    console.error('Error in reverseGeocode:', error);
    const landmark = await getNearbyLandmark(lat, lng);
    const result = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      displayName: landmark ? `Near ${landmark}` : `Location at ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
      fullAddress: `Location at Latitude ${lat}, Longitude ${lng}`,
      address: []
    };
    reverseGeocodeCache[cacheKey] = result;
    return result;
  }
};
