import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateLimitRequest {
  action_type: string;
  max_attempts?: number;
  window_seconds?: number;
  cooldown_seconds?: number;
}

interface RateLimitResponse {
  allowed: boolean;
  reason?: string;
  cooldown_remaining?: number;
  attempts?: number;
  remaining?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client to get user info
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.log('Failed to get user:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Rate limit check for user: ${user.id}`);

    // Parse request body
    const body: RateLimitRequest = await req.json();
    const { 
      action_type, 
      max_attempts = 3, 
      window_seconds = 300, 
      cooldown_seconds = 120 
    } = body;

    if (!action_type) {
      return new Response(
        JSON.stringify({ error: 'action_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking rate limit: action=${action_type}, max=${max_attempts}, window=${window_seconds}s`);

    // Call the database function to check rate limit
    const { data, error } = await serviceClient.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action_type: action_type,
      p_max_attempts: max_attempts,
      p_window_seconds: window_seconds,
      p_cooldown_seconds: cooldown_seconds
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to check rate limit', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data as RateLimitResponse;
    console.log(`Rate limit result: allowed=${result.allowed}, attempts=${result.attempts}`);

    // If rate limit exceeded, trigger notification
    if (!result.allowed && result.reason === 'limit_exceeded') {
      console.log('Rate limit exceeded, sending notification...');
      try {
        // Call the rate-limit-notify function
        const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/rate-limit-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            user_id: user.id,
            user_email: user.email,
            action_type: action_type,
            attempts: result.attempts,
            cooldown_seconds: cooldown_seconds,
            ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown'
          })
        });
        
        if (notifyResponse.ok) {
          console.log('Rate limit notification sent successfully');
        } else {
          console.error('Failed to send rate limit notification:', await notifyResponse.text());
        }
      } catch (notifyError) {
        console.error('Error sending rate limit notification:', notifyError);
        // Don't fail the main request if notification fails
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.allowed ? 200 : 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
