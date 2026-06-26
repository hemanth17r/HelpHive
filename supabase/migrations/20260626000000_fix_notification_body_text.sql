-- Update the body text of the existing Remote & Cameraman announcement notification
-- to remove the "Tap here" CTA and replace it with a non-clickable informational message.
UPDATE public.notifications
SET body = 'We have introduced Online Remote categories (Video Editing, Design, Writing, Tech Support) and a physical Vlog Cameraman service. Update your profile skills in the Profile section to get matched for these new opportunities!'
WHERE type = 'announcement'
  AND title = '🚨 New Services: Remote & Cameraman!'
  AND body LIKE '%Tap here to update your profile skills%';
