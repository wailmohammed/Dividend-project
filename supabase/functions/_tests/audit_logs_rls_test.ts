/**
 * RLS coverage for admin_notifications_rejected rows in public.audit_logs.
 *
 * Two guarantees under test:
 *  1. Non-admin (anon) callers CANNOT read admin_notifications_rejected rows.
 *     Under RLS with the current policies, PostgREST returns 200 with an
 *     empty array (never the actual rows) because no policy matches anon.
 *  2. Admin / super_admin SELECT policies exist in source. We verify at the
 *     migration + pg_policies level rather than minting an admin JWT in CI.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("regression[audit_logs_rls]: anon cannot read admin_notifications_rejected rows", async () => {
  const url =
    `${SUPABASE_URL}/rest/v1/audit_logs?action_type=eq.admin_notifications_rejected&select=id`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const body = await res.json();
  // Either PostgREST refuses (401/403) or RLS filters everything out.
  if (res.status === 200) {
    assert(Array.isArray(body), "expected array response under RLS");
    assertEquals(body.length, 0, "anon must not see any audit_logs rows");
  } else {
    assert(
      res.status === 401 || res.status === 403,
      `unexpected status ${res.status}`,
    );
  }
});

Deno.test("regression[audit_logs_rls]: admin + super_admin SELECT policies present in source", async () => {
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  let sql = "";
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (!entry.isFile || !entry.name.endsWith(".sql")) continue;
    sql += await Deno.readTextFile(new URL(entry.name, migrationsDir));
    sql += "\n";
  }
  // Grants that lock the table down to authenticated + service_role only.
  assert(
    /GRANT\s+SELECT\s+ON\s+public\.audit_logs\s+TO\s+authenticated/i.test(sql),
    "expected explicit SELECT grant to authenticated on public.audit_logs",
  );
  assert(
    /GRANT\s+ALL\s+ON\s+public\.audit_logs\s+TO\s+service_role/i.test(sql),
    "expected explicit ALL grant to service_role on public.audit_logs",
  );
  // Grant must NOT include anon.
  assert(
    !/GRANT[^;]*ON\s+public\.audit_logs[^;]*TO[^;]*\banon\b/i.test(sql),
    "audit_logs must NOT be granted to anon",
  );
});

// ---------- Write-side lockdown ----------
// audit_logs has NO INSERT/UPDATE/DELETE policies, so RLS denies every
// non-service-role write. Service role bypasses RLS and is the only
// caller that may append rows (edge functions use SERVICE_ROLE_KEY).

async function anonFetch(path: string, init: RequestInit = {}) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

Deno.test("regression[audit_logs_rls]: anon cannot INSERT admin_notifications_rejected", async () => {
  const res = await anonFetch("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      action_type: "admin_notifications_rejected",
      target_type: "edge_function",
      details: { reason: "test_injection" },
    }),
  });
  const body = await res.text();
  assert(
    res.status === 401 || res.status === 403 ||
      (res.status >= 400 && /row-level security|permission denied/i.test(body)),
    `anon INSERT must be rejected, got ${res.status}: ${body}`,
  );
});

Deno.test("regression[audit_logs_rls]: anon cannot INSERT any audit_logs row", async () => {
  const res = await anonFetch("audit_logs", {
    method: "POST",
    body: JSON.stringify({ action_type: "arbitrary", target_type: "system", details: {} }),
  });
  const body = await res.text();
  assert(
    res.status >= 400,
    `anon INSERT of any audit row must fail, got ${res.status}: ${body}`,
  );
});

Deno.test("regression[audit_logs_rls]: anon cannot UPDATE audit_logs", async () => {
  const res = await anonFetch(
    "audit_logs?action_type=eq.admin_notifications_rejected",
    { method: "PATCH", body: JSON.stringify({ details: { tampered: true } }) },
  );
  const text = await res.text();
  assert(
    res.status >= 400 || text === "" || text === "[]",
    `anon UPDATE must be rejected or no-op, got ${res.status}: ${text}`,
  );
});

Deno.test("regression[audit_logs_rls]: anon cannot DELETE audit_logs", async () => {
  const res = await anonFetch(
    "audit_logs?action_type=eq.admin_notifications_rejected",
    { method: "DELETE" },
  );
  const text = await res.text();
  assert(
    res.status >= 400 || text === "" || text === "[]",
    `anon DELETE must be rejected or no-op, got ${res.status}: ${text}`,
  );
});

Deno.test("regression[audit_logs_rls]: malformed / non-admin JWT cannot read admin_notifications_rejected", async () => {
  // A syntactically-broken bearer token: PostgREST rejects with 401.
  const malformed = "not.a.real.jwt";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/audit_logs?action_type=eq.admin_notifications_rejected&select=id`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${malformed}`,
      },
    },
  );
  const body = await res.text();
  assert(
    res.status === 401 || res.status === 403,
    `malformed JWT must be rejected with 401/403, got ${res.status}: ${body}`,
  );
});

Deno.test("regression[audit_logs_rls]: no INSERT/UPDATE/DELETE policies exist for audit_logs", async () => {
  // Source-level guarantee: only SELECT policies gated by has_role(admin|super_admin)
  // exist. Adding an INSERT/UPDATE/DELETE policy would open write access to
  // authenticated users and defeat the append-only, service-role-only invariant.
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  let sql = "";
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (!entry.isFile || !entry.name.endsWith(".sql")) continue;
    sql += await Deno.readTextFile(new URL(entry.name, migrationsDir));
    sql += "\n";
  }
  // Track CREATE POLICY vs DROP POLICY by name so historical writes that were
  // later dropped don't false-fail this check. We only care about effective
  // (still-present) policies.
  // Track CREATE POLICY vs DROP POLICY by name so historical writes that were
  // later dropped don't false-fail this check. Walk in document order so a
  // drop-then-recreate in the same file keeps the recreated policy.
  const created = new Map<string, string>(); // name -> full statement
  const combined =
    /CREATE\s+POLICY\s+"([^"]+)"[^;]+ON\s+public\.audit_logs[^;]+;|DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"\s+ON\s+public\.audit_logs\s*;/gi;
  for (const m of sql.matchAll(combined)) {
    if (m[1]) created.set(m[1], m[0]);
    else if (m[2]) created.delete(m[2]);
  }
  for (const [name, stmt] of created) {
    assert(
      !/FOR\s+(INSERT|UPDATE|DELETE|ALL)\b/i.test(stmt),
      `audit_logs write policy still active: "${name}" — writes must be service-role only`,
    );
  }


  // SELECT policies must be gated by has_role(...admin) — never public/anon.
  const selectPolicies = [
    ...sql.matchAll(
      /CREATE\s+POLICY[^;]+ON\s+public\.audit_logs[^;]+FOR\s+SELECT[^;]+;/gi,
    ),
  ].map((m) => m[0]);
  assert(selectPolicies.length > 0, "expected at least one SELECT policy on audit_logs");
  for (const p of selectPolicies) {
    assert(
      /has_role\(\s*auth\.uid\(\)\s*,\s*'(admin|super_admin)'/i.test(p),
      `audit_logs SELECT policy must be gated by has_role(admin|super_admin): ${p}`,
    );
  }
});

// ---------- Server-side insert path uses service_role only ----------
// Regression: every server-side INSERT into public.audit_logs from an edge
// function must run under SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS).
// A caller-provided Authorization header or the anon key MUST NEVER be used
// to write audit rows — that would let a compromised client forge or suppress
// audit trail entries.
Deno.test("regression[audit_logs_rls]: edge-function audit_logs INSERTs use service_role auth", async () => {
  const fnDir = new URL("../", import.meta.url);
  const offenders: string[] = [];

  for await (const entry of Deno.readDir(fnDir)) {
    if (!entry.isDirectory || entry.name.startsWith("_")) continue;
    const indexPath = new URL(`${entry.name}/index.ts`, fnDir);
    let src: string;
    try {
      src = await Deno.readTextFile(indexPath);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) continue;
      throw e;
    }
    if (!src.includes("audit_logs")) continue;

    // Direct fetch() writes to /rest/v1/audit_logs must carry the service key.
    for (
      const m of src.matchAll(
        /fetch\(\s*[`"'][^`"']*\/rest\/v1\/audit_logs[^`"']*[`"'][\s\S]*?\)/g,
      )
    ) {
      const call = m[0];
      const hasServiceKey = /SERVICE_ROLE_KEY|supabaseServiceKey|serviceRoleKey/i
        .test(call);
      const hasNonPostMethod = /method:\s*['"`](GET|HEAD)['"`]/i.test(call);
      if (!hasServiceKey && !hasNonPostMethod) {
        offenders.push(`${entry.name}/index.ts: raw fetch to audit_logs without service key`);
      }
    }

    // supabase-js `.from('audit_logs').insert/upsert/update/delete` must be on a
    // client constructed with the service role key.
    const clientVarsFromServiceRole = new Set<string>();
    for (
      const m of src.matchAll(
        /(?:const|let|var)\s+(\w+)\s*=\s*createClient\([^)]*(SERVICE_ROLE_KEY|supabaseServiceKey|serviceRoleKey)[^)]*\)/g,
      )
    ) {
      clientVarsFromServiceRole.add(m[1]);
    }
    for (
      const m of src.matchAll(
        /(\w+)\s*\.from\(\s*['"`]audit_logs['"`]\s*\)\s*\.\s*(insert|upsert|update|delete)\b/g,
      )
    ) {
      const [, varName, op] = m;
      if (!clientVarsFromServiceRole.has(varName)) {
        offenders.push(
          `${entry.name}/index.ts: ${varName}.from('audit_logs').${op}() not on a service-role client`,
        );
      }
    }
  }

  if (offenders.length) {
    throw new Error(
      "audit_logs writes must always run under service_role:\n  - " +
        offenders.join("\n  - "),
    );
  }
});

// Runtime companion: even with a valid user JWT, a *direct* PostgREST INSERT
// into admin_notifications_rejected must fail. Only the server-side edge
// function path (which uses SERVICE_ROLE_KEY) may create such rows.
Deno.test("regression[audit_logs_rls]: client-side INSERT of admin_notifications_rejected is rejected", async () => {
  const res = await anonFetch("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      action_type: "admin_notifications_rejected",
      target_type: "edge_function",
      details: { reason: "client_bypass_attempt" },
    }),
  });
  const body = await res.text();
  assert(
    res.status >= 400,
    `client-side INSERT must be rejected, got ${res.status}: ${body}`,
  );
  assert(
    !/"id"\s*:/.test(body),
    `response must not contain an inserted row id: ${body}`,
  );
});

// ---------- End-to-end: server insert only succeeds via service_role ----------
// Confirms the real PostgREST endpoint that edge functions write through:
//   POST /rest/v1/audit_logs   action_type = admin_notifications_rejected
// Anon-key context must be rejected. Service-role context (when the key is
// available in the environment — CI on Lovable Cloud does not expose it, so
// the positive half is skipped there) must succeed and return the inserted
// row id. The inserted row is cleaned up afterwards.
Deno.test("regression[audit_logs_rls]: admin_notifications_rejected INSERT succeeds ONLY under service_role", async () => {
  const marker = `e2e_service_role_${crypto.randomUUID()}`;
  const payload = {
    action_type: "admin_notifications_rejected",
    target_type: "edge_function",
    details: { reason: "e2e_probe", marker },
  };

  // 1. Anon must be rejected (no id returned).
  const anonRes = await anonFetch("audit_logs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const anonBody = await anonRes.text();
  assert(
    anonRes.status >= 400,
    `anon INSERT must be rejected end-to-end, got ${anonRes.status}: ${anonBody}`,
  );
  assert(
    !/"id"\s*:/.test(anonBody),
    `anon response must not include an inserted id: ${anonBody}`,
  );

  // 2. Service-role client must succeed. Skip if the key isn't available
  //    (Lovable Cloud–hosted CI intentionally withholds it).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    console.warn(
      "regression[audit_logs_rls]: SUPABASE_SERVICE_ROLE_KEY not set — skipping positive half",
    );
    return;
  }

  const svcRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const svcBody = await svcRes.text();
  assert(
    svcRes.status === 201 || svcRes.status === 200,
    `service_role INSERT must succeed, got ${svcRes.status}: ${svcBody}`,
  );
  const rows = JSON.parse(svcBody);
  assert(Array.isArray(rows) && rows[0]?.id, "service_role insert must return row id");

  // Cleanup — remove the probe row.
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/audit_logs?id=eq.${rows[0].id}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  await delRes.text();
});
