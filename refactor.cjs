const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/store/AppContext.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  `import { supabase } from '../config/supabase';`,
  `import { api } from '../services/api';`
);

// 2. fetchJobs
content = content.replace(
  `const { data, error } = await supabase.from('jobs').select('*');`,
  `const { data, error } = await api.fetchJobs();`
);

content = content.replace(
  `// Fetch jobs from Supabase`,
  `// Fetch jobs from API`
);

// 3. channel subscription
content = content.replace(
  `    const channel = supabase
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };`,
  `    const sub = api.subscribeToJobs(() => {
        fetchJobs();
      });

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
    };`
);

// 4. fetchProfile
content = content.replace(
  `const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();`,
  `const { data } = await api.fetchProfile(userId);`
);

// 5. updateProfile
content = content.replace(
  `      const { data, error } = await supabase.from('profiles').update({
        name: profileData.name,
        phone: profileData.phone,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr
      }).eq('id', userId).select().single();`,
  `      const { data, error } = await api.updateProfile(userId, {
        name: profileData.name,
        phone: profileData.phone,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr
      });`
);

// 6. createProfile
content = content.replace(
  `      const { data, error } = await supabase.from('profiles').insert({
        name: profileData.name,
        phone: profileData.phone,
        role: role,
        city_id: userLocation?.id,
        rating: profileData.rating || 5.0,
        tasks_completed: profileData.tasksCompleted || 0,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr
      }).select().single();`,
  `      const { data, error } = await api.createProfile({
        name: profileData.name,
        phone: profileData.phone,
        role: role,
        city_id: userLocation?.id,
        rating: profileData.rating || 5.0,
        tasks_completed: profileData.tasksCompleted || 0,
        skills: profileData.skills || [],
        bird: selectedBird,
        location: locationStr
      });`
);

// 7. deleteJob
content = content.replace(
  `await supabase.from('jobs').delete().eq('id', jobId);`,
  `await api.deleteJob(jobId);`
);

// 8. switchRole
content = content.replace(
  `supabase.from('profiles').update({ role: newRole }).eq('id', userId).then();`,
  `api.updateProfile(userId, { role: newRole }).then();`
);

// 9. changeLocation
content = content.replace(
  `// Save to Supabase if user is logged in
    if (userId) {
      await supabase.from('user_locations').upsert({`,
  `// Save to backend if user is logged in
    if (userId) {
      await api.upsertUserLocation({`
);

// 10. acceptJob
content = content.replace(
  `// Supabase update
    await supabase.from('jobs').update({ status: 'accepted', tasker_id: userId }).eq('id', jobId);`,
  `// Backend update
    await api.updateJob(jobId, { status: 'accepted', tasker_id: userId });`
);

// 11. completeJob
content = content.replace(
  `await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId);`,
  `await api.updateJob(jobId, { status: 'completed' });`
);

// 12. postJob
content = content.replace(
  `const { data, error } = await supabase.from('jobs').insert({
      poster_id: userId,
      skill_id: newJobData.skillId,
      description: newJobData.description || 'Quick task',
      people_needed: newJobData.peopleNeeded || 1,
      amount: newJobData.amount,
      location: locationStr
    }).select().single();`,
  `const { data, error } = await api.postJob({
      posterId: userId,
      skillId: newJobData.skillId,
      description: newJobData.description || 'Quick task',
      peopleNeeded: newJobData.peopleNeeded || 1,
      amount: newJobData.amount,
      locationStr: locationStr
    });`
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('AppContext.jsx refactored successfully.');

// --- Refactor CrewConfirmedScreen.jsx ---
const crewPath = path.join(__dirname, 'src/screens/poster/CrewConfirmedScreen.jsx');
let crewContent = fs.readFileSync(crewPath, 'utf8');

crewContent = crewContent.replace(
  `import { supabase } from '../../config/supabase';`,
  `import { api } from '../../services/api';`
);

crewContent = crewContent.replace(
  `// Database update
    await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId);`,
  `// Database update
    await api.updateJob(jobId, { status: 'completed' });`
);

fs.writeFileSync(crewPath, crewContent, 'utf8');

console.log('CrewConfirmedScreen.jsx refactored successfully.');

// --- Refactor eventTracker.js ---
const eventPath = path.join(__dirname, 'src/utils/eventTracker.js');
let eventContent = fs.readFileSync(eventPath, 'utf8');

eventContent = eventContent.replace(
  `import { supabase } from '../config/supabase';`,
  `import { api } from '../services/api';`
);

eventContent = eventContent.replace(
  `  // Fire and forget - do not await to avoid blocking UI
  supabase.from('app_events').insert({
    event_type: eventType,
    user_id: userId || null,
    active_role: role || null,
    entity_id: entityId || null,
    metadata: metadata || {}
  }).then(({ error }) => {
    if (error) {
      console.error(\`[EventTracker] Failed to log event: \${eventType}\`, error);
    }
  });`,
  `  // Fire and forget - do not await to avoid blocking UI
  api.logEvent(eventType, payload);`
);

fs.writeFileSync(eventPath, eventContent, 'utf8');
console.log('eventTracker.js refactored successfully.');
