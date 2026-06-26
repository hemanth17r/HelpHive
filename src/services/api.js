import { supabase } from '../config/supabase';
import { parseEWKBPoint } from '../utils/location';
import { reverseGeocode } from '../utils/geocoding';

export const api = {
  supabase,
  
  // --- Auth API ---
  loginWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { data, error };
  },

  loginWithMagicLink: async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin
      }
    });
    return { data, error };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  },

  // --- Jobs API ---
  fetchJobs: async () => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('activeRole');
    
    let ratedJobsMap = {};
    if (userId) {
      const sessionRes = await supabase.auth.getSession();
      const authUserId = sessionRes.data?.session?.user?.id;
      if (authUserId) {
        const { data: feedbacks } = await supabase
          .from('feedbacks')
          .select('job_id, rating')
          .eq('giver_id', authUserId);
        if (feedbacks) {
          feedbacks.forEach(f => {
            ratedJobsMap[f.job_id] = f.rating;
          });
        }
      }
    }

    let query = supabase.from('jobs').select('*, primary_address:user_addresses!jobs_primary_address_id_fkey(*)');
    
    // Poster only sees their own jobs
    if (role === 'poster') {
      if (userId) {
        query = query.eq('poster_id', userId);
      } else {
        return { data: [], error: null };
      }
    } 
    // Tasker sees: jobs with active offers (pending/accepted) + jobs assigned to them
    else if (role === 'tasker') {
      if (!userId) return { data: [], error: null };
      
      // Get all pending and accepted offers for this tasker
      const { data: offers } = await supabase
        .from('job_offers')
        .select('job_id, status, expires_at, otp_verified')
        .eq('tasker_id', userId)
        .in('status', ['pending', 'accepted']);
        
      const offerJobIds = offers ? offers.map(o => o.job_id) : [];
      const acceptedJobIds = offers ? offers.filter(o => o.status === 'accepted').map(o => o.job_id) : [];
      
      if (offerJobIds.length > 0) {
        query = query.neq('poster_id', userId).or(`tasker_id.eq.${userId},id.in.(${offerJobIds.join(',')})`);
      } else {
        query = query.neq('poster_id', userId).eq('tasker_id', userId);
      }
      
      const { data, error } = await query;
      if (data) {
        const posterIds = [...new Set(data.map(j => j.poster_id).filter(Boolean))];
        const taskerIds = [...new Set(data.map(j => j.tasker_id).filter(Boolean))];
        const profileIds = [...new Set([...posterIds, ...taskerIds])];
        
        let profileMap = {};
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name, bird, phone, upi_id, rating, tasks_completed').in('id', profileIds);
          if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p; });
          }
        }

        const mappedJobs = data.map(j => {
          const coords = parseEWKBPoint(j.location) || { lng: 0, lat: 0 };
          const poster = profileMap[j.poster_id] || {};
          const tasker = profileMap[j.tasker_id] || {};
          const offer = offers ? offers.find(o => o.job_id === j.id) : null;
          
          let addressObj = null;
          if (j.primary_address) {
            const addrCoords = parseEWKBPoint(j.primary_address.coordinates) || { lng: 0, lat: 0 };
            addressObj = {
              id: j.primary_address.id,
              type: j.primary_address.label || 'Other',
              completeAddress: j.primary_address.formatted_address,
              landmark: j.primary_address.landmark,
              lat: addrCoords.lat,
              lng: addrCoords.lng,
              contactName: poster.name || 'Customer',
              contactPhone: poster.phone || ''
            };
          }

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
            posterRating: poster.rating,
            posterTasksCompleted: poster.tasks_completed,
            taskerName: tasker.name,
            taskerBird: tasker.bird,
            taskerPhone: tasker.phone,
            taskerUpi: tasker.upi_id,
            taskerRating: tasker.rating,
            taskerTasksCompleted: tasker.tasks_completed,
            isAcceptedByMe: acceptedJobIds.includes(j.id) || j.tasker_id === userId,
            isPendingOffer: offerJobIds.includes(j.id) && !acceptedJobIds.includes(j.id),
            offerExpiresAt: offer ? offer.expires_at : null,
            otpVerified: offer ? offer.otp_verified : false,
            address: addressObj,
            taskerCurrentLocation: j.tasker_current_location ? parseEWKBPoint(j.tasker_current_location) : null,
            hasBeenRated: !!ratedJobsMap[j.id],
            myRatingToReceiver: ratedJobsMap[j.id] || null
          };
        });
        return { data: mappedJobs, error };
      }
      return { data, error };
    }

    const { data, error } = await query;
    if (data) {
      const posterIds = [...new Set(data.map(j => j.poster_id).filter(Boolean))];
      const taskerIds = [...new Set(data.map(j => j.tasker_id).filter(Boolean))];
      const profileIds = [...new Set([...posterIds, ...taskerIds])];
      
      let profileMap = {};
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, bird, phone, upi_id, rating, tasks_completed').in('id', profileIds);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = p; });
        }
      }

      const mappedJobs = data.map(j => {
        const coords = parseEWKBPoint(j.location) || { lng: 0, lat: 0 };
        const poster = profileMap[j.poster_id] || {};
        const tasker = profileMap[j.tasker_id] || {};
        
        let addressObj = null;
        if (j.primary_address) {
          const addrCoords = parseEWKBPoint(j.primary_address.coordinates) || { lng: 0, lat: 0 };
          addressObj = {
            id: j.primary_address.id,
            type: j.primary_address.label || 'Other',
            completeAddress: j.primary_address.formatted_address,
            landmark: j.primary_address.landmark,
            lat: addrCoords.lat,
            lng: addrCoords.lng,
            contactName: poster.name || 'Customer',
            contactPhone: poster.phone || ''
          };
        }

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
          posterRating: poster.rating,
          posterTasksCompleted: poster.tasks_completed,
          taskerName: tasker.name,
          taskerBird: tasker.bird,
          taskerPhone: tasker.phone,
          taskerUpi: tasker.upi_id,
          taskerRating: tasker.rating,
          taskerTasksCompleted: tasker.tasks_completed,
          address: addressObj,
          taskerCurrentLocation: j.tasker_current_location ? parseEWKBPoint(j.tasker_current_location) : null,
          hasBeenRated: !!ratedJobsMap[j.id],
          myRatingToReceiver: ratedJobsMap[j.id] || null
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
      primary_location: jobData.locationStr, // formatted POINT(...)
      primary_address_id: jobData.primaryAddressId || null,
      otp: jobData.otp,
      v2_status: 'searching',
      status: 'open',
      scheduled_for: jobData.scheduledFor || null
    }).select().single();
    
    if (data) {
      // Trigger Wave 1 automatically
      supabase.rpc('dispatch_job_wave', { p_job_id: data.id, p_wave_number: 1 }).then(({ error: waveError }) => {
        if (waveError) console.error("Wave 1 dispatch failed:", waveError);
      });
    }
    
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

  verifyJobOtp: async (jobId, otp, taskerId = null) => {
    const { data, error } = await supabase.rpc('verify_job_otp', {
      p_job_id: jobId,
      p_otp: otp,
      p_tasker_id: taskerId
    });
    return { data, error };
  },

  submitUserRating: async (jobId, giverRole, receiverProfileId, rating, badgeType, giverProfileId = null) => {
    const { data, error } = await supabase.rpc('submit_user_rating', {
      p_job_id: jobId,
      p_giver_role: giverRole,
      p_receiver_profile_id: receiverProfileId,
      p_rating: rating,
      p_badge_type: badgeType || null,
      p_giver_profile_id: giverProfileId
    });
    return { data, error };
  },

  submitUserReport: async (reportedProfileId, jobId, category, details, reporterProfileId = null) => {
    const { data, error } = await supabase.rpc('submit_user_report', {
      p_reported_profile_id: reportedProfileId,
      p_job_id: jobId,
      p_category: category,
      p_details: details,
      p_reporter_profile_id: reporterProfileId
    });
    return { data, error };
  },

  acceptJobOffer: async (jobId, taskerId) => {
    const { data, error } = await supabase.rpc('accept_job_offer', {
      p_job_id: jobId,
      p_tasker_id: taskerId
    });
    return { data, error };
  },

  declineJobOffer: async (jobId, taskerId) => {
    const { data, error } = await supabase.rpc('decline_job_offer', {
      p_job_id: jobId,
      p_tasker_id: taskerId
    });
    return { data, error };
  },

  cancelAcceptedJobOffer: async (jobId, taskerId) => {
    const { data, error } = await supabase.rpc('cancel_accepted_job_offer', {
      p_job_id: jobId,
      p_tasker_id: taskerId
    });
    return { data, error };
  },

  commitPartialCrew: async (jobId, posterId = null) => {
    const { data, error } = await supabase.rpc('commit_partial_crew', {
      p_job_id: jobId,
      p_poster_id: posterId
    });
    return { data, error };
  },
  
  fetchJobCrew: async (jobId) => {
    const { data, error } = await supabase
      .from('job_offers')
      .select('tasker_id, otp_verified, profiles(id, name, bird, phone, upi_id, rating, tasks_completed)')
      .eq('job_id', jobId)
      .eq('status', 'accepted');
      
    if (data) {
      return { data: data.map(d => ({
        id: d.profiles?.id,
        name: d.profiles?.name,
        bird: d.profiles?.bird,
        phone: d.profiles?.phone,
        upiId: d.profiles?.upi_id,
        rating: d.profiles?.rating,
        tasksCompleted: d.profiles?.tasks_completed,
        otpVerified: d.otp_verified
      })), error };
    }
    return { data: [], error };
  },

  dispatchJobWave: async (jobId, waveNumber) => {
    const { data, error } = await supabase.rpc('dispatch_job_wave', {
      p_job_id: jobId,
      p_wave_number: waveNumber
    });
    return { data, error };
  },

  updateLastActive: async () => {
    const { data, error } = await supabase.rpc('update_last_active');
    return { data, error };
  },

  sendNotification: async (userId, title, body, actionUrl, type = 'system', role = null) => {
    // 1. Try to invoke edge function (sends push AND saves to DB)
    const { data, error } = await supabase.functions.invoke('push-notification', {
      body: { user_id: userId, title, body, action_url: actionUrl, type, role }
    });

    // 2. If edge function fails (e.g. not deployed yet), fallback to just inserting into DB so in-app works
    if (error) {
      console.warn('Edge function failed or not deployed, falling back to DB insert:', error);
      return await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          body,
          action_url: actionUrl,
          role
        });
    }
    
    return { data, error };
  },

  notifyAdmin: async (title, body) => {
    try {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', '9347442426')
        .single();
      
      if (adminProfile && adminProfile.id) {
        await api.sendNotification(adminProfile.id, title, body, null, 'admin_alert');
      }
    } catch (err) {
      console.warn("Failed to notify admin:", err);
    }
  },

  // --- V2 Notification Strategy ---
  triggerDensityNudge: async (categoryId, locationStr, metrics) => {
    // Implementation outline for Notification Throttling
    // Uses MARKETPLACE_RULES.NOTIFICATION_THROTTLING
    
    // 1. Check last nudge timestamp for this category/location from DB or Redis
    // const lastNudge = await getLastNudgeTime(categoryId, locationStr);
    
    // 2. Calculate hours since last nudge
    // const hoursSinceLast = (Date.now() - lastNudge) / (1000 * 60 * 60);
    
    // 3. Evaluate cooldown override (demand spike)
    // const demandGrowth = calculateDemandGrowth(metrics);
    // const isSpike = demandGrowth >= MARKETPLACE_RULES.NOTIFICATION_THROTTLING.MIN_DEMAND_SPIKE_PERCENTAGE;
    
    // 4. Trigger if cooldown elapsed OR demand spike overrides it
    // if (hoursSinceLast >= MARKETPLACE_RULES.NOTIFICATION_THROTTLING.COOLDOWN_HOURS || isSpike) {
    //   console.log(`[Notification] Triggering Density Nudge for ${categoryId}`);
    //   await sendDensityNudgePushNotifications(categoryId, locationStr);
    //   await updateLastNudgeTime(categoryId, locationStr, Date.now());
    // } else {
    //   console.log(`[Notification] Density Nudge throttled for ${categoryId} (Cooldown active)`);
    // }
    
    return { success: true };
  },

  subscribeToJobs: (callback) => {
    let debounceTimer = null;
    const debouncedCallback = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, 600);
    };
    const channel = supabase
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, debouncedCallback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, debouncedCallback)
      .subscribe();
      
    return {
      unsubscribe: () => {
        clearTimeout(debounceTimer);
        supabase.removeChannel(channel);
      }
    };
  },

  // --- Addresses API ---
  fetchAddresses: async (userId) => {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('last_used_at', { ascending: false });
    
    if (data) {
      const mapped = data.map(addr => {
        const coords = parseEWKBPoint(addr.coordinates) || { lng: 0, lat: 0 };
        return {
          id: addr.id,
          type: addr.label || 'Other',
          city: '', 
          area: '', 
          completeAddress: addr.formatted_address,
          landmark: addr.landmark,
          isDefault: addr.is_default,
          lat: coords.lat,
          lng: coords.lng,
          lastUsedAt: addr.last_used_at
        };
      });
      return { data: mapped, error };
    }
    return { data, error };
  },

  createAddress: async (userId, address) => {
    const coordsStr = `POINT(${address.lng || 0} ${address.lat || 0})`;
    const { data, error } = await supabase.from('user_addresses').insert({
      user_id: userId,
      label: address.type || 'Other',
      formatted_address: address.completeAddress || '',
      landmark: address.landmark || null,
      coordinates: coordsStr,
      is_default: address.isDefault || false,
      last_used_at: new Date().toISOString()
    }).select().single();
    
    if (data) {
      const coords = parseEWKBPoint(data.coordinates) || { lng: 0, lat: 0 };
      return { data: {
        id: data.id,
        type: data.label,
        completeAddress: data.formatted_address,
        landmark: data.landmark,
        isDefault: data.is_default,
        lat: coords.lat,
        lng: coords.lng,
        lastUsedAt: data.last_used_at
      }, error };
    }
    return { data, error };
  },

  updateAddress: async (addressId, updates) => {
    const dbUpdates = {};
    if (updates.type !== undefined) dbUpdates.label = updates.type;
    if (updates.completeAddress !== undefined) dbUpdates.formatted_address = updates.completeAddress;
    if (updates.landmark !== undefined) dbUpdates.landmark = updates.landmark;
    if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
    if (updates.lastUsedAt !== undefined) dbUpdates.last_used_at = updates.lastUsedAt;
    
    if (updates.lat !== undefined && updates.lng !== undefined) {
      dbUpdates.coordinates = `POINT(${updates.lng} ${updates.lat})`;
    }

    const { data, error } = await supabase.from('user_addresses').update(dbUpdates).eq('id', addressId).select().single();
    
    if (data) {
      const coords = parseEWKBPoint(data.coordinates) || { lng: 0, lat: 0 };
      return { data: {
        id: data.id,
        type: data.label,
        completeAddress: data.formatted_address,
        landmark: data.landmark,
        isDefault: data.is_default,
        lat: coords.lat,
        lng: coords.lng,
        lastUsedAt: data.last_used_at
      }, error };
    }
    return { data, error };
  },

  deleteAddress: async (addressId) => {
    return await supabase.from('user_addresses').delete().eq('id', addressId);
  },

  // --- Profiles API ---
  fetchProfile: async (userId) => {
    try {
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !profile) return { data: profile, error };

      const receiverAuthId = profile.auth_id || profile.id;
      const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('receiver_id', receiverAuthId);

      const { data: badges } = await supabase
        .from('reputation_badges')
        .select('*')
        .eq('receiver_id', receiverAuthId);

      return {
        data: {
          ...profile,
          feedbacks: feedbacks || [],
          reputation_badges: badges || []
        },
        error: null
      };
    } catch (err) {
      console.warn("fetchProfile crashed:", err);
      return { data: null, error: err };
    }
  },

  findProfileByPhone: async (phone) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: { code: 'PGRST116' } };
    }
    return { data: data[0], error: null };
  },

  findProfileByAuthId: async (authId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();
    return { data, error };
  },

  findProfileByEmail: async (email) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    return { data, error };
  },

  createProfile: async (profileData) => {
    const { data, error } = await supabase.from('profiles').insert(profileData).select().single();
    return { data, error };
  },

  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) console.error("updateProfile error:", error);
    return { data, error };
  },

  // --- Marketplace Evolution API ---
  getLocalSupply: async (categoryId, lat, lng, radiusMeters) => {
    const { data, error } = await supabase.rpc('get_local_supply', {
      p_category_id: categoryId,
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radiusMeters
    });
    return { count: data, error };
  },

  joinWaitlist: async (posterId, categoryId, lat, lng) => {
    const { data, error } = await supabase.rpc('join_waitlist', {
      p_poster_id: posterId,
      p_category_id: categoryId,
      p_lat: lat,
      p_lng: lng
    });
    return { data, error };
  },

  getWaitlistCount: async (categoryId, lat, lng, radiusMeters) => {
    const { data, error } = await supabase.rpc('get_waitlist_count', {
      p_category_id: categoryId,
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radiusMeters
    });
    return { count: data, error };
  },
  
  upsertUserLocation: async (locationData) => {
    const { data, error } = await supabase.from('user_locations').upsert(locationData);
    return { data, error };
  },

  fetchUserLocation: async (userId) => {
    const { data, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  },

  fetchUserLocations: async (userIds) => {
    if (!userIds || userIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('user_locations')
      .select('*')
      .in('user_id', userIds);
    return { data, error };
  },

  // --- Event Tracking API ---
  logEvent: async (eventType, payload) => {
    const { userId, role, entityId, metadata, ...rest } = payload;
    supabase.from('app_events').insert({
      event_type: eventType,
      user_id: userId || null,
      active_role: role || null,
      entity_id: entityId || null,
      metadata: { ...metadata, ...rest }
    }).then(({ error }) => {
      if (error) console.error(`[EventTracker] Failed to log event: ${eventType}`, error);
    });
  },

  // --- Admin Dashboard APIs ---
  verifyAdmin: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    if (error) return false;
    return data?.is_admin === true;
  },

  getDashboardStats: async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    return { data, error };
  },

  getEventCounts: async (startDate, endDate) => {
    const params = {};
    if (startDate) params.p_start_date = startDate;
    if (endDate) params.p_end_date = endDate;
    const { data, error } = await supabase.rpc('get_event_counts', params);
    return { data, error };
  },

  getDailyTimeseries: async (eventType, days = 30) => {
    const params = { p_days: days };
    if (eventType) params.p_event_type = eventType;
    const { data, error } = await supabase.rpc('get_daily_event_timeseries', params);
    return { data, error };
  },

  getRecentEvents: async (limit = 50) => {
    const { data, error } = await supabase.rpc('get_recent_events', { p_limit: limit });
    return { data, error };
  },

  // --- V2 Marketplace Metrics ---
  getDemandHotspots: async () => {
    const { data, error } = await supabase.rpc('get_demand_hotspots');
    if (data && data.length > 0) {
      const mapped = await Promise.all(data.map(async (item) => {
        try {
          const geo = await reverseGeocode(item.lat, item.lng);
          return {
            ...item,
            locationName: geo?.displayName || `Location at ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`
          };
        } catch (err) {
          console.error("Error reverse geocoding demand hotspot:", err);
          return {
            ...item,
            locationName: `Location at ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`
          };
        }
      }));
      return { data: mapped, error };
    }
    return { data: data || [], error };
  },

  getCoverageGaps: async () => {
    const { data, error } = await supabase.rpc('get_coverage_gaps');
    if (data && data.length > 0) {
      const mapped = await Promise.all(data.map(async (item) => {
        try {
          const geo = await reverseGeocode(item.lat, item.lng);
          return {
            ...item,
            locationName: geo?.displayName || `Location at ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`
          };
        } catch (err) {
          console.error("Error reverse geocoding coverage gap:", err);
          return {
            ...item,
            locationName: `Location at ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`
          };
        }
      }));
      return { data: mapped, error };
    }
    return { data: data || [], error };
  },

  getFailedFirstExperiences: async () => {
    const { data, error } = await supabase.rpc('get_failed_first_experiences');
    return { data: data || [], error };
  },

  // --- Help & Support ---
  submitHelpReport: async (reportData) => {
    const { data, error } = await supabase.from('help_reports').insert({
      user_id: reportData.userId || null,
      description: reportData.description,
      status: 'pending'
    });
    return { data, error };
  },

  getHelpReports: async () => {
    const { data, error } = await supabase
      .from('help_reports')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  updateHelpReportStatus: async (id, status) => {
    const { data, error } = await supabase
      .from('help_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { data, error };
  }
};
