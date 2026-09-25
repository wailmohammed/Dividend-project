import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key || key.length < 16) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  return key;
}

// Simple encryption using Web Crypto API
async function encryptData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate a key from environment
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getEncryptionKey()),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("payment-gateway-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getEncryptionKey()),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("payment-gateway-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return decoder.decode(decryptedBuffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { claims }, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claims?.sub) {
      throw new Error('Unauthorized');
    }

    const userId = claims.sub;

    // Check if user is super admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, gatewayType, isEnabled, apiKey, apiSecret, webhookSecret, metadata } = await req.json();

    if (action === 'get') {
      // Get all payment gateways
      const { data, error } = await supabaseClient
        .from('payment_gateway_settings')
        .select('*');

      if (error) throw error;

      // Decrypt sensitive data
      const decryptedData = await Promise.all((data || []).map(async (gateway) => ({
        ...gateway,
        api_key: gateway.api_key_encrypted ? await decryptData(gateway.api_key_encrypted) : null,
        api_secret: gateway.api_secret_encrypted ? await decryptData(gateway.api_secret_encrypted) : null,
        webhook_secret: gateway.webhook_secret_encrypted ? await decryptData(gateway.webhook_secret_encrypted) : null,
      })));

      return new Response(
        JSON.stringify({ gateways: decryptedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'upsert') {
      // Encrypt sensitive data
      const encryptedData: any = {
        gateway_type: gatewayType,
        is_enabled: isEnabled,
        metadata: metadata || {},
      };

      if (apiKey) {
        encryptedData.api_key_encrypted = await encryptData(apiKey);
      }
      if (apiSecret) {
        encryptedData.api_secret_encrypted = await encryptData(apiSecret);
      }
      if (webhookSecret) {
        encryptedData.webhook_secret_encrypted = await encryptData(webhookSecret);
      }

      const { data, error } = await supabaseClient
        .from('payment_gateway_settings')
        .upsert(encryptedData, { onConflict: 'gateway_type' })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, gateway: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
