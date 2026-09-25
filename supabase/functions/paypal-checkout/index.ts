// PayPal checkout using credentials stored by super admin in payment_gateway_settings.
// Actions: get-config (public), create-order (auth), capture-order (auth).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getEncryptionKey(): string {
  const key = Deno.env.get("ENCRYPTION_KEY");
  if (!key || key.length < 16) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  return key;
}
const SALT = "payment-gateway-salt";

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(getEncryptionKey()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

async function decrypt(payload: string): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await deriveKey();
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(buf);
}

interface PayPalCreds {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
  enabled: boolean;
}

async function getPayPalCreds(admin: ReturnType<typeof createClient>): Promise<PayPalCreds | null> {
  const { data, error } = await admin
    .from("payment_gateway_settings")
    .select("api_key_encrypted, api_secret_encrypted, is_enabled, metadata")
    .eq("gateway_type", "paypal")
    .maybeSingle();
  if (error || !data || !data.api_key_encrypted || !data.api_secret_encrypted) return null;
  try {
    const clientId = await decrypt(data.api_key_encrypted);
    const clientSecret = await decrypt(data.api_secret_encrypted);
    const mode = (data.metadata?.mode === "live" ? "live" : "sandbox") as "sandbox" | "live";
    return { clientId, clientSecret, mode, enabled: !!data.is_enabled };
  } catch (_) {
    return null;
  }
}

function apiBase(mode: "sandbox" | "live") {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function paypalToken(creds: PayPalCreds): Promise<string> {
  const auth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await fetch(`${apiBase(creds.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const j = await res.json();
  return j.access_token;
}

const PLANS: Record<string, { name: string; monthly: number; annual: number }> = {
  Pro: { name: "Pro", monthly: 9.99, annual: 99 },
  Ultimate: { name: "Ultimate", monthly: 19.99, annual: 199 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Public: expose client id + enabled so the SDK can render buttons.
    if (action === "get-config") {
      const creds = await getPayPalCreds(admin);
      return new Response(
        JSON.stringify({
          enabled: !!creds?.enabled,
          clientId: creds?.enabled ? creds.clientId : null,
          mode: creds?.mode ?? "sandbox",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth required for create/capture.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Missing auth token");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const creds = await getPayPalCreds(admin);
    if (!creds || !creds.enabled) {
      return new Response(
        JSON.stringify({ error: "PayPal is not configured. Ask the super admin to enable it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create-order") {
      const plan = String(body.plan ?? "Pro");
      const cycle = body.cycle === "annual" ? "annual" : "monthly";
      const def = PLANS[plan];
      if (!def) throw new Error("Invalid plan");
      const amount = cycle === "annual" ? def.annual : def.monthly;

      const access = await paypalToken(creds);
      const orderRes = await fetch(`${apiBase(creds.mode)}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: { currency_code: "USD", value: amount.toFixed(2) },
              description: `WealthOS ${def.name} (${cycle})`,
              custom_id: `${user.id}|${plan}|${cycle}`,
            },
          ],
          application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
        }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order?.message ?? "PayPal order create failed");
      return new Response(JSON.stringify({ orderId: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "capture-order") {
      const orderId = String(body.orderId ?? "");
      if (!orderId) throw new Error("Missing orderId");
      const access = await paypalToken(creds);
      const capRes = await fetch(
        `${apiBase(creds.mode)}/v2/checkout/orders/${orderId}/capture`,
        { method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" } },
      );
      const cap = await capRes.json();
      if (!capRes.ok) throw new Error(cap?.message ?? "PayPal capture failed");

      const pu = cap.purchase_units?.[0];
      const capture = pu?.payments?.captures?.[0];
      const customId = String(pu?.payments?.captures?.[0]?.custom_id ?? pu?.custom_id ?? "");
      const [_uid, plan, cycle] = customId.split("|");
      const amount = Number(capture?.amount?.value ?? 0);
      const now = new Date();
      const periodEnd = new Date(now);
      if (cycle === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Persist subscription (RLS allows insert where auth.uid() = user_id — use user client).
      await userClient.from("subscriptions").insert({
        user_id: user.id,
        plan_tier: plan || "Pro",
        status: "active",
        payment_method: "paypal",
        billing_cycle: cycle || "monthly",
        amount,
        currency: capture?.amount?.currency_code ?? "USD",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        external_subscription_id: orderId,
        external_customer_id: cap?.payer?.payer_id ?? null,
        metadata: { capture_id: capture?.id, status: cap.status },
      });

      return new Response(
        JSON.stringify({ success: true, status: cap.status, plan, cycle, amount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paypal-checkout error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
