import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

// Hardcoded for MVP. In production, these should be loaded from Deno.env.get("VAPID_PRIVATE_KEY")
const VAPID_PUBLIC_KEY = 'BIg-I-5TEqEy_5_YtXu3ZTlaM5kXhLEsYgJw6SC2mwfOkdNHwHSyrJ39PQVSklB4EFYEsLsorB_iSKiTo3zZYCA';
const VAPID_PRIVATE_KEY = '1Oe5DBV2HJ3rcjeI7cIKquExyn-MiRUNOU1zj7mZFyc';

webPush.setVapidDetails(
  'mailto:support@helphive.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
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

    const { user_id, title, body, action_url } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and body are required." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch all push subscriptions for the user
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found for user." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Insert notification into the DB
    const { error: insertError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id,
        type: 'push',
        title,
        body,
        action_url: action_url || '/'
      });

    if (insertError) {
       console.error("Failed to insert notification into DB:", insertError);
       // We still try to send the push even if logging it failed
    }

    // 3. Send Web Push to all devices
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
