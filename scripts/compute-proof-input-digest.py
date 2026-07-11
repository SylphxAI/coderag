#!/usr/bin/env python3
"""Compute and optionally stamp proofInputDigest on migration ledger proofs.

Packet: PROOF-INPUT-DIGEST-ADOPTION-TICK031

Product-side helper (vendored into product repos or sparse-checked out from
control-plane). Binds green/promoted proofs to behavioral inputs so HEAD-only
SHA binding cannot keep a proof "current" after contracts, fixtures, harness,
or deploy specs change.

Canonical fields (see scripts/proof_input_digest.py):
  tsClosure, rustClosure, contracts, config, deps, fixtures, harness, deploySpecs

Modes:
  1) From ledger surfaces/metadata (default, no tree required):
       python3 scripts/compute-proof-input-digest.py --ledger docs/specs/migration-ledger.json

  2) From explicit field values / path globs under --repo-root:
       python3 scripts/compute-proof-input-digest.py \\
         --ledger docs/specs/migration-ledger.json \\
         --repo-root . \\
         --hash-globs

  3) Stamp digests back onto the ledger (in-place or --out):
       python3 scripts/compute-proof-input-digest.py --ledger ... --stamp --out path.json

Does NOT promote states, invent ts_deleted, or claim REPO_COMPLETE.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import proof_input_digest as pid  # type: ignore
except ImportError:  # pragma: no cover
    # When vendored alone, allow sibling import from control-plane path.
    import importlib.util

    candidate = ROOT / "scripts" / "proof_input_digest.py"
    if not candidate.is_file():
        candidate = Path(__file__).resolve().parent / "proof_input_digest.py"
    spec = importlib.util.spec_from_file_location("proof_input_digest", candidate)
    if not spec or not spec.loader:
        raise
    pid = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pid)

PACKET_ID = "PROOF-INPUT-DIGEST-ADOPTION-TICK031"
GREEN = frozenset({"differential_green", "caught_up", "canary_green"})
PROMOTED = frozenset({"parity_proven", "authority_rust", "ts_deleted"})


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def hash_globs(repo_root: Path, patterns: list[str]) -> str | None:
    """Stable digest over sorted matching file contents (path + bytes)."""
    if not patterns:
        return None
    files: set[Path] = set()
    for pat in patterns:
        pat = pat.strip()
        if not pat:
            continue
        # Allow bare paths and globs.
        if any(ch in pat for ch in "*?[]"):
            files.update(p for p in repo_root.glob(pat) if p.is_file())
        else:
            candidate = repo_root / pat
            if candidate.is_file():
                files.add(candidate)
            elif candidate.is_dir():
                files.update(p for p in candidate.rglob("*") if p.is_file())
    if not files:
        return None
    ordered = sorted(files, key=lambda p: str(p.relative_to(repo_root)).replace("\\", "/"))
    h = hashlib.sha256()
    for path in ordered:
        rel = str(path.relative_to(repo_root)).replace("\\", "/")
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        h.update(sha256_file(path).encode("ascii"))
        h.update(b"\0")
    return h.hexdigest()


def split_path_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(split_path_list(item))
        return out
    if not isinstance(value, str):
        return []
    # differentialTest may list multiple paths separated by ';'
    parts: list[str] = []
    for chunk in value.replace("\n", ";").split(";"):
        token = chunk.strip()
        if not token:
            continue
        # Drop "#symbol" suffixes used in ledger notes.
        if "#" in token and not token.startswith("#"):
            token = token.split("#", 1)[0].strip()
        # Drop trailing parenthetical notes.
        if " (" in token:
            token = token.split(" (", 1)[0].strip()
        if token:
            parts.append(token)
    return parts


def fields_with_tree_hash(
    cap: dict[str, Any],
    *,
    repo_root: Path | None,
    hash_globs_enabled: bool,
) -> dict[str, Any]:
    """Build field map from ledger metadata, optionally hashing tree globs."""
    base = pid.fields_from_capability_surfaces(cap)
    if not hash_globs_enabled or repo_root is None:
        return base

    proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else {}
    # Overlay tree hashes when paths resolve.
    ts_paths = split_path_list(cap.get("tsSurface"))
    rust_paths = split_path_list(cap.get("rustSurface"))
    harness_paths = split_path_list(
        cap.get("differentialTest") or cap.get("parityTest")
    )
    dep_globs = proof.get("dependencyGlobs") if isinstance(proof, dict) else None
    dep_paths = split_path_list(dep_globs)

    if ts_paths:
        d = hash_globs(repo_root, ts_paths)
        if d:
            base["tsClosure"] = d
    if rust_paths:
        d = hash_globs(repo_root, rust_paths)
        if d:
            base["rustClosure"] = d
    if dep_paths:
        d = hash_globs(repo_root, dep_paths)
        if d:
            base["deps"] = d
    if harness_paths:
        d = hash_globs(repo_root, harness_paths)
        if d:
            base["harness"] = d
    return base


def select_caps(
    ledger: dict[str, Any],
    *,
    only_ids: set[str] | None,
    green_or_promoted_only: bool,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for cap in ledger.get("capabilities") or []:
        if not isinstance(cap, dict):
            continue
        cid = cap.get("id")
        if not isinstance(cid, str):
            continue
        if only_ids is not None and cid not in only_ids:
            continue
        if green_or_promoted_only:
            state = str(cap.get("state") or "")
            proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else {}
            status = str((proof or {}).get("status") or "")
            if state not in PROMOTED and status not in GREEN:
                continue
        out.append(cap)
    return out


def compute_for_ledger(
    ledger: dict[str, Any],
    *,
    repo_root: Path | None,
    hash_globs_enabled: bool,
    only_ids: set[str] | None,
    green_or_promoted_only: bool,
    bound_sha: str | None,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for cap in select_caps(
        ledger, only_ids=only_ids, green_or_promoted_only=green_or_promoted_only
    ):
        proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else {}
        fields = fields_with_tree_hash(
            cap, repo_root=repo_root, hash_globs_enabled=hash_globs_enabled
        )
        bound = bound_sha
        if not bound and isinstance(proof, dict):
            bound = proof.get("lastComparedMainSha") or proof.get("rustCandidateSha")
        digest = pid.compute_proof_input_digest(fields, bound_product_sha=bound)
        results.append(
            {
                "id": cap.get("id"),
                "state": cap.get("state"),
                "status": (proof or {}).get("status"),
                "fieldsMaterial": fields,
                "digest": digest,
            }
        )
    return {
        "packetId": PACKET_ID,
        "repo": ledger.get("repo"),
        "count": len(results),
        "capabilities": results,
    }


def stamp_ledger(
    ledger: dict[str, Any],
    report: dict[str, Any],
) -> dict[str, Any]:
    by_id = {
        c["id"]: c["digest"]
        for c in report.get("capabilities") or []
        if isinstance(c, dict) and c.get("id") and isinstance(c.get("digest"), dict)
    }
    out = json.loads(json.dumps(ledger))  # deep copy via JSON
    for cap in out.get("capabilities") or []:
        if not isinstance(cap, dict):
            continue
        cid = cap.get("id")
        if cid not in by_id:
            continue
        proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else None
        if proof is None:
            continue
        cap["proof"] = pid.apply_digest_to_proof(proof, by_id[cid], flat=True)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ledger", required=True, type=Path, help="Path to migration ledger JSON")
    ap.add_argument("--repo-root", type=Path, default=None, help="Product repo root for glob hashing")
    ap.add_argument(
        "--hash-globs",
        action="store_true",
        help="Hash resolved path/glob contents under --repo-root when present",
    )
    ap.add_argument(
        "--capability",
        action="append",
        default=[],
        help="Limit to capability id (repeatable). Default: green/promoted only.",
    )
    ap.add_argument(
        "--all-caps",
        action="store_true",
        help="Include non-green/non-promoted capabilities",
    )
    ap.add_argument("--bound-sha", default=None, help="Override proofInputDigestBoundSha")
    ap.add_argument("--stamp", action="store_true", help="Write digests onto proof objects")
    ap.add_argument("--out", type=Path, default=None, help="Output path for stamped ledger or report")
    ap.add_argument("--json", action="store_true", help="Always emit JSON report to stdout")
    args = ap.parse_args(argv)

    ledger_path = args.ledger
    if not ledger_path.is_file():
        print(f"error: ledger not found: {ledger_path}", file=sys.stderr)
        return 2
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    if not isinstance(ledger, dict):
        print("error: ledger must be a JSON object", file=sys.stderr)
        return 2

    only_ids = set(args.capability) if args.capability else None
    report = compute_for_ledger(
        ledger,
        repo_root=args.repo_root,
        hash_globs_enabled=bool(args.hash_globs),
        only_ids=only_ids,
        green_or_promoted_only=not args.all_caps,
        bound_sha=args.bound_sha,
    )

    if args.stamp:
        stamped = stamp_ledger(ledger, report)
        out_path = args.out or ledger_path
        out_path.write_text(json.dumps(stamped, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        print(
            f"stamped {report['count']} capability digest(s) → {out_path} "
            f"(packet={PACKET_ID})",
            file=sys.stderr,
        )
        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        return 0

    out_path = args.out
    payload = json.dumps(report, indent=2, sort_keys=True)
    if out_path:
        out_path.write_text(payload + "\n", encoding="utf-8")
        print(f"wrote report → {out_path}", file=sys.stderr)
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
