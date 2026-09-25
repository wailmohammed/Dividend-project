#!/usr/bin/env python3
"""
Format a short Markdown summary of the security-regression JUnit report
for posting as a GitHub PR comment.

Output goes to stdout. Non-zero exit only if the JUnit file is missing or
malformed — content-level failures are reported as part of the summary so
the PR comment still renders when tests fail.
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

TARGETED_IDS = [
    "default_enc_key_fallback",
    "admin_notif_spoof",
    "SUPA_auth_leaked_password_protection",
    "audit_logs_rls",
]

MARKER_RE = re.compile(r"regression\[([^\]]+)\]")


def main(path: str) -> int:
    report = Path(path)
    lines: list[str] = ["## 🔐 Security Regression Summary", ""]

    if not report.exists() or report.stat().st_size == 0:
        lines.append("❌ JUnit report missing or empty — tests did not produce output.")
        print("\n".join(lines))
        return 0

    try:
        root = ET.parse(report).getroot()
    except ET.ParseError as e:
        lines.append(f"❌ JUnit report is not well-formed XML: `{e}`")
        print("\n".join(lines))
        return 0

    testcases = root.findall(".//testcase")
    per_id_pass: dict[str, int] = {tid: 0 for tid in TARGETED_IDS}
    per_id_fail: dict[str, list[str]] = {tid: [] for tid in TARGETED_IDS}
    other_failures: list[str] = []

    for tc in testcases:
        name = tc.attrib.get("name", "")
        failed = tc.find("failure") is not None or tc.find("error") is not None
        m = MARKER_RE.search(name)
        if m and m.group(1) in per_id_pass:
            tid = m.group(1)
            if failed:
                per_id_fail[tid].append(name)
            else:
                per_id_pass[tid] += 1
        elif failed:
            other_failures.append(name)

    any_failed = any(per_id_fail.values()) or any(
        c == 0 for c in per_id_pass.values()
    )

    lines.append("| internal_id | passing | failing |")
    lines.append("| --- | --- | --- |")
    for tid in TARGETED_IDS:
        p = per_id_pass[tid]
        f = len(per_id_fail[tid])
        status = "✅" if (p > 0 and f == 0) else "❌"
        lines.append(f"| `{tid}` | {status} {p} | {f} |")

    failing_names = [(tid, n) for tid, ns in per_id_fail.items() for n in ns]
    if failing_names:
        lines.append("")
        lines.append(f"### Failing targeted tests ({len(failing_names)})")
        # Always list every failing targeted test — never truncate, even if
        # only a subset of the targeted IDs failed.
        for tid, n in failing_names:
            lines.append(f"- **{tid}** — `{n}`")

    missing = [tid for tid, c in per_id_pass.items() if c == 0]
    if missing:
        lines.append("")
        lines.append("### Missing coverage")
        for tid in missing:
            lines.append(f"- `{tid}` has no passing testcase")

    if other_failures:
        lines.append("")
        lines.append(f"### Other failing tests ({len(other_failures)})")
        # List every non-targeted failure too — no truncation.
        for n in other_failures:
            lines.append(f"- `{n}`")

    lines.append("")
    lines.append(
        "_Full JUnit XML and parsed summary are attached as workflow artifacts._"
    )
    if not any_failed and not other_failures:
        lines.append("")
        lines.append("All targeted regression tests are green. 🎉")

    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: format_regression_comment.py <path-to-junit.xml>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
