import { api } from '../services/api';

/**
 * Lightweight, non-blocking event tracker for HelpHive MVP.
 * Sends events asynchronously to Supabase without blocking the main UI thread.
 */

export const trackEvent = (eventType, payload = {}) => {
  try {
    // Fire and forget - never await, never block UI
    api.logEvent(eventType, payload);
  } catch (e) {
    // Analytics must NEVER crash the app or block user actions
    // Silently swallow any synchronous errors
  }
};

/**
 * Common Event Types Constants
 */
export const EVENTS = {
  // User Lifecycle
  SIGNUP: 'signup',
  LOGIN: 'login',
  LOGOUT: 'logout',
  ROLE_SWITCH: 'role_switch',
  
  // Marketplace Flow
  TASK_CREATION: 'task_creation',
  TASK_VIEWED: 'task_viewed',
  TASK_APPLICATION: 'task_application', // if taskers apply to jobs
  TASK_ACCEPTANCE: 'task_acceptance',
  TASK_COMPLETION: 'task_completion',
  TASK_CANCELLATION: 'task_cancellation',
  
  // V2 Marketplace Metrics
  WAITLIST_JOINED: 'waitlist_joined',
  WAITLIST_SHARED: 'waitlist_shared',
  NODE_ACTIVATED: 'node_activated',
  COVERAGE_AREA_DEFINED: 'coverage_area_defined',
  PRESENCE_ONLINE: 'presence_online',
  FIRST_JOB_COMPLETED: 'first_job_completed',
  FIRST_JOB_FAILED: 'first_job_failed',
  
  // Trust
  RATING_SUBMITTED: 'rating_submitted',
  BADGE_SENT: 'badge_sent',
  REPORT_SUBMITTED: 'report_submitted',
  
  // System
  CRITICAL_FAILURE: 'critical_failure',
  ACTION_ERROR: 'action_error'
};
