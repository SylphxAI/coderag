#!/usr/bin/env python3
"""Deterministic behavioral proof-input digests (TICK029 + TICK031 adoption).

Packets:
  - CP-DERIVED-CLEAN-AND-PROOF-DIGEST-TICK029 (fields + compute + mismatch wire)
  - PROOF-INPUT-DIGEST-ADOPTION-TICK031 (require digest for promoted/green)

Defines the canonical behavioral-input field set used to bind a differential
proof to the material that produced it:

  - tsClosure      TypeScript/JS oracle surfaces that implement the capability
  - rustClosure    Rust replacement surfaces under test
  - contracts      OpenAPI/proto/JSON-schema/RPC contracts
  - config         Runtime config / feature flags that affect behavior
  - deps           Declared runtime dependency pins (Cargo.lock / package-lock)
  - fixtures       Fixture corpus (bytes or path digests)
  - harness        Differential harness + case list
  - deploySpecs    Deploy/image/k8s/helm specs that bind production authority

`compute_proof_input_digest` produces a stable sha256 over a canonical JSON
encoding of those field digests. Callers supply pre-hashed field values (or
raw strings which are hashed). The overall digest is:

    sha256(canonical_json({field: digest_or_null for field in FIELD_ORDER}))

Schema fields (MIGRATION-LEDGER-SCHEMA-v3 proof object):
  - proofInputDigest          overall sha256 hex (or nested envelope)
  - proofInputDigestFields    object of per-field digests
  - proofInputDigestVersion   integer (currently 1)
  - proofInputDigestBoundSha product tip the digest was computed against

Stale-proof integration (fleet_watermarks.py / project-state / derived_clean):
  - Promoted states (parity_proven, authority_rust, ts_deleted) require a
    stored proofInputDigest (TICK031 fail-closed; missing = stale).
  - Green proof statuses (differential_green, caught_up, canary_green) also
    require digests for promotion-current claims (freeze-aware: missing marks
    stale without inventing promotions, lifting freezes, or claiming
    REPO_COMPLETE).
  - Stored digest mismatch vs recomputed fields blocks even when FCP=0.
  - DEFAULT_REQUIRE_DIGEST=True; pass require_digest=False only for explicit
    legacy stub tests.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

PACKET_ID = "CP-DERIVED-CLEAN-AND-PROOF-DIGEST-TICK029"
ADOPTION_PACKET_ID = "PROOF-INPUT-DIGEST-ADOPTION-TICK031"
DIGEST_VERSION = 1
# TICK031: missing digests on gated caps are stale (no longer stub-ok default).
DEFAULT_REQUIRE_DIGEST = True

# Stable ordered field set — never reorder without bumping DIGEST_VERSION.
FIELD_ORDER: tuple[str, ...] = (
    "tsClosure",
    "rustClosure",
    "contracts",
    "config",
    "deps",
    "fixtures",
    "harness",
    "deploySpecs",
)

# Capability states that assert production authority (digest-gated).
AUTHORITY_STATES = frozenset({"authority_rust", "ts_deleted"})
# Promoted lifecycle states — digest required for any current claim (TICK031).
PROMOTED_STATES = frozenset({"parity_proven", "authority_rust", "ts_deleted"})
# Green proof statuses — digest required (freeze-aware stale, not auto-promote).
GREEN_PROOF_STATUSES = frozenset({"differential_green", "caught_up", "canary_green"})

_SHA256_HEX_RE = re.compile(r"^[0-9a-f]{64}$")
_GIT_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def normalize_field_digest(value: Any) -> str | None:
    """Accept a precomputed sha256 hex or hash arbitrary string material."""
    if value is None:
        return None
    if isinstance(value, bytes):
        return sha256_bytes(value)
    if not isinstance(value, str):
        # Canonicalize non-strings via sorted JSON.
        try:
            payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        except (TypeError, ValueError):
            return None
        return sha256_text(payload)
    s = value.strip()
    if not s:
        return None
    low = s.lower()
    if _SHA256_HEX_RE.fullmatch(low):
        return low
    return sha256_text(s)


def normalize_git_sha(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    s = value.strip().lower()
    if not _GIT_SHA_RE.fullmatch(s):
        return None
    return s


def cap_requires_proof_input_digest(cap: Mapping[str, Any] | None) -> bool:
    """True when a capability claim must carry a proofInputDigest (TICK031).

    Required when:
      - state ∈ {parity_proven, authority_rust, ts_deleted}, OR
      - proof.status ∈ {differential_green, caught_up, canary_green}

    Freeze-aware: missing digests mark the proof stale for promotion/admission;
    they do not invent promotions, lift freezes, or claim REPO_COMPLETE.
    """
    if not isinstance(cap, Mapping):
        return False
    state = str(cap.get("state") or "").strip()
    if state in PROMOTED_STATES or state in AUTHORITY_STATES:
        return True
    proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else None
    if proof is None:
        return False
    status = str(proof.get("status") or "").strip()
    return status in GREEN_PROOF_STATUSES


def canonicalize_fields(
    fields: Mapping[str, Any] | None,
) -> dict[str, str | None]:
    """Return FIELD_ORDER-keyed map with normalized digests (missing → null)."""
    src = fields if isinstance(fields, Mapping) else {}
    out: dict[str, str | None] = {}
    for key in FIELD_ORDER:
        out[key] = normalize_field_digest(src.get(key))
    return out


def compute_proof_input_digest(
    fields: Mapping[str, Any] | None,
    *,
    bound_product_sha: str | None = None,
    version: int = DIGEST_VERSION,
    computed_at: str | None = None,
) -> dict[str, Any]:
    """Compute deterministic proof-input digest envelope.

    Returns:
      {
        "version": 1,
        "fields": { ... FIELD_ORDER → sha256|null },
        "overall": sha256 hex of canonical fields JSON,
        "boundProductSha": normalized git sha or null,
        "computedAt": ISO-8601,
        "packetId": PACKET_ID / ADOPTION_PACKET_ID,
      }
    """
    canonical = canonicalize_fields(fields)
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    overall = sha256_text(payload)
    return {
        "version": int(version),
        "fields": canonical,
        "overall": overall,
        "boundProductSha": normalize_git_sha(bound_product_sha),
        "computedAt": computed_at or now_iso(),
        "packetId": ADOPTION_PACKET_ID,
    }


def extract_stored_digest(proof: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Pull stored digest from a capability proof object (several shapes)."""
    if not isinstance(proof, Mapping):
        return None

    # Preferred nested envelope.
    nested = proof.get("proofInputDigest")
    if isinstance(nested, dict) and nested.get("overall"):
        fields = nested.get("fields") if isinstance(nested.get("fields"), dict) else {}
        return {
            "version": int(nested.get("version") or DIGEST_VERSION),
            "fields": canonicalize_fields(fields),
            "overall": str(nested["overall"]).strip().lower(),
            "boundProductSha": normalize_git_sha(nested.get("boundProductSha")),
        }

    # Flat schema fields (MIGRATION-LEDGER-SCHEMA-v3).
    overall = proof.get("proofInputDigest")
    if isinstance(overall, str) and overall.strip():
        fields = proof.get("proofInputDigestFields")
        return {
            "version": int(proof.get("proofInputDigestVersion") or DIGEST_VERSION),
            "fields": canonicalize_fields(fields if isinstance(fields, dict) else {}),
            "overall": overall.strip().lower(),
            "boundProductSha": normalize_git_sha(
                proof.get("proofInputDigestBoundSha") or proof.get("lastComparedMainSha")
            ),
        }

    # Legacy partial hashes (contract/behavior/fixture) → synthetic fields only
    # when at least one is present; overall recomputed for compare when caller
    # supplies the same material. Not treated as a full stored digest unless
    # proofInputDigest overall is set.
    return None


