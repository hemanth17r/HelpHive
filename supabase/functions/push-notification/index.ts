import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

// VAPID keys for Web Push. In production, these must be loaded from environment variables.
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || 'BIg-I-5TEqEy_5_YtXu3ZTlaM5kXhLEsYgJw6SC2mwfOkdNHwHSyrJ39PQVSklB4EFYEsLsorB_iSKiTo3zZYCA';
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

if (!VAPID_PRIVATE_KEY) {
  console.warn("WARNING: VAPID_PRIVATE_KEY is not defined in the environment variables. Web Push notifications will fail to send.");
}

webPush.setVapidDetails(
  'mailto:support@helphive.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY || ''
);

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, title, body, action_url, type, role } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and body are required." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Insert notification into the DB FIRST, so internal notifications always work
    const { error: insertError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id,
        type: type || 'push',
        title,
        body,
        action_url: action_url || '/',
        role: role || null
      });

    if (insertError) {
       console.error("Failed to insert notification into DB:", insertError);
       // We still try to send the push even if logging it failed
    }

    // 2. Fetch all push subscriptions for the user (always send push notifications, ignoring is_online)
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Notification logged to DB. No push subscriptions found for user." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Send Web Push to all devices
    const payload = JSON.stringify({
      title,
      body,
      action_url: action_url || '/'
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webPush.sendNotification(pushSubscription, payload);
      } catch (err) {
        console.error("Error sending push notification to endpoint", sub.endpoint, err);
        // If the subscription is invalid/expired (statusCode 410 or 404), we should delete it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
      }
    });

    await Promise.all(sendPromises);

    return new Response(
      JSON.stringify({ message: `Push sent to ${subscriptions.length} devices.` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
