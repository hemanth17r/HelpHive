import { supabase } from '../config/supabase';
import { parseEWKBPoint } from '../utils/location';

export const api = {
  supabase,
  // --- Auth API ---
  signInWithOtp: async (email) => {
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
  },
  signInWithOAuth: async (provider) => {
    return await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
  },
  signOut: async () => {
    return await supabase.auth.signOut();
  },
  getSession: async () => {
    return await supabase.auth.getSession();
  },
  getUser: async () => {
    return await supabase.auth.getUser();
  },

  // --- Jobs API ---
  fetchJobs: async () => {
    const { data, error } = await supabase.from('jobs').select('*');
    if (data) {
      const posterIds = [...new Set(data.map(j => j.poster_id).filter(Boolean))];
      const taskerIds = [...new Set(data.map(j => j.tasker_id).filter(Boolean))];
      const profileIds = [...new Set([...posterIds, ...taskerIds])];
      
      let profileMap = {};
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, bird, phone, upi_id').in('id', profileIds);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = p; });
        }
      }

      const mappedJobs = data.map(j => {
        const coords = parseEWKBPoint(j.location) || { lng: 0, lat: 0 };
        const poster = profileMap[j.poster_id] || {};
        const tasker = profileMap[j.tasker_id] || {};
        
        return {
          ...j,
          posterId: j.poster_id,
          taskerId: j.tasker_id,
          skillId: j.skill_id,
          peopleNeeded: j.people_needed,
          timePosted: j.created_at,
          lng: coords.lng,
          lat: coords.lat,
          posterName: poster.name,
          posterBird: poster.bird,
          posterPhone: poster.phone,
          taskerName: tasker.name,
          taskerBird: tasker.bird,
          taskerPhone: tasker.phone,
          taskerUpi: tasker.upi_id
        };
      });
      return { data: mappedJobs, error };
    }
    return { data, error };
  },

  postJob: async (jobData) => {
    const { data, error } = await supabase.from('jobs').insert({
      poster_id: jobData.posterId,
      skill_id: jobData.skillId,
      description: jobData.description,
      people_needed: jobData.peopleNeeded,
      amount: jobData.amount,
      location: jobData.locationStr, // formatted POINT(...)
      otp: jobData.otp
    }).select().single();
    
    return { data, error };
  },

  updateJob: async (jobId, updates) => {
    const { data, error } = await supabase.from('jobs').update(updates).eq('id', jobId).select().single();
    return { data, error };
  },

  deleteJob: async (jobId) => {
    return await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);
  },

  verifyJobOtp: async (jobId, otp) => {
    const { data, error } = await supabase.rpc('verify_job_otp', {
      p_job_id: jobId,
      p_otp: otp
    });
    return { data, error };
  },

  sendNotification: async (userId, title, body, actionUrl) => {
    // 1. Try to invoke edge function (sends push AND saves to DB)
    const { data, error } = await supabase.functions.invoke('push-notification', {
      body: { user_id: userId, title, body, action_url: actionUrl }
    });

    // 2. If edge function fails (e.g. not deployed yet), fallback to just inserting into DB so in-app works
    if (error) {
      console.warn('Edge function failed or not deployed, falling back to DB insert:', error);
      return await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'system',
          title,
          body,
          action_url: actionUrl
        });
    }
    
    return { data, error };
  },

  subscribeToJobs: (callback) => {
    const channel = supabase
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        callback();
      })
      .subscribe();
      
    return { unsubscribe: () => supabase.removeChannel(channel) };
  },

  // --- Profiles API ---
  fetchProfile: async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return { data, error };
  },

  findProfileByPhone: async (phone) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return { data, error };
  },

  createProfile: async (profileData) => {
    const { data, error } = await supabase.from('profiles').insert(profileData).select().single();
    return { data, error };
  },

  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    return { data, error };
  },
  
  upsertUserLocation: async (locationData) => {
    const { data, error } = await supabase.from('user_locations').upsert(locationData);
    return { data, error };
  },

  // --- Event Tracking API ---
  logEvent: async (eventType, payload) => {
    const { userId, role, entityId, metadata } = payload;
    supabase.from('app_events').insert({
      event_type: eventType,
      user_id: userId || null,
      active_role: role || null,
      entity_id: entityId || null,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) console.error(`[EventTracker] Failed to log event: ${eventType}`, error);
    });
  }
};
