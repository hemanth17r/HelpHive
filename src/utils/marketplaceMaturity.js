import { MARKETPLACE_RULES } from '../config/marketplaceRules';
import { api } from '../services/api';
import { SKILLS } from '../config/constants';

/**
 * Evaluates the marketplace maturity for a given category and location.
 * @param {string} categoryId 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<{stage: string, supplyCount: number, isActive: boolean}>}
 */
export const evaluateMarketplaceMaturity = async (categoryId, lat, lng) => {
  // Bypasses waitlist supply checks for remote categories since nationwide supply is always available
  const skill = SKILLS.find(s => s.id === categoryId);
  if (skill && skill.type === 'remote') {
    return {
      stage: MARKETPLACE_RULES.MATURITY_THRESHOLDS.MATURE.label,
      supplyCount: 99,
      isActive: true
    };
  }

  // Feature Flag: If waitlist is disabled, treat all categories & locations as active
  if (!MARKETPLACE_RULES.ENABLE_WAITLIST) {
    return {
      stage: MARKETPLACE_RULES.MATURITY_THRESHOLDS.MATURE.label,
      supplyCount: 99,
      isActive: true
    };
  }

  try {
    // Determine the max radius we should check for this category
    // For maturity, we can look at the flexible radius (20km) to see total potential supply
    const searchRadiusMeters = MARKETPLACE_RULES.COVERAGE_LEVELS.FLEXIBLE.radiusMeters;
    
    // Fetch local supply from API
    const { count, error } = await api.getLocalSupply(categoryId, lat, lng, searchRadiusMeters);
    
    if (error) {
      console.error('Failed to get local supply', error);
      // Fallback to active if API fails, to prevent locking users out due to a bug
      return { stage: MARKETPLACE_RULES.MATURITY_THRESHOLDS.BOOTSTRAP.label, supplyCount: 1, isActive: true };
    }

    const supplyCount = count || 0;
    
    // Determine stage
    let stage = MARKETPLACE_RULES.MATURITY_THRESHOLDS.MATURE.label;
    if (supplyCount <= MARKETPLACE_RULES.MATURITY_THRESHOLDS.BOOTSTRAP.maxSupply) {
      stage = MARKETPLACE_RULES.MATURITY_THRESHOLDS.BOOTSTRAP.label;
    } else if (supplyCount <= MARKETPLACE_RULES.MATURITY_THRESHOLDS.GROWTH.maxSupply) {
      stage = MARKETPLACE_RULES.MATURITY_THRESHOLDS.GROWTH.label;
    }

    // Determine activation
    const isActive = supplyCount >= MARKETPLACE_RULES.MIN_SUPPLY_FOR_ACTIVATION;

    return {
      stage,
      supplyCount,
      isActive
    };
  } catch (err) {
    console.error('Error in evaluateMarketplaceMaturity:', err);
    return { stage: MARKETPLACE_RULES.MATURITY_THRESHOLDS.BOOTSTRAP.label, supplyCount: 1, isActive: true };
  }
};
