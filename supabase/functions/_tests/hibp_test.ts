import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

/**
 * HIBP (Have I Been Pwned) leaked-password protection coverage.
 * The Supabase auth server enforces this at /auth/v1/signup and
 * /auth/v1/user (password update) when password_hibp_enabled=true.
 */
async function signup(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

Deno.test("HIBP: blocks signup with a known-breached password", async () => {
  // "Password123!" is present in HIBP breach corpora.
  const email = `hibp-blocked-${crypto.randomUUID()}@example.com`;
  const { status, body } = await signup(email, "Password123!");

  // Supabase returns 422 with error_code=weak_password / message mentions "pwned"/"leaked"
  assert(
    status === 422 || status === 400,
    `Expected 4xx block, got ${status}: ${JSON.stringify(body)}`,
  );
  const msg = (body?.msg || body?.message || body?.error_description || "")
    .toString()
    .toLowerCase();
  assert(
    msg.includes("pwn") || msg.includes("leak") || msg.includes("weak") ||
      body?.error_code === "weak_password",
    `Expected HIBP/weak-password error, got: ${JSON.stringify(body)}`,
  );
});

Deno.test("HIBP: allows signup with a strong, non-breached password", async () => {
  const email = `hibp-allowed-${crypto.randomUUID()}@example.com`;
  // Random high-entropy password (<=72 bytes) unlikely to appear in HIBP corpus.
  const strong = `Zx9!${crypto.randomUUID()}q_${Date.now()}`;
  const { status, body } = await signup(email, strong);

  // 200 (session) or 200-with-confirmation-required are both acceptable.
  // A 422 with weak_password would indicate HIBP false-positive or misconfig.
  assert(
    status < 400,
    `Expected signup to be accepted, got ${status}: ${JSON.stringify(body)}`,
  );
  assertEquals(body?.error_code, undefined);
});
