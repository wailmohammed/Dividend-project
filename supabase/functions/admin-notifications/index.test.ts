import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/admin-notifications`;

async function callFn(headers: Record<string, string>, body: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

Deno.test("admin-notifications: rejects request with no Authorization header (401)", async () => {
  const { status } = await callFn({}, {
    type: "admin_action",
    adminUserId: "00000000-0000-0000-0000-000000000001",
    details: { action: "spoof-attempt" },
  });
  assertEquals(status, 401);
});

Deno.test("admin-notifications: rejects request with malformed Bearer token (401)", async () => {
  const { status } = await callFn(
    { Authorization: "Bearer not-a-real-jwt" },
    {
      type: "admin_action",
      adminUserId: "00000000-0000-0000-0000-000000000001",
      details: { action: "spoof-attempt" },
    },
  );
  assertEquals(status, 401);
});

Deno.test("admin-notifications: body-supplied adminUserId cannot spoof identity when unauthenticated", async () => {
  // Even with anon apikey but no user JWT, request must be rejected (401),
  // proving adminUserId in body is never trusted.
  const { status } = await callFn(
    { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    {
      type: "role_change",
      targetUserId: "00000000-0000-0000-0000-000000000002",
      adminUserId: "00000000-0000-0000-0000-000000000001",
      details: { oldRole: "user", newRole: "super_admin" },
    },
  );
  // anon token has no sub -> getClaims returns no claims.sub -> 401
  assertEquals(status, 401);
});
