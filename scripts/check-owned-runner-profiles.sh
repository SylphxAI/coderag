#!/usr/bin/env bash
# Enforce the fleet-owned runner contract for this repository's direct jobs.
# Reusable workflows are governed by the repository that owns their source.
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

python3 - "$ROOT" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
workflow_dir = root / ".github" / "workflows"
selection = re.compile(r"^\s*runs-on\s*:\s*(?P<value>.*?)(?:\s+#.*)?$")
linux = re.compile(r"^sylphx-linux-(?:standard|large|xlarge|2xlarge)$")
macos = re.compile(r"^\[\s*self-hosted\s*,\s*sylphx\s*,\s*macos\s*,\s*(?:nano|small|standard|large|xlarge|2xlarge)\s*\]$")
hosted = re.compile(r"\b(?:ubuntu|macos|windows)-(?:latest|\d+(?:\.\d+)?)\b", re.I)

violations = []
checked = 0
for workflow in sorted((*workflow_dir.glob("*.yml"), *workflow_dir.glob("*.yaml"))):
    for line_no, line in enumerate(workflow.read_text().splitlines(), start=1):
        match = selection.match(line)
        if not match:
            continue
        checked += 1
        value = match.group("value").strip().strip("\"'")
        if "${{" in value:
            violations.append((workflow, line_no, "dynamic runner selection", value))
        elif hosted.search(value):
            violations.append((workflow, line_no, "GitHub-hosted runner", value))
        elif not (linux.fullmatch(value) or macos.fullmatch(value)):
            violations.append((workflow, line_no, "not a published static Sylphx profile", value))

if checked == 0:
    raise SystemExit("no direct workflow runner selections found")
if violations:
    for workflow, line_no, reason, value in violations:
        print(f"{workflow.relative_to(root)}:{line_no}: {reason}: {value}", file=sys.stderr)
    raise SystemExit("owned-runner profile contract failed")

print(f"OK: {checked} direct workflow job(s) use static Sylphx-owned runner profiles")
PY
