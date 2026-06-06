-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure unique endpoint per user to prevent duplicate subscriptions
    UNIQUE(user_id, endpoint)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'job_accepted', 'new_job', 'badge_received', 'job_completed'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policies for notifications (Users can read their own, and insert requires a trigger/service role or matching user_id)
-- Note: In a production app with secure backends, inserts might only come from triggers or edge functions.
-- For this MVP, we allow authenticated users to read and update their own notifications.
CREATE POLICY "Users can read their own notifications"
    ON public.notifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (e.g. mark as read)"
    ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid());

-- Allow anyone to insert a notification (since client side sends notifications like Zomato, or we handle via RPC/Triggers)
CREATE POLICY "Allow authenticated users to insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Create an index to speed up fetching unread notifications
CREATE INDEX idx_notifications_user_id_is_read ON public.notifications(user_id, is_read);
