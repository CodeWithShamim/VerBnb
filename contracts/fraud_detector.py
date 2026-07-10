# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Fraud Detector (pattern detection + fraud alerts)

Watches each address's dispute history for patterns that suggest gaming the
platform:
  - REPEAT_DISPUTANT : an address in 5+ disputes
  - SKEWED_VERDICTS  : every verdict lands the same way (all favorable / all
                       unfavorable) across enough disputes to look engineered
  - RAPID_CYCLING    : 10+ disputes inside a 30-day window

Deterministic only. The off-chain orchestrator calls check_and_flag_patterns
after every new dispute is registered, passing the dispute id, whether the
verdict was favorable to the address, and the timestamp - the contract
accumulates the history itself and raises flags by confidence:
    confidence < 40 -> no flag
    40-70           -> LOW
    70-85           -> MEDIUM
    > 85            -> HIGH
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

REPEAT_THRESHOLD = 5  # disputes -> REPEAT_DISPUTANT candidate
RAPID_THRESHOLD = 10  # disputes within RAPID_WINDOW -> RAPID_CYCLING candidate
RAPID_WINDOW_SECONDS = 30 * 24 * 60 * 60  # 30 days
SKEW_MIN_DISPUTES = 4  # need at least this many one-directional verdicts to flag

SEVERITY_LOW = "LOW"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_HIGH = "HIGH"

FLAG_REPEAT = "REPEAT_DISPUTANT"
FLAG_SKEWED = "SKEWED_VERDICTS"
FLAG_RAPID = "RAPID_CYCLING"


@allow_storage
@dataclass
class FraudFlag:
    flag_id: str
    flagged_address: str
    flag_type: str
    severity: str
    confidence: u8  # 0-100
    evidence: str  # JSON description
    flag_created_at: u256
    resolved: bool


@allow_storage
@dataclass
class PatternRecord:
    address: str
    dispute_count: u32
    favorable_count: u32
    unfavorable_count: u32


def _severity_for(confidence: int) -> str:
    """Map a confidence score to a severity, or '' for no flag."""
    if confidence < 40:
        return ""
    if confidence <= 70:
        return SEVERITY_LOW
    if confidence <= 85:
        return SEVERITY_MEDIUM
    return SEVERITY_HIGH


