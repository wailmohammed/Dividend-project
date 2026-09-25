/**
 * Security regression tests. These assert invariants for previously-fixed
 * findings so CI fails deterministically if any regress. Prefer these tests
 * over shell greps in CI — they run in Deno, produce structured pass/fail
 * output, and are harder to false-pass.
 *
 * Covered internal_ids:
 *   - default_enc_key_fallback
 *   - admin_notif_spoof
 *   - SUPA_auth_leaked_password_protection (delegated to _tests/hibp_test.ts)
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ROOT = new URL("../", import.meta.url);

async function readFn(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(path, ROOT));
}

// ---------- default_enc_key_fallback ----------

Deno.test("regression[default_enc_key_fallback]: no hardcoded fallback key in any edge function", async () => {
  for await (const dir of Deno.readDir(ROOT)) {
    if (!dir.isDirectory || dir.name.startsWith("_")) continue;
    const entry = new URL(`${dir.name}/index.ts`, ROOT);
    try {
      const src = await Deno.readTextFile(entry);
      assert(
        !src.includes("default-encryption-key-change-me"),
        `${dir.name}/index.ts contains legacy fallback literal`,
      );
      assert(
        !/ENCRYPTION_KEY['"]?\)\s*\|\|\s*['"`]/.test(src),
        `${dir.name}/index.ts has ENCRYPTION_KEY string fallback via ||`,
      );
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
});

Deno.test("regression[default_enc_key_fallback]: manage-payment-gateway guards missing key", async () => {
  const src = await readFn("manage-payment-gateway/index.ts");
  const match = src.match(/function getEncryptionKey[\s\S]*?\n\}/);
  assert(match, "getEncryptionKey must be defined in manage-payment-gateway");
  const body = match![0];
  assert(
    body.includes("Deno.env.get('ENCRYPTION_KEY')") ||
      body.includes('Deno.env.get("ENCRYPTION_KEY")'),
    "getEncryptionKey must read ENCRYPTION_KEY from env",
  );
  assert(body.includes("throw new Error"), "getEncryptionKey must throw when missing");
});

// ---------- admin_notif_spoof ----------

Deno.test("regression[admin_notif_spoof]: admin-notifications validates JWT via getClaims()", async () => {
  const src = await readFn("admin-notifications/index.ts");
  assert(src.includes("getClaims"), "must call auth.getClaims() to validate JWT");
});

Deno.test("regression[admin_notif_spoof]: adminUserId is forced from verified JWT (never body)", async () => {
  const src = await readFn("admin-notifications/index.ts");
  assert(
    /adminUserId\s*=\s*authenticatedUserId/.test(src),
    "adminUserId must be assigned from authenticatedUserId, not the request body",
  );
});

Deno.test("regression[admin_notif_spoof]: body adminUserId is never destructured / read after auth", async () => {
  const src = await readFn("admin-notifications/index.ts");
  // The request-body destructure must NOT pull adminUserId from the body.
  const destructureMatch = src.match(
    /const\s*\{([^}]+)\}\s*:\s*NotificationRequest\s*=\s*await\s+req\.json\(\)/,
  );
  assert(destructureMatch, "expected NotificationRequest destructure from req.json()");
  const fields = destructureMatch![1];
  assert(
    !/\badminUserId\b/.test(fields),
    "adminUserId must NOT be destructured from the request body",
  );
  // Belt-and-suspenders: the only assignment to adminUserId must come from the JWT.
  const assignments = [...src.matchAll(/adminUserId\s*=\s*([^;\n]+)/g)].map(
    (m) => m[1].trim(),
  );
  assert(assignments.length > 0, "expected an assignment to adminUserId");
  for (const rhs of assignments) {
    assert(
      rhs.startsWith("authenticatedUserId"),
      `adminUserId assigned from untrusted source: ${rhs}`,
    );
  }
});

Deno.test("regression[admin_notif_spoof]: admin role enforced against user_roles", async () => {
  const src = await readFn("admin-notifications/index.ts");
  assert(src.includes("user_roles"), "must check user_roles table for admin role");
  assert(
    /Forbidden|403/.test(src),
    "must reject non-admin callers with Forbidden/403",
  );
});

// ---------- SUPA_auth_leaked_password_protection ----------

Deno.test("regression[SUPA_auth_leaked_password_protection]: HIBP test file present and asserts weak_password", async () => {
  const src = await Deno.readTextFile(new URL("_tests/hibp_test.ts", ROOT));
  assert(src.includes("weak_password"), "HIBP test must assert weak_password rejection");
});
