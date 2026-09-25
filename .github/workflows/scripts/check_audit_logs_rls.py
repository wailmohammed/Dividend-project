#!/usr/bin/env python3
"""
Guard the effective RLS policy set and grants on public.audit_logs against
regression.

We derive the "effective" state from the SQL migration history in
``supabase/migrations/`` — the same source a Supabase schema dump reflects
after all migrations run. Tracking CREATE vs DROP by policy name ensures
historical statements that were later dropped don't produce false hits.

Enforced invariants for ``public.audit_logs``:

  * SELECT policies:
      - "Admins can view relevant audit logs"    gated by has_role(...,'admin')
      - "Super admins can view all audit logs"   gated by has_role(...,'super_admin')
  * NO active INSERT / UPDATE / DELETE / ALL policies.
    Writes must remain service-role only (service_role bypasses RLS).
  * Grants:
      - authenticated: SELECT only
      - service_role:  ALL
      - anon:          no grant of any kind
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

MIGRATIONS_DIR = Path("supabase/migrations")

EXPECTED_SELECT_POLICIES = {
    "Admins can view relevant audit logs": r"has_role\(\s*auth\.uid\(\)\s*,\s*'admin'",
    "Super admins can view all audit logs": r"has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'",
}

# Every effective policy must scope to this exact role list. Adding
# `public`, `anon`, or an unbounded role would silently widen access.
ALLOWED_POLICY_ROLES = {"authenticated"}

# The guarded target — table + schema must match exactly. Any policy that
# references a different table (typo, wrong schema) will trip this check.
EXPECTED_TARGET = "public.audit_logs"


def die(msg: str) -> None:
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


def load_sql() -> str:
    if not MIGRATIONS_DIR.exists():
        die(f"migrations dir not found: {MIGRATIONS_DIR}")
    parts: list[str] = []
    for p in sorted(MIGRATIONS_DIR.glob("*.sql")):
        parts.append(p.read_text())
    return "\n".join(parts)


def effective_policies(sql: str) -> dict[str, str]:
    """Return {policy_name: full CREATE statement} for still-active audit_logs policies.

    Walks CREATE and DROP statements in document order so a DROP earlier in the
    stream doesn't wipe a CREATE that comes after it (common when a migration
    drops-then-recreates a policy in the same file).
    """
    created: dict[str, str] = {}
    pattern = re.compile(
        r'(?P<create>CREATE\s+POLICY\s+"(?P<cname>[^"]+)"[^;]+ON\s+public\.audit_logs[^;]+;)'
        r'|(?P<drop>DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"(?P<dname>[^"]+)"\s+ON\s+public\.audit_logs\s*;)',
        re.IGNORECASE,
    )
    for m in pattern.finditer(sql):
        if m.group("create"):
            created[m.group("cname")] = m.group("create")
        else:
            created.pop(m.group("dname"), None)
    return created


def check_policies(policies: dict[str, str]) -> list[str]:
    errors: list[str] = []

    # 1. Required SELECT policies present + correctly gated.
    for name, guard in EXPECTED_SELECT_POLICIES.items():
        stmt = policies.get(name)
        if not stmt:
            errors.append(f"missing required SELECT policy: {name!r}")
            continue
        if not re.search(r"FOR\s+SELECT", stmt, re.IGNORECASE):
            errors.append(f"policy {name!r} must be FOR SELECT")
        if not re.search(guard, stmt, re.IGNORECASE):
            errors.append(f"policy {name!r} must be gated by {guard}")

    # 2. No write policies (INSERT/UPDATE/DELETE/ALL) may exist.
    for name, stmt in policies.items():
        if re.search(r"FOR\s+(INSERT|UPDATE|DELETE|ALL)\b", stmt, re.IGNORECASE):
            errors.append(
                f"unexpected write policy on audit_logs: {name!r} — writes must be "
                "service-role only"
            )

    # 3. Every SELECT policy must be admin/super_admin gated (defense in depth).
    for name, stmt in policies.items():
        if re.search(r"FOR\s+SELECT", stmt, re.IGNORECASE) and not re.search(
            r"has_role\(\s*auth\.uid\(\)\s*,\s*'(admin|super_admin)'",
            stmt,
            re.IGNORECASE,
        ):
            errors.append(
                f"SELECT policy {name!r} must be gated by has_role(admin|super_admin)"
            )

    # 4. Every effective policy must target exactly public.audit_logs. Guard
    #    against typos or accidental cross-schema references sneaking in.
    for name, stmt in policies.items():
        if not re.search(
            rf"ON\s+{re.escape(EXPECTED_TARGET)}\b", stmt, re.IGNORECASE
        ):
            errors.append(
                f"policy {name!r} must target {EXPECTED_TARGET} exactly"
            )

    # 5. Role scope: TO clause must be a subset of ALLOWED_POLICY_ROLES.
    #    A missing TO clause means PUBLIC (all roles including anon) — reject.
    for name, stmt in policies.items():
        m = re.search(r"\bTO\s+([A-Za-z0-9_,\s]+?)(?=\s+(?:USING|WITH|FOR)\b|;)", stmt, re.IGNORECASE)
        if not m:
            errors.append(
                f"policy {name!r} missing explicit TO clause — defaults to PUBLIC"
            )
            continue
        roles = {r.strip().lower() for r in m.group(1).split(",") if r.strip()}
        stray = roles - ALLOWED_POLICY_ROLES
        if stray:
            errors.append(
                f"policy {name!r} grants role(s) outside {sorted(ALLOWED_POLICY_ROLES)}: {sorted(stray)}"
            )

    # 6. Required SELECT policies must reference auth.uid() (never a static value).
    for name in EXPECTED_SELECT_POLICIES:
        stmt = policies.get(name)
        if stmt and not re.search(r"auth\.uid\(\)", stmt, re.IGNORECASE):
            errors.append(f"policy {name!r} must call auth.uid() in its USING clause")

    return errors


def check_grants(sql: str) -> list[str]:
    errors: list[str] = []

    if not re.search(
        r"GRANT\s+SELECT\s+ON\s+public\.audit_logs\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ):
        errors.append("missing grant: SELECT on public.audit_logs TO authenticated")

    if not re.search(
        r"GRANT\s+ALL\s+ON\s+public\.audit_logs\s+TO\s+service_role",
        sql,
        re.IGNORECASE,
    ):
        errors.append("missing grant: ALL on public.audit_logs TO service_role")

    # Any grant that mentions anon on audit_logs is forbidden.
    for m in re.finditer(
        r"GRANT[^;]*ON\s+public\.audit_logs[^;]*;", sql, re.IGNORECASE
    ):
        if re.search(r"\banon\b", m.group(0), re.IGNORECASE):
            errors.append(f"stray grant to anon: {m.group(0).strip()}")

    # Guard against non-SELECT grants to authenticated (INSERT/UPDATE/DELETE/ALL).
    for m in re.finditer(
        r"GRANT\s+([A-Z, ]+)\s+ON\s+public\.audit_logs\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ):
        privs = {p.strip().upper() for p in m.group(1).split(",")}
        if not privs.issubset({"SELECT"}):
            errors.append(
                f"authenticated has extra privileges on audit_logs: {sorted(privs)}"
            )
    return errors


def main() -> int:
    sql = load_sql()
    policies = effective_policies(sql)
    errors = check_policies(policies) + check_grants(sql)

    if errors:
        for e in errors:
            print(f"::error::audit_logs RLS regression: {e}", file=sys.stderr)
        return 1

    print("ok  audit_logs RLS policy set + grants unchanged")
    print(f"    effective policies: {sorted(policies)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
