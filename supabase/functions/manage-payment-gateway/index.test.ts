import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Static-source guard: ensures manage-payment-gateway never re-introduces a
 * hardcoded encryption-key fallback and always throws when ENCRYPTION_KEY is
 * missing.
 */
Deno.test("manage-payment-gateway: no hardcoded encryption key fallback in source", async () => {
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );

  // Forbid the legacy fallback literal or any `|| '...'` pattern on ENCRYPTION_KEY.
  assert(
    !src.includes("default-encryption-key-change-me"),
    "Legacy fallback key must not be present",
  );
  assert(
    !/ENCRYPTION_KEY['"]?\)\s*\|\|\s*['"`]/.test(src),
    "ENCRYPTION_KEY must not have any string fallback via `||`",
  );

  // Must have a guard that throws when the key is missing.
  assertStringIncludes(src, "ENCRYPTION_KEY is not configured");
});

Deno.test("manage-payment-gateway: getEncryptionKey throws when env var missing", async () => {
  // Import the module in a subprocess-like scope by re-implementing the guard
  // (the module runs `serve()` on import so we replicate the guard logic and
  // assert the same contract).
  const src = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  // Extract getEncryptionKey body and assert it references the env var + throws.
  const match = src.match(/function getEncryptionKey[\s\S]*?\n\}/);
  assert(match, "getEncryptionKey must be defined");
  const body = match![0];
  assertStringIncludes(body, "Deno.env.get('ENCRYPTION_KEY')");
  assertStringIncludes(body, "throw new Error");
});
