export const MARKETPLACE_RULES = {
  // Maturity thresholds based on eligible tasker supply
  MATURITY_THRESHOLDS: {
    BOOTSTRAP: { maxSupply: 5, label: 'bootstrap' }, // 0 to 5 taskers
    GROWTH: { maxSupply: 15, label: 'growth' },      // 6 to 15 taskers
    MATURE: { maxSupply: Infinity, label: 'mature' } // > 15 taskers
  },

  // Coverage Levels for Taskers
  COVERAGE_LEVELS: {
    NEARBY: { id: 'nearby', label: 'Nearby Only', radiusMeters: 5000, desc: '0-5 km' },
    LOCAL: { id: 'local', label: 'Local Area', radiusMeters: 10000, desc: '0-10 km' },
    FLEXIBLE: { id: 'flexible', label: 'Flexible', radiusMeters: 20000, desc: '0-20 km' }
  },

  // Category specific defaults for coverage level
  CATEGORY_DEFAULTS: {
    moving: 'nearby',
    local_helpers: 'nearby',
    errands: 'local',
    personal_assistance: 'local',
    queue_standing: 'local',
    events: 'flexible',
    creative: 'flexible',
    others_physical: 'local',
    video_editing: 'flexible',
    graphic_design: 'flexible',
    writing_translation: 'flexible',
    tech_support: 'flexible',
    others_remote: 'flexible'
  },
  
  // Base waitlist activation threshold (if supply is strictly < this, activate waitlist)
  // For pre-launch, even 1 tasker is enough. So waitlist only if 0 taskers.
  MIN_SUPPLY_FOR_ACTIVATION: 1,

  // Configurable Failure Reasons for analytics
  FAILURE_REASONS: {
    NO_TASKER_ACCEPTED: 'NO_TASKER_ACCEPTED',
    TASKER_CANCELLED: 'TASKER_CANCELLED',
    HIRER_CANCELLED: 'HIRER_CANCELLED',
    OTP_NOT_COMPLETED: 'OTP_NOT_COMPLETED',
    JOB_EXPIRED: 'JOB_EXPIRED',
    PAYMENT_CONFUSION: 'PAYMENT_CONFUSION',
    UNKNOWN: 'UNKNOWN',
    OTHER: 'OTHER'
  },

  // Time window for measuring if a waitlisted hirer successfully posts after activation
  LIQUIDITY_CONVERSION_WINDOW_HOURS: 48,

  // Throttling configuration for Density Nudges
  NOTIFICATION_THROTTLING: {
    MAX_PER_CATEGORY_PER_DAY: 2,
    MAX_PER_LOCATION_PER_DAY: 3,
    COOLDOWN_HOURS: 48,
    MIN_DEMAND_SPIKE_PERCENTAGE: 30 // Waitlist must grow by 30% to override cooldown
  }
};