def digests_match(
    stored: Mapping[str, Any] | None,
    recomputed: Mapping[str, Any] | None,
) -> bool:
    """True when both present and overall digests equal (case-insensitive hex)."""
    if not isinstance(stored, Mapping) or not isinstance(recomputed, Mapping):
        return False
    a = str(stored.get("overall") or "").strip().lower()
    b = str(recomputed.get("overall") or "").strip().lower()
    if not a or not b:
        return False
    return a == b


def proof_has_stored_digest(proof: Mapping[str, Any] | None) -> bool:
    return extract_stored_digest(proof) is not None


def capability_blocked_by_digest(
    cap: Mapping[str, Any] | None,
    *,
    recomputed_fields: Mapping[str, Any] | None = None,
    require_digest: bool | None = None,
) -> tuple[bool, str]:
    """Whether a capability claim must be blocked by proof-input digest rules.

    Returns (blocked, reason).

    Rules (TICK029 + TICK031 adoption):
      - Caps that do not require digests (non-promoted, non-green) → never blocked.
      - Digest-required + no stored digest → blocked when require_digest
        (default True / DEFAULT_REQUIRE_DIGEST); stub_ok only if require_digest=False.
      - Digest-required + stored digest + recomputed_fields provided →
        blocked when overall mismatch.
      - Digest-required + stored digest + no recomputed material → not blocked
        on mismatch (cannot recompute); tip-binding stale-proof still applies.
      - Independent of fleetCompletionProgress (FCP=0 still blocks).
    """
    if require_digest is None:
        require_digest = DEFAULT_REQUIRE_DIGEST
    if not isinstance(cap, Mapping):
        return False, "not_a_capability"
    if not cap_requires_proof_input_digest(cap):
        return False, "digest_not_required_for_cap"

    proof = cap.get("proof") if isinstance(cap.get("proof"), dict) else None
    stored = extract_stored_digest(proof)
    if stored is None:
        if require_digest:
            state = str(cap.get("state") or "").strip()
            if state in AUTHORITY_STATES:
                return True, "authority_missing_proof_input_digest"
            if state in PROMOTED_STATES:
                return True, "promoted_missing_proof_input_digest"
            return True, "green_proof_missing_proof_input_digest"
        return False, "stub_ok_digest_absent"

    if recomputed_fields is None:
        # Stored digest present but no live material to recompute — do not
        # invent mismatch; tip-binding stale-proof still applies elsewhere.
        return False, "stored_digest_present_no_recompute"

    recomputed = compute_proof_input_digest(
        recomputed_fields,
        bound_product_sha=stored.get("boundProductSha"),
        version=int(stored.get("version") or DIGEST_VERSION),
    )
    if digests_match(stored, recomputed):
        return False, "digest_match"
    return True, "proof_input_digest_mismatch"


