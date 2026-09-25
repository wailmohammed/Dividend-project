#!/usr/bin/env python3
"""
Parse the Deno JUnit report from the security-regression workflow and enforce:

  1. The XML file exists and is well-formed.
  2. Every targeted internal_id has at least one *passing* test case
     (a testcase whose name contains ``regression[<internal_id>]`` and has
     no <failure> or <error> child).
  3. No testcase referencing a targeted internal_id is failing or errored.

Exits non-zero with a GitHub Actions ``::error::`` annotation on any breach.
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

TARGETED_IDS = [
    "default_enc_key_fallback",
    "admin_notif_spoof",
    "SUPA_auth_leaked_password_protection",
    "audit_logs_rls",
]


def die(msg: str) -> None:
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


def main(path: str) -> None:
    report = Path(path)
    if not report.exists() or report.stat().st_size == 0:
        die(f"JUnit report missing or empty: {report}")

    try:
        root = ET.parse(report).getroot()
    except ET.ParseError as e:
        die(f"JUnit report is not well-formed XML: {e}")

    testcases = root.findall(".//testcase")
    if not testcases:
        die("JUnit report contains no <testcase> entries")

    # Bucket testcases by targeted internal_id.
    per_id_pass: dict[str, int] = {tid: 0 for tid in TARGETED_IDS}
    per_id_fail: dict[str, list[str]] = {tid: [] for tid in TARGETED_IDS}

    for tc in testcases:
        name = tc.attrib.get("name", "")
        failed = tc.find("failure") is not None or tc.find("error") is not None
        for tid in TARGETED_IDS:
            marker = f"regression[{tid}]"
            if marker in name:
                if failed:
                    per_id_fail[tid].append(name)
                else:
                    per_id_pass[tid] += 1

    # Fail on any regression: targeted test that is failing/errored.
    hard_failures: list[str] = []
    for tid, failing_names in per_id_fail.items():
        for fname in failing_names:
            hard_failures.append(f"{tid}: {fname}")
    if hard_failures:
        for line in hard_failures:
            print(f"::error::Regression detected -> {line}", file=sys.stderr)
        sys.exit(1)

    # Fail on missing coverage: no passing testcase for a targeted id.
    missing = [tid for tid, count in per_id_pass.items() if count == 0]
    if missing:
        for tid in missing:
            print(
                f"::error::No passing test coverage found for internal_id={tid}",
                file=sys.stderr,
            )
        sys.exit(1)

    # Success summary.
    for tid, count in per_id_pass.items():
        print(f"ok  regression[{tid}] -> {count} passing testcase(s)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        die("usage: check_regression_junit.py <path-to-junit.xml>")
    main(sys.argv[1])
