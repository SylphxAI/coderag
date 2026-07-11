#!/usr/bin/env python3
"""Fail-closed parity proof integrity assertions (PARITY-WORKFLOW-FAILCLOSED-TICK028).

Canonical SSOT for rust-parity-drift / differential proof binding checks.
Replaces soft-warn / echo placeholders in fleet parity workflows.

Checks (any failure → exit 1):
  1. SHA fields are full 40-char lowercase hex when present; green proofs require
     lastComparedMainSha (and candidate match when --candidate-sha is set).
  2. capabilitiesProven / mapped capability IDs exist in the provided ledger.
  3. Source / harness / artifact paths exist under --repo-root when --require-paths
     (or when mode is ci).
  4. Fabricated green proof.status without a verification artifact is REJECTED.
  5. Exclusion objects missing expiresAt/reason/adr, or with expiresAt in the past,
     are REJECTED (coverage surfaces, verification exclusions, ledger exclusions).
  6. Stale capability lists without a successful re-proof binding are REJECTED
     when --stale-capabilities is non-empty and proof is not green at candidate.

Modes:
  verification  — single verification JSON artifact
  ledger        — migration ledger (capability proofs)
  ci            — product CI: verification + optional ledger + stale list
  fleet         — control-plane verification/* scan (+ optional coverage exclusions)

Product adoption: vendor this script or sparse-checkout from control-plane and
invoke from rust-parity-differential.yml (see PARITY-VERIFICATION-STANDARD.md).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PACKET_ID = "PARITY-WORKFLOW-FAILCLOSED-TICK028"
REJECTION_REF = "rej-015-parity-proof-integrity"

HEX40_RE = re.compile(r"^[0-9a-f]{40}$")
# Accept uppercase hex only after normalize; reject mixed non-hex.
HEX40_RAW_RE = re.compile(r"^[0-9a-fA-F]{40}$")

GREEN_STATUSES = frozenset({"differential_green", "caught_up", "canary_green"})
SHA_FIELD_NAMES = (
    "baselineTsSha",
    "rustCandidateSha",
    "lastComparedMainSha",
    "mergeGroupSha",
    "boundSha",
    "defaultBranchTipAtProof",
    "git_sha",
    "gitSha",
)

# Path-like keys on verification artifacts / capability proof blocks.
PATH_FIELD_NAMES = (
    "verificationRef",
    "harness",
    "differentialTest",
    "parityTest",
    "oracle",
    "gate",
    "artifact",
    "proofArtifact",
    "harnessPath",
    "artifactPath",
    "prodProbe",
)

# Prefixes that are path-like (not bare commands like "cargo test").
PATHISH_PREFIXES = (
    "verification/",
    "audits/",
    "scripts/",
    "docs/",
    "probes/",
    "implementer/",
    "crates/",
    "packages/",
    "server/",
    "src/",
    "apps/",
    "services/",
    "tools/",
    "tests/",
    "test/",
    "coverage/",
    ".github/",
)


class Finding:
    __slots__ = ("severity", "code", "message", "context")

    def __init__(
        self,
        severity: str,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
    ) -> None:
        self.severity = severity  # error | warning
        self.code = code
        self.message = message
        self.context = context or {}

    def as_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "context": self.context,
        }


def parse_utc(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_valid_sha(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    s = value.strip()
    if not s:
        return False
    return bool(HEX40_RAW_RE.fullmatch(s))


def normalize_sha(value: str) -> str:
    return value.strip().lower()


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def first_path_token(value: str) -> str | None:
    """Extract first path-like token from a possibly multi-command field."""
    if not isinstance(value, str) or not value.strip():
        return None
    # Strip trailing fragment anchors used in ledgers (file.rs#symbol).
    for chunk in re.split(r"[;\n|]+", value):
        chunk = chunk.strip()
        if not chunk:
            continue
        # Take first whitespace-separated token (drop flags).
        token = chunk.split()[0].strip().strip("'\"")
        if "#" in token and not token.startswith("#"):
            token = token.split("#", 1)[0]
        if any(token.startswith(p) for p in PATHISH_PREFIXES):
            return token
        # relative path with extension and no spaces
        if (
            "/" in token
            and not token.startswith("-")
            and not token.startswith("http")
            and re.search(r"\.(rs|ts|tsx|js|mjs|cjs|json|sh|py|md|toml|yaml|yml)$", token)
        ):
            return token
    return None


def ledger_capability_ids(ledger: dict) -> set[str]:
    ids: set[str] = set()
    for cap in ledger.get("capabilities") or []:
        if isinstance(cap, dict):
            cid = cap.get("id")
            if isinstance(cid, str) and cid.strip():
                ids.add(cid.strip())
    # Some product manifests put domains as capability-like entries.
    for dom in ledger.get("domains") or []:
        if isinstance(dom, dict):
            cid = dom.get("id")
            if isinstance(cid, str) and cid.strip():
                ids.add(cid.strip())
    return ids


def collect_exclusions(obj: Any, path: str = "$") -> list[tuple[str, dict]]:
    """Walk JSON tree for objects under key 'exclusion' or list 'exclusions'."""
    found: list[tuple[str, dict]] = []
    if isinstance(obj, dict):
        if "exclusion" in obj and obj["exclusion"] is not None:
            ex = obj["exclusion"]
            if isinstance(ex, dict):
                found.append((f"{path}.exclusion", ex))
            else:
                found.append((f"{path}.exclusion", {"_invalid_type": type(ex).__name__}))
        if "exclusions" in obj and isinstance(obj["exclusions"], list):
            for i, ex in enumerate(obj["exclusions"]):
                if isinstance(ex, dict):
                    found.append((f"{path}.exclusions[{i}]", ex))
                else:
                    found.append(
                        (
                            f"{path}.exclusions[{i}]",
                            {"_invalid_type": type(ex).__name__},
                        )
                    )
        for k, v in obj.items():
            if k in ("exclusion", "exclusions"):
                continue
            found.extend(collect_exclusions(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found.extend(collect_exclusions(v, f"{path}[{i}]"))
    return found


def check_exclusion(
    path: str,
    exclusion: dict,
    *,
    now: datetime | None = None,
) -> list[Finding]:
    findings: list[Finding] = []
    clock = now or datetime.now(timezone.utc)
    if "_invalid_type" in exclusion:
        findings.append(
            Finding(
                "error",
                "exclusion_type",
                f"{path}: exclusion must be object (got {exclusion['_invalid_type']})",
                {"path": path},
            )
        )
        return findings
    reason = str(exclusion.get("reason") or "").strip()
    adr = str(exclusion.get("adr") or "").strip()
    exp_raw = exclusion.get("expiresAt")
    exp = parse_utc(str(exp_raw) if exp_raw is not None else None)
    if not reason:
        findings.append(
            Finding(
                "error",
                "exclusion_missing_reason",
                f"{path}: exclusion.reason required",
                {"path": path},
            )
        )
    if not adr:
        findings.append(
            Finding(
                "error",
                "exclusion_missing_adr",
                f"{path}: exclusion.adr required",
                {"path": path},
            )
        )
    if exp is None:
        findings.append(
            Finding(
                "error",
                "exclusion_missing_expires_at",
                f"{path}: exclusion.expiresAt required (ISO-8601 UTC)",
                {"path": path, "expiresAt": exp_raw},
            )
        )
    elif exp <= clock:
        findings.append(
            Finding(
                "error",
                "exclusion_expired",
                f"{path}: exclusion expired at {exp.isoformat()} (now={clock.isoformat()})",
                {"path": path, "expiresAt": exp.isoformat()},
            )
        )
    return findings


def check_sha_fields(
    obj: dict,
    *,
    where: str,
    require_last_compared_if_green: bool = True,
) -> list[Finding]:
    findings: list[Finding] = []
    status = obj.get("status")
    is_green = status in GREEN_STATUSES

    for key in SHA_FIELD_NAMES:
        if key not in obj:
            continue
        val = obj.get(key)
        if val is None or val == "":
            # Empty optional SHA is not a format violation; green required below.
            continue
        if not is_valid_sha(val):
            findings.append(
                Finding(
                    "error",
                    "invalid_sha_format",
                    f"{where}.{key} must be 40-hex (got {val!r})",
                    {"field": key, "value": val, "where": where},
                )
            )

    if require_last_compared_if_green and is_green:
        last = obj.get("lastComparedMainSha")
        if not last or not isinstance(last, str) or not last.strip():
            findings.append(
                Finding(
                    "error",
                    "missing_last_compared_sha",
                    f"{where}: green status={status} requires lastComparedMainSha",
                    {"where": where, "status": status},
                )
            )
        elif not is_valid_sha(last):
            # already reported as invalid_sha_format if present non-empty bad;
            # if present but invalid, ensure coded.
            if is_valid_sha(last) is False and last.strip():
                pass  # covered above
    return findings


def check_paths_exist(
    obj: dict,
    *,
    where: str,
    repo_root: Path,
    require: bool,
) -> list[Finding]:
    if not require:
        return []
    findings: list[Finding] = []
    for key in PATH_FIELD_NAMES:
        val = obj.get(key)
        if not isinstance(val, str) or not val.strip():
            continue
        token = first_path_token(val)
        if not token:
            continue
        # Skip absolute / env / phantom tokens — those fail elsewhere.
        if token.startswith("/") or token.startswith("~"):
            findings.append(
                Finding(
                    "error",
                    "absolute_path_rejected",
                    f"{where}.{key} must be repo-relative (got {token!r})",
                    {"field": key, "path": token, "where": where},
                )
            )
            continue
        target = (repo_root / token).resolve()
        try:
            target.relative_to(repo_root.resolve())
        except ValueError:
            findings.append(
                Finding(
                    "error",
                    "path_escapes_repo",
                    f"{where}.{key} escapes repo root: {token}",
                    {"field": key, "path": token, "where": where},
                )
            )
            continue
        if not (repo_root / token).exists():
            findings.append(
                Finding(
                    "error",
                    "path_missing",
                    f"{where}.{key} path missing at checkout: {token}",
                    {"field": key, "path": token, "where": where},
                )
            )
    return findings


def assert_verification_artifact(
    artifact: dict,
    *,
    path: str | Path | None = None,
    ledger: dict | None = None,
    candidate_sha: str | None = None,
    repo_root: Path | None = None,
    require_paths: bool = False,
    require_artifact_file: bool = False,
    artifact_file: Path | None = None,
    now: datetime | None = None,
) -> list[Finding]:
    """Validate one verification / proof artifact object."""
    findings: list[Finding] = []
    where = str(path) if path else "verification"

    if not isinstance(artifact, dict):
        return [
            Finding(
                "error",
                "artifact_not_object",
                f"{where}: verification artifact must be a JSON object",
            )
        ]

    if require_artifact_file:
        if artifact_file is None or not artifact_file.is_file():
            findings.append(
                Finding(
                    "error",
                    "fabricated_proof_missing_artifact",
                    f"{where}: green/claimed proof has no artifact file on disk",
                    {"artifactFile": str(artifact_file) if artifact_file else None},
                )
            )

    status = artifact.get("status")
    findings.extend(check_sha_fields(artifact, where=where))

    if status in GREEN_STATUSES and require_artifact_file is False and artifact_file is not None:
        # When a path was provided, file must exist for green claims.
        if not artifact_file.is_file():
            findings.append(
                Finding(
                    "error",
                    "fabricated_proof_missing_artifact",
                    f"{where}: status={status} but artifact file missing: {artifact_file}",
                    {"status": status, "artifactFile": str(artifact_file)},
                )
            )

    if candidate_sha is not None:
        if not is_valid_sha(candidate_sha):
            findings.append(
                Finding(
                    "error",
                    "invalid_candidate_sha",
                    f"candidate SHA must be 40-hex (got {candidate_sha!r})",
                    {"candidateSha": candidate_sha},
                )
            )
        elif status in GREEN_STATUSES:
            last = artifact.get("lastComparedMainSha")
            if isinstance(last, str) and is_valid_sha(last):
                if normalize_sha(last) != normalize_sha(candidate_sha):
                    findings.append(
                        Finding(
                            "error",
                            "sha_binding_mismatch",
                            f"{where}: lastComparedMainSha={last} != candidate={candidate_sha}",
                            {
                                "lastComparedMainSha": last,
                                "candidateSha": candidate_sha,
                            },
                        )
                    )

    # Capability ID resolution
    if ledger is not None:
        known = ledger_capability_ids(ledger)
        proven = artifact.get("capabilitiesProven") or artifact.get("capabilities") or []
        if isinstance(proven, list):
            for cid in proven:
                if not isinstance(cid, str) or not cid.strip():
                    findings.append(
                        Finding(
                            "error",
                            "invalid_capability_id",
                            f"{where}: empty/non-string capability id in capabilitiesProven",
                        )
                    )
                    continue
                if cid.strip() not in known:
                    findings.append(
                        Finding(
                            "error",
                            "unknown_capability_id",
                            f"{where}: capability id {cid!r} not present in ledger",
                            {"capabilityId": cid},
                        )
                    )

    if repo_root is not None:
        findings.extend(
            check_paths_exist(
                artifact,
                where=where,
                repo_root=repo_root,
                require=require_paths,
            )
        )

    for ex_path, ex in collect_exclusions(artifact):
        findings.extend(check_exclusion(f"{where}{ex_path[1:]}", ex, now=now))

    return findings


def assert_ledger_proofs(
    ledger: dict,
    *,
    path: str | Path | None = None,
    repo_root: Path | None = None,
    require_paths: bool = False,
    require_green_artifact: bool = True,
    now: datetime | None = None,
) -> list[Finding]:
    """Validate capability proof blocks on a migration ledger / parity manifest."""
    findings: list[Finding] = []
    where = str(path) if path else "ledger"
    if not isinstance(ledger, dict):
        return [
            Finding(
                "error",
                "ledger_not_object",
                f"{where}: ledger must be a JSON object",
            )
        ]

    caps = list(ledger.get("capabilities") or [])
    for dom in ledger.get("domains") or []:
        if isinstance(dom, dict) and dom.get("id"):
            caps.append(dom)

    known_ids = ledger_capability_ids(ledger)

    for cap in caps:
        if not isinstance(cap, dict):
            continue
        cid = cap.get("id") or "<missing-id>"
        cap_where = f"{where}#{cid}"
        proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else None

        # Surface path fields on capability
        if repo_root is not None and require_paths:
            findings.extend(
                check_paths_exist(
                    cap,
                    where=cap_where,
                    repo_root=repo_root,
                    require=True,
                )
            )

        if proof is None:
            continue

        # Inject status into a synthetic object for SHA checks
        proof_view = dict(proof)
        findings.extend(check_sha_fields(proof_view, where=f"{cap_where}.proof"))

        status = proof.get("status")
        if status in GREEN_STATUSES and require_green_artifact:
            ref = proof.get("verificationRef") or proof.get("artifact") or ""
            token = first_path_token(str(ref)) if ref else None
            if not token:
                findings.append(
                    Finding(
                        "error",
                        "fabricated_proof_missing_artifact",
                        f"{cap_where}: proof.status={status} without verificationRef/artifact",
                        {"capabilityId": cid, "status": status},
                    )
                )
            elif repo_root is not None and require_paths:
                if not (repo_root / token).is_file():
                    findings.append(
                        Finding(
                            "error",
                            "fabricated_proof_missing_artifact",
                            f"{cap_where}: proof.status={status} but artifact missing: {token}",
                            {
                                "capabilityId": cid,
                                "status": status,
                                "verificationRef": token,
                            },
                        )
                    )

            # Map dependency / surface capability references if present
            for dep_key in ("dependsOn", "relatedCapabilities"):
                deps = proof.get(dep_key) or cap.get(dep_key) or []
                if isinstance(deps, list):
                    for dep in deps:
                        if isinstance(dep, str) and dep.strip() and dep.strip() not in known_ids:
                            findings.append(
                                Finding(
                                    "error",
                                    "unknown_capability_id",
                                    f"{cap_where}: {dep_key} id {dep!r} not in ledger",
                                    {"capabilityId": cid, "ref": dep},
                                )
                            )

        if repo_root is not None and require_paths:
            findings.extend(
                check_paths_exist(
                    proof,
                    where=f"{cap_where}.proof",
                    repo_root=repo_root,
                    require=True,
                )
            )

    for ex_path, ex in collect_exclusions(ledger):
        findings.extend(check_exclusion(f"{where}{ex_path[1:]}", ex, now=now))

    return findings


def assert_stale_capabilities(
    stale: list[str] | str | None,
    *,
    verification: dict | None,
    candidate_sha: str | None,
) -> list[Finding]:
    """Fail-closed when stale caps exist without a green re-proof at candidate."""
    findings: list[Finding] = []
    if stale is None:
        return findings
    if isinstance(stale, str):
        raw = stale.strip()
        if not raw or raw == "[]":
            return findings
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return [
                Finding(
                    "error",
                    "invalid_stale_list",
                    f"stale-capabilities is not valid JSON: {raw!r}",
                )
            ]
        if not isinstance(parsed, list):
            return [
                Finding(
                    "error",
                    "invalid_stale_list",
                    "stale-capabilities must be a JSON array of capability ids",
                )
            ]
        stale_list = [str(x) for x in parsed]
    else:
        stale_list = [str(x) for x in stale]

    stale_list = [s for s in stale_list if s]
    if not stale_list:
        return findings

    if verification is None:
        findings.append(
            Finding(
                "error",
                "stale_without_reproof",
                f"stale capabilities {stale_list} require verification artifact re-proof",
                {"stale": stale_list},
            )
        )
        return findings

    status = verification.get("status")
    last = verification.get("lastComparedMainSha")
    if status not in GREEN_STATUSES:
        findings.append(
            Finding(
                "error",
                "stale_without_reproof",
                f"stale capabilities {stale_list} but verification status={status!r} (need green)",
                {"stale": stale_list, "status": status},
            )
        )
        return findings

    if candidate_sha and isinstance(last, str) and is_valid_sha(last):
        if normalize_sha(last) != normalize_sha(candidate_sha):
            findings.append(
                Finding(
                    "error",
                    "stale_without_reproof",
                    f"stale capabilities {stale_list} not re-proven at candidate "
                    f"(lastComparedMainSha={last} candidate={candidate_sha})",
                    {
                        "stale": stale_list,
                        "lastComparedMainSha": last,
                        "candidateSha": candidate_sha,
                    },
                )
            )
            return findings

    # Green at candidate: stale list is allowed (re-proof succeeded).
    return findings


def evaluate_fleet_verification_integrity(
    root: Path,
    *,
    now: datetime | None = None,
    check_coverage_exclusions: bool = True,
) -> dict[str, Any]:
    """Scan control-plane verification/* (and coverage exclusions) fail-closed.

    Ledger→artifact cross-links are NOT hard-failed here: product trees hold many
    verificationRefs that are not copied into CP. Unit/CI modes cover that case.
    """
    findings: list[Finding] = []
    verified_files = 0
    verification_dir = root / "verification"
    if verification_dir.is_dir():
        for path in sorted(verification_dir.glob("*.json")):
            try:
                data = load_json(path)
            except (OSError, json.JSONDecodeError) as exc:
                findings.append(
                    Finding(
                        "error",
                        "artifact_unreadable",
                        f"cannot parse {path.relative_to(root)}: {exc}",
                    )
                )
                continue
            verified_files += 1
            # Always require artifact file for green claims in fleet scan.
            rel = str(path.relative_to(root))
            status = data.get("status") if isinstance(data, dict) else None
            findings.extend(
                assert_verification_artifact(
                    data if isinstance(data, dict) else {},
                    path=rel,
                    repo_root=root,
                    require_paths=False,  # harness paths live in product repos
                    require_artifact_file=status in GREEN_STATUSES,
                    artifact_file=path,
                    now=now,
                )
            )

    if check_coverage_exclusions:
        coverage_dir = root / "coverage"
        if coverage_dir.is_dir():
            for path in sorted(coverage_dir.glob("*.json")):
                try:
                    data = load_json(path)
                except (OSError, json.JSONDecodeError) as exc:
                    findings.append(
                        Finding(
                            "error",
                            "coverage_unreadable",
                            f"cannot parse {path.relative_to(root)}: {exc}",
                        )
                    )
                    continue
                rel = str(path.relative_to(root))
                for ex_path, ex in collect_exclusions(data):
                    findings.extend(
                        check_exclusion(f"{rel}{ex_path[1:]}", ex, now=now)
                    )

    errors = [f for f in findings if f.severity == "error"]
    warnings = [f for f in findings if f.severity == "warning"]
    return {
        "ok": len(errors) == 0,
        "packetId": PACKET_ID,
        "rejectionRef": REJECTION_REF,
        "verificationFiles": verified_files,
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "hardErrors": [f.message for f in errors],
        "findings": [f.as_dict() for f in findings],
    }


def hard_errors_for_validate(root: Path | None = None) -> list[str]:
    """Entry for validate-control-plane.py."""
    base = root or Path(__file__).resolve().parents[1]
    result = evaluate_fleet_verification_integrity(base)
    if result["ok"]:
        return []
    return [f"parity proof integrity: {e}" for e in result["hardErrors"]]


def _emit(findings: list[Finding], *, json_out: bool) -> int:
    errors = [f for f in findings if f.severity == "error"]
    warnings = [f for f in findings if f.severity == "warning"]
    if json_out:
        payload = {
            "ok": len(errors) == 0,
            "packetId": PACKET_ID,
            "rejectionRef": REJECTION_REF,
            "errorCount": len(errors),
            "warningCount": len(warnings),
            "findings": [f.as_dict() for f in findings],
        }
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        for f in findings:
            prefix = "ERROR" if f.severity == "error" else "WARNING"
            print(f"{prefix}: [{f.code}] {f.message}", file=sys.stderr if f.severity == "error" else sys.stdout)
        if errors:
            print(
                f"assert-parity-proof-integrity: FAIL ({len(errors)} error(s), "
                f"packet={PACKET_ID})",
                file=sys.stderr,
            )
        else:
            print(
                f"assert-parity-proof-integrity: OK "
                f"(warnings={len(warnings)}, packet={PACKET_ID})"
            )
    return 1 if errors else 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--mode",
        choices=("verification", "ledger", "ci", "fleet"),
        default="ci",
        help="validation mode (default: ci)",
    )
    p.add_argument("--verification", type=Path, help="path to verification JSON artifact")
    p.add_argument("--ledger", type=Path, help="path to migration ledger / parity manifest")
    p.add_argument("--candidate-sha", dest="candidate_sha", help="merge-group / PR head SHA")
    p.add_argument(
        "--stale-capabilities",
        dest="stale_capabilities",
        help='JSON array of stale capability ids (e.g. \'["api/health"]\')',
    )
    p.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="checkout root for path existence (default: cwd)",
    )
    p.add_argument(
        "--require-paths",
        action="store_true",
        help="require harness/source/artifact paths to exist under repo-root",
    )
    p.add_argument(
        "--root",
        type=Path,
        default=None,
        help="control-plane root for fleet mode (default: parent of scripts/)",
    )
    p.add_argument("--json", action="store_true", help="emit JSON report on stdout")
    p.add_argument(
        "--now",
        help="override UTC now for exclusion expiry (ISO-8601; tests only)",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    now = parse_utc(args.now) if args.now else datetime.now(timezone.utc)
    repo_root = (args.repo_root or Path.cwd()).resolve()
    findings: list[Finding] = []

    if args.mode == "fleet":
        root = (args.root or Path(__file__).resolve().parents[1]).resolve()
        result = evaluate_fleet_verification_integrity(root, now=now)
        if args.json:
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0 if result.get("ok") else 1
        findings = [
            Finding(f["severity"], f["code"], f["message"], f.get("context"))
            for f in result["findings"]
        ]
        return _emit(findings, json_out=False)

    verification: dict | None = None
    verification_path: Path | None = None
    ledger: dict | None = None

    if args.verification:
        verification_path = args.verification
        if not verification_path.is_file():
            findings.append(
                Finding(
                    "error",
                    "fabricated_proof_missing_artifact",
                    f"verification artifact missing: {verification_path}",
                    {"artifactFile": str(verification_path)},
                )
            )
        else:
            try:
                data = load_json(verification_path)
            except (OSError, json.JSONDecodeError) as exc:
                findings.append(
                    Finding(
                        "error",
                        "artifact_unreadable",
                        f"cannot parse verification artifact: {exc}",
                    )
                )
                data = None
            if isinstance(data, dict):
                verification = data

    if args.ledger:
        if not args.ledger.is_file():
            findings.append(
                Finding(
                    "error",
                    "ledger_missing",
                    f"ledger missing: {args.ledger}",
                )
            )
        else:
            try:
                ledger = load_json(args.ledger)
            except (OSError, json.JSONDecodeError) as exc:
                findings.append(
                    Finding(
                        "error",
                        "ledger_unreadable",
                        f"cannot parse ledger: {exc}",
                    )
                )

    require_paths = args.require_paths or args.mode == "ci"

    if args.mode in ("verification", "ci") and verification is not None:
        findings.extend(
            assert_verification_artifact(
                verification,
                path=str(verification_path) if verification_path else "verification",
                ledger=ledger,
                candidate_sha=args.candidate_sha,
                repo_root=repo_root,
                require_paths=require_paths,
                require_artifact_file=True,
                artifact_file=verification_path,
                now=now,
            )
        )
    elif args.mode in ("verification", "ci") and verification is None and not findings:
        findings.append(
            Finding(
                "error",
                "fabricated_proof_missing_artifact",
                "--verification is required for verification/ci mode",
            )
        )

    if args.mode in ("ledger", "ci") and ledger is not None:
        # In ci mode, ledger path existence for green proofs is required only when
        # require_paths; product CI usually points harness paths at repo files.
        findings.extend(
            assert_ledger_proofs(
                ledger,
                path=str(args.ledger) if args.ledger else "ledger",
                repo_root=repo_root,
                require_paths=require_paths and args.mode == "ledger",
                require_green_artifact=args.mode == "ledger",
                now=now,
            )
        )
        # Always resolve capability ids from verification against ledger in ci.
        if args.mode == "ci" and verification is not None:
            # capability resolution already done in assert_verification_artifact
            pass

    if args.mode == "ci" or args.stale_capabilities is not None:
        findings.extend(
            assert_stale_capabilities(
                args.stale_capabilities,
                verification=verification,
                candidate_sha=args.candidate_sha,
            )
        )

    if args.mode == "ledger" and ledger is None and not findings:
        findings.append(
            Finding(
                "error",
                "ledger_missing",
                "--ledger is required for ledger mode",
            )
        )

    return _emit(findings, json_out=args.json)


if __name__ == "__main__":
    sys.exit(main())