def authority_blocked_by_digest_mismatch(
    cap: Mapping[str, Any] | None,
    *,
    recomputed_fields: Mapping[str, Any] | None = None,
    require_digest: bool | None = None,
) -> tuple[bool, str]:
    """Backward-compatible wrapper; TICK031 uses capability_blocked_by_digest."""
    return capability_blocked_by_digest(
        cap,
        recomputed_fields=recomputed_fields,
        require_digest=require_digest,
    )


def is_authority_proof_digest_stale(
    cap: Mapping[str, Any] | None,
    *,
    recomputed_fields: Mapping[str, Any] | None = None,
    require_digest: bool | None = None,
) -> bool:
    blocked, _reason = capability_blocked_by_digest(
        cap,
        recomputed_fields=recomputed_fields,
        require_digest=require_digest,
    )
    return blocked


def is_proof_digest_stale(
    cap: Mapping[str, Any] | None,
    *,
    recomputed_fields: Mapping[str, Any] | None = None,
    require_digest: bool | None = None,
) -> bool:
    """TICK031 alias: any digest-required cap (promoted or green) stale check."""
    return is_authority_proof_digest_stale(
        cap,
        recomputed_fields=recomputed_fields,
        require_digest=require_digest,
    )


def scan_ledger_authority_digest_blocks(
    ledger: Mapping[str, Any] | None,
    *,
    recomputed_by_cap: Mapping[str, Mapping[str, Any]] | None = None,
    require_digest: bool | None = None,
) -> list[dict[str, Any]]:
    """List digest-required caps blocked by digest rules (even when FCP=0).

    TICK031: includes promoted + green-proof caps when require_digest defaults True.
    """
    if not isinstance(ledger, Mapping):
        return []
    recompute_map = recomputed_by_cap if isinstance(recomputed_by_cap, Mapping) else {}
    out: list[dict[str, Any]] = []
    for cap in ledger.get("capabilities") or []:
        if not isinstance(cap, Mapping):
            continue
        cid = cap.get("id")
        if not isinstance(cid, str):
            continue
        fields = recompute_map.get(cid)
        blocked, reason = capability_blocked_by_digest(
            cap,
            recomputed_fields=fields if isinstance(fields, Mapping) else None,
            require_digest=require_digest,
        )
        if blocked:
            status = None
            proof = cap.get("proof")
            if isinstance(proof, dict):
                status = proof.get("status")
            out.append(
                {
                    "id": cid,
                    "state": cap.get("state"),
                    "status": status,
                    "reason": reason,
                    "packetId": ADOPTION_PACKET_ID,
                }
            )
    return out


def scan_ledger_digest_blocks(
    ledger: Mapping[str, Any] | None,
    *,
    recomputed_by_cap: Mapping[str, Mapping[str, Any]] | None = None,
    require_digest: bool | None = None,
) -> list[dict[str, Any]]:
    """Alias for scan_ledger_authority_digest_blocks (TICK031 naming)."""
    return scan_ledger_authority_digest_blocks(
        ledger,
        recomputed_by_cap=recomputed_by_cap,
        require_digest=require_digest,
    )


