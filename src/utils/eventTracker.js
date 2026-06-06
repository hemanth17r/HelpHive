import { api } from '../services/api';

/**
 * Lightweight, non-blocking event tracker for HelpHive MVP.
 * Sends events asynchronously to Supabase without blocking the main UI thread.
 */

export const trackEvent = (eventType, payload = {}) => {
  const { userId, role, entityId, metadata } = payload;
  
  // EVENT TRACKING DISABLED FOR MVP CONSTRUCTION
  // To re-enable event instrumentation once flows are stable, 
  // remove the early return below.
  return;
  
  // Fire and forget - do not await to avoid blocking UI
  api.logEvent(eventType, payload);
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
  
  // Marketplace
  TASK_CREATION: 'task_creation',
  TASK_VIEWED: 'task_viewed',
  TASK_APPLICATION: 'task_application', // if taskers apply to jobs
  TASK_ACCEPTANCE: 'task_acceptance',
  TASK_COMPLETION: 'task_completion',
  TASK_CANCELLATION: 'task_cancellation',
  
  // Trust
  RATING_SUBMITTED: 'rating_submitted',
  BADGE_SENT: 'badge_sent',
  REPORT_SUBMITTED: 'report_submitted',
  
  // System
  CRITICAL_FAILURE: 'critical_failure',
  ACTION_ERROR: 'action_error'
};
