import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for vault operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.log('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, connectionId, apiKey, apiSecret } = await req.json();
    console.log(`Processing ${action} request for user ${user.id}`);

    if (action === 'encrypt') {
      // Store API key securely using vault-like pattern with service role
      // First, verify user owns this connection
      const { data: connection, error: connError } = await userClient
        .from('broker_connections')
        .select('id, user_id')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        console.log('Connection not found or access denied');
        return new Response(
          JSON.stringify({ error: 'Connection not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (connection.user_id !== user.id) {
        console.log('User does not own this connection');
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate a secure encrypted reference (not the actual key)
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiKey + (apiSecret || ''));
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create a secure reference ID
      const secureRef = `vault_${connectionId}_${keyHash.substring(0, 16)}`;
      
      // Store the actual credentials securely in a server-side only location
      // In production, this would use Supabase Vault: vault.create_secret()
      // For now, we encrypt and store with additional protection
      const encryptedPayload = await encryptCredentials(apiKey, apiSecret, user.id);

      // Update the connection with encrypted reference
      const { error: updateError } = await serviceClient
        .from('broker_connections')
        .update({ 
          api_key_encrypted: secureRef,
          metadata: {
            encrypted_at: new Date().toISOString(),
            encryption_version: 'v1',
            _encrypted_payload: encryptedPayload // Store encrypted data
          }
        })
        .eq('id', connectionId);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to store encrypted key' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully encrypted API key for connection ${connectionId}`);
      return new Response(
        JSON.stringify({ success: true, reference: secureRef }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'decrypt') {
      // Decrypt and return API key - requires re-authentication (handled by frontend)
      const { data: connection, error: connError } = await userClient
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return new Response(
          JSON.stringify({ error: 'Connection not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decrypt the payload
      const metadata = connection.metadata as Record<string, any> || {};
      const encryptedPayload = metadata._encrypted_payload;
      
      if (!encryptedPayload) {
        return new Response(
          JSON.stringify({ error: 'No encrypted credentials found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const decrypted = await decryptCredentials(encryptedPayload, user.id);
      
      console.log(`Successfully decrypted API key for connection ${connectionId}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          apiKey: decrypted.apiKey,
          apiSecret: decrypted.apiSecret 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Encrypt credentials using AES-GCM
async function encryptCredentials(apiKey: string, apiSecret: string | undefined, userId: string): Promise<string> {
  const payload = JSON.stringify({ apiKey, apiSecret: apiSecret || null });
  const encoder = new TextEncoder();
  
  // Derive encryption key from user ID + server secret
  const serverSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSecret + userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(payload)
  );
  
  // Combine salt + iv + encrypted data and encode as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Decrypt credentials
async function decryptCredentials(encryptedPayload: string, userId: string): Promise<{ apiKey: string; apiSecret: string | null }> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode base64
  const combined = new Uint8Array(atob(encryptedPayload).split('').map(c => c.charCodeAt(0)));
  
  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);
  
  // Derive the same key
  const serverSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSecret + userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );
  
  return JSON.parse(decoder.decode(decrypted));
}
