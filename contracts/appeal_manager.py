# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Appeal Manager (appeal + escalation system)

Lets a disputed party appeal a finalized verdict within a 7-day window. Each
appeal opens a fresh consensus round that the off-chain orchestrator re-runs
with MORE validators (N + 2) and a higher bar, then writes the outcome back
via finalize_appeal.

Deterministic only: this contract holds appeal bookkeeping. The original
dispute facts it needs for the 7-day window check (verdict time, the two
parties, the original refund %) are supplied by the caller at appeal time,
because the specialist verdicts live in separate standalone contracts that this
contract cannot read on-chain. The frontend/registry reads those verdicts and
passes them in.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

# Appeal window: 7 days in seconds.
APPEAL_WINDOW_SECONDS = 7 * 24 * 60 * 60  # 604800
# Each appeal round adds this many validators on top of the previous round.
EXTRA_VALIDATORS_PER_ROUND = 2
# Baseline validator count for the original (pre-appeal) round.
BASE_VALIDATORS = 3

STATUS_PENDING = "PENDING"
STATUS_ACCEPTED = "ACCEPTED"
STATUS_REJECTED = "REJECTED"
STATUS_FINALIZED = "FINALIZED"
VALID_STATUS = (STATUS_PENDING, STATUS_ACCEPTED, STATUS_REJECTED, STATUS_FINALIZED)


@allow_storage
@dataclass
class AppealRecord:
    appeal_id: str
    original_dispute_id: str
    appellant_address: str
    appeal_reason: str
    evidence_url: str
    appeal_submitted_at: u256
    appeal_verdict: str  # empty until resolved
    appeal_status: str  # PENDING | ACCEPTED | REJECTED | FINALIZED
    new_consensus_round: u8  # 1 = first appeal, 2 = second appeal, ...
    original_refund_pct: u8  # for comparison once resolved
    appeal_refund_pct: u8  # set on finalize


def _clamp_pct(value: object) -> int:
    """Coerce a value into an int in the range [0, 100]."""
    try:
        pct = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        return 0
    return max(0, min(100, pct))


def _validators_for_round(round_no: int) -> int:
    """Validator count for an appeal round: base + 2 per appeal round."""
    return BASE_VALIDATORS + EXTRA_VALIDATORS_PER_ROUND * max(1, round_no)


