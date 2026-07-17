"""Direct-mode tests for appeal_manager.py (appeal + escalation).

Finalization is state-derived only (finalize_appeal_from_state); the direct
harness serves the specialist's round-bound outcome through the cross-contract
stub in specialist_stub.py. The real two-contract flow runs in
tests/sim/test_product_appeal_state_derived.py.
"""

import json
from datetime import datetime, timedelta, timezone

from .specialist_stub import (
    SPECIALIST_ADDRESS,
    install_specialist_stub,
    outcome_for,
)

CONTRACT = "contracts/appeal_manager.py"

PARTY_A = "0xaAaA000000000000000000000000000000000001"  # appellant
PARTY_B = "0xbBbB000000000000000000000000000000000002"  # counterparty
OUTSIDER = "0xcCcC000000000000000000000000000000000003"


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def _now_and_recent_verdict():
    """Return (now_iso, verdict_epoch) where the verdict was 1 hour ago."""
    now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    verdict_at = int((now - timedelta(hours=1)).timestamp())
    return now, verdict_at


def test_appeal_created_within_window(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))

    appeal_id = c.create_appeal(
        "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B,
        "Validators misunderstood evidence", "https://ipfs.io/new",
    )
    assert appeal_id == "rent-1-appeal-1"

    rec = json.loads(c.get_appeal(appeal_id))
    assert rec["appeal_status"] == "PENDING"
    assert rec["original_dispute_id"] == "rent-1"
    assert rec["new_consensus_round"] == 1
    assert rec["original_refund_pct"] == 40
    assert json.loads(c.get_stats())["total_appeals"] == 1


def test_appeal_rejected_after_7_days(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now = datetime(2026, 6, 10, 12, 0, 0, tzinfo=timezone.utc)
    # Verdict was 8 days ago - outside the window.
    verdict_at = int((now - timedelta(days=8)).timestamp())
    direct_vm.warp(_iso(now))
    with direct_vm.expect_revert("appeal window closed"):
        c.create_appeal(
            "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "too late", "",
        )


def test_appeal_requires_original_party(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))
    with direct_vm.expect_revert("not a party"):
        c.create_appeal(
            "rent-1", OUTSIDER, verdict_at, 40, PARTY_A, PARTY_B, "I want in", "",
        )


def test_new_consensus_round_uses_more_validators(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))

    appeal_id = c.create_appeal(
        "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "reason", "",
    )
    rec = json.loads(c.get_appeal(appeal_id))
    # Round 1 -> base 3 + 2 = 5 validators (vs original 3).
    assert rec["validators_this_round"] == 5
    assert c.validators_for_round(2) == 7
    assert c.validators_for_round(1) > 3


def test_appeal_verdict_overwrites_original(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))

    appeal_id = c.create_appeal(
        "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "reason", "",
    )
    install_specialist_stub(
        direct_vm,
        {("rent-1", 1): outcome_for("rent-1", 1, appeal_refund_pct=80, overturned=True)},
    )
    out = json.loads(c.finalize_appeal_from_state(appeal_id, SPECIALIST_ADDRESS))
    assert out["did_overturn_original"] is True
    assert out["new_refund_percentage"] == 80
    assert out["original_refund_percentage"] == 40
    assert out["consensus_round"] == 1
    assert out["source"] == "on_chain_consensus"

    rec = json.loads(c.get_appeal(appeal_id))
    assert rec["appeal_status"] == "FINALIZED"
    assert rec["appeal_verdict"] == "REFUND_GRANTED"
    assert rec["appeal_refund_pct"] == 80


def test_finalize_no_overturn_when_same_refund(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))
    appeal_id = c.create_appeal(
        "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "reason", "",
    )
    # No `overturned` flag from the specialist: the manager falls back to
    # comparing refunds, which are unchanged.
    install_specialist_stub(
        direct_vm, {("rent-1", 1): outcome_for("rent-1", 1, appeal_refund_pct=40)}
    )
    out = json.loads(c.finalize_appeal_from_state(appeal_id, SPECIALIST_ADDRESS))
    assert out["did_overturn_original"] is False