def fields_from_capability_surfaces(
    cap: Mapping[str, Any] | None,
    *,
    proof: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Derive field material from ledger capability + proof metadata.

    Product-side helper and pilot adoption use this when full tree hashing is
    unavailable. Prefers recorded hashes (behaviorSpecHash, fixtureCorpusHash,
    contractHash, imageDigest) and path/glob strings (tsSurface, rustSurface,
    differentialTest, dependencyGlobs). Does not invent evidence.
    """
    if not isinstance(cap, Mapping):
        return {}
    pr = proof if isinstance(proof, Mapping) else (
        cap.get("proof") if isinstance(cap.get("proof"), dict) else {}
    )
    fields: dict[str, Any] = {}
    ts = cap.get("tsSurface")
    if isinstance(ts, str) and ts.strip():
        fields["tsClosure"] = ts.strip()
    rust = cap.get("rustSurface")
    if isinstance(rust, str) and rust.strip():
        fields["rustClosure"] = rust.strip()
    contract = pr.get("contractHash") if isinstance(pr, Mapping) else None
    if isinstance(contract, str) and contract.strip():
        fields["contracts"] = contract.strip()
    deps = pr.get("dependencyGlobs") if isinstance(pr, Mapping) else None
    if isinstance(deps, list) and deps:
        fields["deps"] = sorted(str(x) for x in deps if x is not None)
    elif isinstance(deps, str) and deps.strip():
        fields["deps"] = deps.strip()
    fixture = pr.get("fixtureCorpusHash") if isinstance(pr, Mapping) else None
    if isinstance(fixture, str) and fixture.strip():
        fields["fixtures"] = fixture.strip()
    harness = None
    if isinstance(pr, Mapping):
        harness = pr.get("behaviorSpecHash")
    if not harness:
        harness = cap.get("differentialTest") or cap.get("parityTest")
    if isinstance(harness, str) and harness.strip():
        fields["harness"] = harness.strip()
    deploy = None
    if isinstance(pr, Mapping):
        deploy = pr.get("imageDigest")
    if not deploy:
        deploy = cap.get("prodProbe")
    if isinstance(deploy, str) and deploy.strip():
        fields["deploySpecs"] = deploy.strip()
    return fields


def apply_digest_to_proof(
    proof: dict[str, Any],
    digest: Mapping[str, Any],
    *,
    flat: bool = True,
) -> dict[str, Any]:
    """Return a copy of proof with proofInputDigest fields stamped (TICK031)."""
    out = dict(proof)
    overall = str(digest.get("overall") or "").strip().lower()
    fields = digest.get("fields") if isinstance(digest.get("fields"), dict) else {}
    version = int(digest.get("version") or DIGEST_VERSION)
    bound = digest.get("boundProductSha")
    if flat:
        out["proofInputDigest"] = overall
        out["proofInputDigestFields"] = canonicalize_fields(fields)
        out["proofInputDigestVersion"] = version
        if bound:
            out["proofInputDigestBoundSha"] = bound
    else:
        out["proofInputDigest"] = {
            "version": version,
            "overall": overall,
            "fields": canonicalize_fields(fields),
            "boundProductSha": bound,
            "computedAt": digest.get("computedAt") or now_iso(),
            "packetId": ADOPTION_PACKET_ID,
        }
        out["proofInputDigestFields"] = canonicalize_fields(fields)
        out["proofInputDigestVersion"] = version
        if bound:
            out["proofInputDigestBoundSha"] = bound
    return out


def proof_schema_properties() -> dict[str, Any]:
    """JSON-Schema fragment for MIGRATION-LEDGER-SCHEMA-v3 proof properties."""
    field_props = {k: {"type": ["string", "null"]} for k in FIELD_ORDER}
    return {
        "proofInputDigest": {
            "description": (
                "Overall sha256 of canonical proof-input field digests "
                f"({PACKET_ID}/{ADOPTION_PACKET_ID}); required for promoted "
                "states and green proof statuses."
            ),
            "oneOf": [
                {"type": "string", "minLength": 64, "maxLength": 64},
                {
                    "type": "object",
                    "properties": {
                        "version": {"type": "integer"},
                        "overall": {"type": "string"},
                        "fields": {
                            "type": "object",
                            "properties": field_props,
                            "additionalProperties": True,
                        },
                        "boundProductSha": {"type": ["string", "null"]},
                        "computedAt": {"type": "string"},
                        "packetId": {"type": "string"},
                    },
                    "additionalProperties": True,
                },
            ],
        },
        "proofInputDigestFields": {
            "type": "object",
            "description": (
                f"Per-field behavioral-input digests ({PACKET_ID}/{ADOPTION_PACKET_ID})."
            ),
            "properties": field_props,
            "additionalProperties": True,
        },
        "proofInputDigestVersion": {
            "type": "integer",
            "description": f"Digest algorithm version (currently {DIGEST_VERSION}).",
        },
        "proofInputDigestBoundSha": {
            "type": "string",
            "description": "Product tip SHA the proof-input digest was bound to.",
        },
    }


def field_order() -> tuple[str, ...]:
    return FIELD_ORDER


def iter_missing_fields(fields: Mapping[str, Any] | None) -> Iterable[str]:
    canonical = canonicalize_fields(fields)
    for k, v in canonical.items():
        if v is None:
            yield k