class FraudDetector(gl.Contract):
    owner: str
    fraud_flags: TreeMap[str, FraudFlag]
    pattern_history: TreeMap[str, PatternRecord]
    # address -> dispute timestamps (drives the rapid-cycling window check).
    pattern_timestamps: TreeMap[str, DynArray[u256]]
    # address -> ids of flags raised on it.
    address_flags: TreeMap[str, DynArray[str]]
    total_flags: u256

    def __init__(self) -> None:
        self.owner = gl.message.sender_address.as_hex.lower()
        self.total_flags = u256(0)

    # ---------------------------------------------------------------- helpers

    def _only_owner(self) -> None:
        if gl.message.sender_address.as_hex.lower() != self.owner:
            raise gl.vm.UserError("unauthorized: owner only")

    def _key(self, address: str) -> str:
        return address.lower()

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _get_or_create(self, address: str) -> PatternRecord:
        key = self._key(address)
        rec = self.pattern_history.get(key)
        if rec is None:
            rec = PatternRecord(
                address=address,
                dispute_count=u32(0),
                favorable_count=u32(0),
                unfavorable_count=u32(0),
            )
            self.pattern_history[key] = rec
        return self.pattern_history[key]

    def _disputes_in_window(self, address: str, now: int) -> int:
        cutoff = now - RAPID_WINDOW_SECONDS
        timestamps = self.pattern_timestamps.get(self._key(address))
        if timestamps is None:
            return 0
        count = 0
        for ts in timestamps:
            if int(ts) >= cutoff:
                count += 1
        return count

    def _assess(self, address: str, rec: PatternRecord, now: int) -> tuple[str, int, str]:
        """Pick the strongest pattern. Returns (flag_type, confidence, evidence_json)."""
        total = int(rec.dispute_count)
        favorable = int(rec.favorable_count)
        unfavorable = int(rec.unfavorable_count)
        in_window = self._disputes_in_window(address, now)

        candidates: list[tuple[str, int, str]] = []

        # RAPID_CYCLING: many disputes in a short window.
        if in_window >= RAPID_THRESHOLD:
            # 10 in window -> 72 (MEDIUM), reaching HIGH (>85) at ~14.
            conf = min(100, 72 + (in_window - RAPID_THRESHOLD) * 4)
            candidates.append(
                (
                    FLAG_RAPID,
                    conf,
                    json.dumps({"disputes_in_30d": in_window, "threshold": RAPID_THRESHOLD}),
                )
            )

        # SKEWED_VERDICTS: every decided verdict goes one way.
        decided = favorable + unfavorable
        if decided >= SKEW_MIN_DISPUTES and (favorable == 0 or unfavorable == 0):
            direction = "all_favorable" if unfavorable == 0 else "all_unfavorable"
            # 4 one-sided -> 70, climbing with sample size.
            conf = min(100, 55 + decided * 5)
            candidates.append(
                (
                    FLAG_SKEWED,
                    conf,
                    json.dumps(
                        {
                            "direction": direction,
                            "favorable": favorable,
                            "unfavorable": unfavorable,
                            "decided": decided,
                        }
                    ),
                )
            )

        # REPEAT_DISPUTANT: a lot of disputes overall.
        if total >= REPEAT_THRESHOLD:
            # 5 disputes -> 45 (LOW), rising 5/dispute.
            conf = min(100, 25 + total * 4)
            candidates.append(
                (
                    FLAG_REPEAT,
                    conf,
                    json.dumps({"total_disputes": total, "threshold": REPEAT_THRESHOLD}),
                )
            )

        if not candidates:
            return ("", 0, "")
        # Strongest signal wins.
        candidates.sort(key=lambda c: c[1], reverse=True)
        return candidates[0]

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def check_and_flag_patterns(
        self,
        address: str,
        new_dispute_id: str,
        verdict_favorable: bool,
        timestamp: u256,
    ) -> str:
        """Record a new dispute for an address and raise a flag if warranted.

        Returns a JSON object: {flagged: bool, flag_type, severity, confidence,
        flag_id}. flagged is False when confidence < 40.
        """
        self._only_owner()
        rec = self._get_or_create(address)
        ts = int(timestamp) if int(timestamp) > 0 else self._now()

        rec.dispute_count = u32(int(rec.dispute_count) + 1)
        if verdict_favorable:
            rec.favorable_count = u32(int(rec.favorable_count) + 1)
        else:
            rec.unfavorable_count = u32(int(rec.unfavorable_count) + 1)
        self.pattern_timestamps.get_or_insert_default(self._key(address)).append(u256(ts))

        flag_type, confidence, evidence = self._assess(address, rec, ts)
        severity = _severity_for(confidence)
        if severity == "":
            return json.dumps(
                {
                    "flagged": False,
                    "flag_type": flag_type,
                    "severity": "",
                    "confidence": confidence,
                    "flag_id": "",
                }
            )

        flag_id = f"{self._key(address)}-{flag_type}-{int(rec.dispute_count)}"
        self.fraud_flags[flag_id] = FraudFlag(
            flag_id=flag_id,
            flagged_address=address,
            flag_type=flag_type,
            severity=severity,
            confidence=u8(confidence),
            evidence=evidence,
            flag_created_at=u256(ts),
            resolved=False,
        )
        self.address_flags.get_or_insert_default(self._key(address)).append(flag_id)
        self.total_flags += u256(1)

        return json.dumps(
            {
                "flagged": True,
                "flag_type": flag_type,
                "severity": severity,
                "confidence": confidence,
                "flag_id": flag_id,
            }
        )

    @gl.public.write
    def resolve_flag(self, flag_id: str) -> None:
        """Mark a flag resolved (e.g. after manual review cleared the address)."""
        self._only_owner()
        flag = self.fraud_flags.get(flag_id)
        if flag is None:
            raise gl.vm.UserError(f"unknown flag: {flag_id}")
        flag.resolved = True

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_fraud_flags(self, address: str) -> str:
        ids = self.address_flags.get(self._key(address))
        flags = []
        if ids is not None:
            for fid in ids:
                flag = self.fraud_flags.get(str(fid))
                if flag is not None and not flag.resolved:
                    flags.append(self._serialize(flag))
        return json.dumps({"address": address, "flags": flags})

    @gl.public.view
    def get_flag_details(self, flag_id: str) -> str:
        flag = self.fraud_flags.get(flag_id)
        if flag is None:
            return json.dumps({"error": "not_found", "flag_id": flag_id})
        return json.dumps(self._serialize(flag))

    @gl.public.view
    def has_high_severity_flag(self, address: str) -> bool:
        ids = self.address_flags.get(self._key(address))
        if ids is None:
            return False
        for fid in ids:
            flag = self.fraud_flags.get(str(fid))
            if flag is not None and not flag.resolved and flag.severity == SEVERITY_HIGH:
                return True
        return False

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({"total_flags": int(self.total_flags)})

    # ------------------------------------------------------------- internal

    def _serialize(self, flag: FraudFlag) -> dict:
        return {
            "flag_id": flag.flag_id,
            "flagged_address": flag.flagged_address,
            "flag_type": flag.flag_type,
            "severity": flag.severity,
            "confidence": int(flag.confidence),
            "evidence": json.loads(flag.evidence) if flag.evidence else {},
            "flag_created_at": int(flag.flag_created_at),
            "resolved": flag.resolved,
        }