def test_finalize_requires_outcome_for_this_round(direct_vm, direct_deploy):
    """An appeal can only be finalized with the outcome RECORDED FOR ITS ROUND:
    no outcome for that round -> revert; an outcome stamped with a different
    round -> revert."""
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))
    appeal_id = c.create_appeal(
        "rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "reason", "",
    )

    # Specialist has not resolved round 1 at all.
    install_specialist_stub(direct_vm, {})
    with direct_vm.expect_revert("no resolved appeal outcome for round 1"):
        c.finalize_appeal_from_state(appeal_id, SPECIALIST_ADDRESS)

    # Specialist answers, but the outcome's round stamp is not this round.
    install_specialist_stub(
        direct_vm, {("rent-1", 1): outcome_for("rent-1", 2, appeal_refund_pct=80)}
    )
    with direct_vm.expect_revert("round mismatch"):
        c.finalize_appeal_from_state(appeal_id, SPECIALIST_ADDRESS)

    rec = json.loads(c.get_appeal(appeal_id))
    assert rec["appeal_status"] == "PENDING"


def test_multiple_appeals_on_same_dispute(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))

    a1 = c.create_appeal("rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "r1", "")
    # A second appeal cannot open while the first is still pending.
    with direct_vm.expect_revert("already pending"):
        c.create_appeal("rent-1", PARTY_B, verdict_at, 40, PARTY_A, PARTY_B, "r2", "")

    # After finalizing the first, a second round can open.
    outcomes = {("rent-1", 1): outcome_for("rent-1", 1, appeal_refund_pct=70)}
    install_specialist_stub(direct_vm, outcomes)
    c.finalize_appeal_from_state(a1, SPECIALIST_ADDRESS)
    a2 = c.create_appeal("rent-1", PARTY_B, verdict_at, 70, PARTY_A, PARTY_B, "r2", "")
    assert a2 == "rent-1-appeal-2"

    rec2 = json.loads(c.get_appeal(a2))
    assert rec2["new_consensus_round"] == 2
    assert rec2["validators_this_round"] == 7  # round 2 -> 3 + 2*2

    # The stale round-1 outcome cannot finalize the round-2 appeal.
    with direct_vm.expect_revert("no resolved appeal outcome for round 2"):
        c.finalize_appeal_from_state(a2, SPECIALIST_ADDRESS)

    # Once the specialist records round 2, finalization binds to it.
    outcomes[("rent-1", 2)] = outcome_for(
        "rent-1", 2, appeal_refund_pct=55, original_refund_pct=70
    )
    out = json.loads(c.finalize_appeal_from_state(a2, SPECIALIST_ADDRESS))
    assert out["consensus_round"] == 2
    assert out["new_refund_percentage"] == 55

    listing = json.loads(c.get_appeals_for_dispute("rent-1"))
    assert len(listing["appeals"]) == 2


def test_can_appeal_logic(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    now, verdict_at = _now_and_recent_verdict()
    direct_vm.warp(_iso(now))

    assert c.can_appeal("rent-1", PARTY_A, verdict_at, PARTY_A, PARTY_B) is True
    assert c.can_appeal("rent-1", OUTSIDER, verdict_at, PARTY_A, PARTY_B) is False

    # Out-of-window verdict.
    old = int((now - timedelta(days=9)).timestamp())
    assert c.can_appeal("rent-1", PARTY_A, old, PARTY_A, PARTY_B) is False

    # Once an appeal is open, can_appeal is False until it's finalized.
    c.create_appeal("rent-1", PARTY_A, verdict_at, 40, PARTY_A, PARTY_B, "r", "")
    assert c.can_appeal("rent-1", PARTY_A, verdict_at, PARTY_A, PARTY_B) is False


def test_finalize_unknown_reverts(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("unknown appeal"):
        c.finalize_appeal_from_state("nope", SPECIALIST_ADDRESS)


def test_legacy_arbitrary_finalize_removed(direct_vm, direct_deploy):
    """The owner-written finalize_appeal(verdict, refund) path no longer exists:
    outcomes can only enter through the specialist's round-bound state."""
    c = direct_deploy(CONTRACT)
    assert not hasattr(c, "finalize_appeal")


def test_get_appeal_not_found(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    assert json.loads(c.get_appeal("nope"))["error"] == "not_found"