class AppealManager(gl.Contract):
    owner: str
    appeals: TreeMap[str, AppealRecord]
    # dispute_id -> the currently-open (non-finalized) appeal id, if any.
    active_appeals: TreeMap[str, str]
    # dispute_id -> every appeal id ever filed for it (supports multiple rounds).
    dispute_appeals: TreeMap[str, DynArray[str]]
    total_appeals: u256

    def __init__(self) -> None:
        self.owner = gl.message.sender_address.as_hex.lower()
        self.total_appeals = u256(0)

    # ---------------------------------------------------------------- helpers

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex.lower()

    def _only_owner(self) -> None:
        if self._sender() != self.owner:
            raise gl.vm.UserError("unauthorized: owner only")

    def _last_round_for(self, dispute_id: str) -> int:
        """Highest consensus round already filed for a dispute (0 if none)."""
        ids = self.dispute_appeals.get(dispute_id)
        if ids is None:
            return 0
        last = 0
        for aid in ids:
            rec = self.appeals.get(str(aid))
            if rec is not None and int(rec.new_consensus_round) > last:
                last = int(rec.new_consensus_round)
        return last

    def _within_window(self, original_verdict_at: int, now: int) -> bool:
        if original_verdict_at <= 0:
            return False
        return (now - original_verdict_at) <= APPEAL_WINDOW_SECONDS

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def create_appeal(
        self,
        original_dispute_id: str,
        appellant_address: str,
        original_verdict_at: u256,
        original_refund_pct: u8,
        party_a: str,
        party_b: str,
        reason: str,
        evidence_url_if_new: str,
    ) -> str:
        """Open a new appeal for a finalized verdict.

        original_verdict_at / original_refund_pct / party_a / party_b describe
        the verdict being appealed (supplied by the caller because the verdict
        lives in a separate specialist contract). Returns the new appeal_id.
        """
        if not original_dispute_id:
            raise gl.vm.UserError("missing original_dispute_id")

        # The verdict facts (timestamps, parties) are caller-supplied, so only
        # the orchestrator (owner) may file on someone's behalf; anyone else
        # must be filing as themselves.
        sender = self._sender()
        if sender != self.owner and sender != appellant_address.lower():
            raise gl.vm.UserError("unauthorized: sender is not the appellant")

        now = int(datetime.now(timezone.utc).timestamp())

        # Appeal window check.
        if not self._within_window(int(original_verdict_at), now):
            raise gl.vm.UserError("appeal window closed: more than 7 days since verdict")

        # Appellant must be one of the two original parties.
        appellant = appellant_address.lower()
        if appellant not in (party_a.lower(), party_b.lower()):
            raise gl.vm.UserError("appellant was not a party to the dispute")

        # No appeal may be open (non-finalized) on this dispute already.
        open_id = self.active_appeals.get(original_dispute_id)
        if open_id is not None and open_id != "":
            existing = self.appeals.get(open_id)
            if existing is not None and existing.appeal_status != STATUS_FINALIZED:
                raise gl.vm.UserError(f"an appeal is already pending: {open_id}")

        round_no = self._last_round_for(original_dispute_id) + 1
        appeal_id = f"{original_dispute_id}-appeal-{round_no}"

        self.appeals[appeal_id] = AppealRecord(
            appeal_id=appeal_id,
            original_dispute_id=original_dispute_id,
            appellant_address=appellant_address,
            appeal_reason=reason[:1000],
            evidence_url=evidence_url_if_new[:500],
            appeal_submitted_at=u256(now),
            appeal_verdict="",
            appeal_status=STATUS_PENDING,
            new_consensus_round=u8(min(255, round_no)),
            original_refund_pct=u8(_clamp_pct(int(original_refund_pct))),
            appeal_refund_pct=u8(0),
        )
        self.active_appeals[original_dispute_id] = appeal_id
        self.dispute_appeals.get_or_insert_default(original_dispute_id).append(appeal_id)
        self.total_appeals += u256(1)
        return appeal_id

    @gl.public.write
    def finalize_appeal(self, appeal_id: str, new_verdict: str, new_refund_pct: u8) -> str:
        """Record the re-evaluated verdict for an appeal.

        Sets appeal_verdict + status FINALIZED and returns a JSON object:
        {did_overturn_original, new_refund_percentage, original_refund_percentage}.
        Only the orchestrator (owner) may write outcomes.
        """
        self._only_owner()
        rec = self.appeals.get(appeal_id)
        if rec is None:
            raise gl.vm.UserError(f"unknown appeal: {appeal_id}")
        if rec.appeal_status == STATUS_FINALIZED:
            raise gl.vm.UserError("appeal already finalized")

        new_pct = _clamp_pct(int(new_refund_pct))
        original_pct = int(rec.original_refund_pct)
        # An appeal overturns the original when the refund materially changes.
        did_overturn = new_pct != original_pct

        rec.appeal_verdict = new_verdict[:1000]
        rec.appeal_refund_pct = u8(new_pct)
        rec.appeal_status = STATUS_FINALIZED
        # Clear the active marker so the dispute can be appealed again.
        self.active_appeals[rec.original_dispute_id] = ""

        return json.dumps(
            {
                "appeal_id": appeal_id,
                "did_overturn_original": did_overturn,
                "new_refund_percentage": new_pct,
                "original_refund_percentage": original_pct,
            }
        )

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_appeal(self, appeal_id: str) -> str:
        rec = self.appeals.get(appeal_id)
        if rec is None:
            return json.dumps({"error": "not_found", "appeal_id": appeal_id})
        return self._serialize(rec)

    @gl.public.view
    def can_appeal(
        self,
        dispute_id: str,
        user_address: str,
        original_verdict_at: u256,
        party_a: str,
        party_b: str,
    ) -> bool:
        """True if user was a party, within the 7-day window, and no open appeal."""
        now = int(datetime.now(timezone.utc).timestamp())
        if not self._within_window(int(original_verdict_at), now):
            return False
        user = user_address.lower()
        if user not in (party_a.lower(), party_b.lower()):
            return False
        open_id = self.active_appeals.get(dispute_id)
        if open_id is not None and open_id != "":
            existing = self.appeals.get(open_id)
            if existing is not None and existing.appeal_status != STATUS_FINALIZED:
                return False
        return True

    @gl.public.view
    def get_appeals_for_dispute(self, dispute_id: str) -> str:
        ids = self.dispute_appeals.get(dispute_id)
        records = []
        if ids is not None:
            for aid in ids:
                rec = self.appeals.get(str(aid))
                if rec is not None:
                    records.append(json.loads(self._serialize(rec)))
        return json.dumps({"dispute_id": dispute_id, "appeals": records})

    @gl.public.view
    def validators_for_round(self, round_no: int) -> int:
        """How many validators an appeal round uses (base 3, +2 per round)."""
        return _validators_for_round(int(round_no))

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({"total_appeals": int(self.total_appeals)})

    # ------------------------------------------------------------- internal

    def _serialize(self, rec: AppealRecord) -> str:
        return json.dumps(
            {
                "appeal_id": rec.appeal_id,
                "original_dispute_id": rec.original_dispute_id,
                "appellant_address": rec.appellant_address,
                "appeal_reason": rec.appeal_reason,
                "evidence_url": rec.evidence_url,
                "appeal_submitted_at": int(rec.appeal_submitted_at),
                "appeal_verdict": rec.appeal_verdict,
                "appeal_status": rec.appeal_status,
                "new_consensus_round": int(rec.new_consensus_round),
                "validators_this_round": _validators_for_round(int(rec.new_consensus_round)),
                "original_refund_pct": int(rec.original_refund_pct),
                "appeal_refund_pct": int(rec.appeal_refund_pct),
            }
        )
