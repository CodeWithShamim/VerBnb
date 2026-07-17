"""Reproducible validation of the state-derived PRODUCT appeal flow.

Runs the REAL two-contract flow — NotAsDescribed (PRODUCT judge) and
AppealManager, including the manager's cross-contract
get_contract_at().view() read — inside the glsim engine that ships with the
pinned test dependency:

    genlayer-test[sim]==0.29.2        (see requirements.txt)

Everything executes in-process and deterministically: web pages and LLM
verdicts are served from strict mocks (any unmocked call fails the test), so
no Docker, no network, no LLM API keys, and no live GenLayer node are needed.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/pytest tests/sim/ -v

What is validated:
  * dispute -> verdict -> appeal -> resolve_appeal -> finalize_appeal_from_state,
    with the finalized record equal to the specialist's on-chain outcome;
  * every appeal result is BOUND TO ITS RECORDED ROUND: outcomes are stored
    per round, rounds are strictly monotonic, a round-2 appeal cannot be
    finalized from the stale round-1 outcome, and finalization before the
    specialist resolved that exact round reverts;
  * the arbitrary finalization path is GONE: the appeal manager exposes no
    method that accepts a caller-supplied verdict or refund.
"""

import json
from pathlib import Path

import pytest
from glsim.engine import SimEngine
from glsim.state import StateStore

CONTRACTS_DIR = Path(__file__).parent.parent.parent / "contracts"

LISTING_URL = "https://example.com/listing"
EVIDENCE_URL = "https://example.com/evidence"
LISTING_TEXT = "Listing: blue ceramic dinner set, 12 pieces, brand new"
EVIDENCE_TEXT = "Received: 8 pieces, three chipped, color is grey not blue"

GUEST = "0xaAaA000000000000000000000000000000000001"
HOST = "0xbBbB000000000000000000000000000000000002"


def _llm_verdict(refund: int, genuine: bool = True) -> str:
    return json.dumps(
        {
            "discrepancy_genuine": genuine,
            "severity": "MAJOR" if genuine else "MINOR",
            "issues_found": ["missing pieces", "chipped", "wrong color"] if genuine else [],
            "refund_percentage": refund,
            "reasoning": "deterministic mock verdict for reproducible validation",
        }
    )


@pytest.fixture
def engine():
    eng = SimEngine(StateStore())
    eng.activate()
    # Strict mode: any web/LLM call without a mock fails the test instead of
    # silently hitting the network — this is what makes the run reproducible.
    eng.vm._strict_mock_mode = True
    try:
        yield eng
    finally:
        eng.deactivate()


def _mock_round(engine, refund: int, genuine: bool = True) -> None:
    """(Re)install the strict mocks that answer this consensus round."""
    engine.vm.clear_mocks()
    engine.vm.mock_web(r"example\.com/listing", {"body": LISTING_TEXT})
    engine.vm.mock_web(r"example\.com/evidence", {"body": EVIDENCE_TEXT})
    engine.vm.mock_llm(r"impartial marketplace arbitrator", _llm_verdict(refund, genuine))


def _deploy_pair(engine):
    product_addr, _ = engine.deploy(str(CONTRACTS_DIR / "not_as_described.py"))
    appeals_addr, _ = engine.deploy(str(CONTRACTS_DIR / "appeal_manager.py"))
    return product_addr, appeals_addr


def _open_dispute_and_appeal(engine, product, appeals, dispute_id, refund=60):
    """Original consensus verdict + appeal bookkeeping; returns (appeal_id, verdict)."""
    import time

    _mock_round(engine, refund=refund)
    engine.call_method(product, "raise_dispute", [dispute_id, LISTING_URL, EVIDENCE_URL])
    verdict = json.loads(engine.call_method(product, "get_verdict", [dispute_id]))
    assert verdict["resolved"] is True

    appeal_id = engine.call_method(
        appeals,
        "create_appeal",
        [
            dispute_id,
            GUEST,
            int(time.time()),
            verdict["refund_percentage"],
            GUEST,
            HOST,
            "please re-review with a stricter panel",
            "",
        ],
    )
    return appeal_id, verdict


def test_round1_result_binds_to_recorded_round(engine):
    product, appeals = _deploy_pair(engine)
    appeal_id, verdict = _open_dispute_and_appeal(engine, product, appeals, "prod-1")
    assert verdict["refund_percentage"] == 60

    # Specialist re-runs consensus over its OWN stored evidence for round 1.
    _mock_round(engine, refund=85)
    outcome = json.loads(engine.call_method(product, "resolve_appeal", ["prod-1", 1]))
    assert outcome["round_no"] == 1
    assert outcome["tolerance"] == 10  # stricter than the original +/-15
    assert outcome["appeal_refund_pct"] == 85
    assert outcome["overturned"] is True

    # The outcome is retrievable ONLY under its recorded round.
    assert json.loads(
        engine.call_method(product, "get_appeal_outcome_for_round", ["prod-1", 1])
    ) == outcome
    assert (
        json.loads(
            engine.call_method(product, "get_appeal_outcome_for_round", ["prod-1", 2])
        )["resolved"]
        is False
    )

    # Manager finalizes by reading that round-bound state cross-contract.
    result = json.loads(
        engine.call_method(appeals, "finalize_appeal_from_state", [appeal_id, product])
    )
    assert result["consensus_round"] == 1
    assert result["source"] == "on_chain_consensus"
    assert result["new_refund_percentage"] == 85
    assert result["did_overturn_original"] is True

    record = json.loads(engine.call_method(appeals, "get_appeal", [appeal_id]))
    assert record["appeal_status"] == "FINALIZED"
    assert record["appeal_verdict"] == outcome["appeal_verdict"]
    assert record["appeal_refund_pct"] == outcome["appeal_refund_pct"]


def test_finalize_reverts_until_specialist_resolved_this_round(engine):
    product, appeals = _deploy_pair(engine)
    appeal_id, _ = _open_dispute_and_appeal(engine, product, appeals, "prod-2")

    with pytest.raises(Exception, match="no resolved appeal outcome for round 1"):
        engine.call_method(appeals, "finalize_appeal_from_state", [appeal_id, product])

    record = json.loads(engine.call_method(appeals, "get_appeal", [appeal_id]))
    assert record["appeal_status"] == "PENDING"


def test_round2_cannot_reuse_round1_outcome(engine):
    """The stale round-1 outcome can never finalize the round-2 appeal, and both
    rounds' outcomes stay separately retrievable once recorded."""
    import time

    product, appeals = _deploy_pair(engine)
    appeal_1, _ = _open_dispute_and_appeal(engine, product, appeals, "prod-3")

    _mock_round(engine, refund=85)
    engine.call_method(product, "resolve_appeal", ["prod-3", 1])
    engine.call_method(appeals, "finalize_appeal_from_state", [appeal_1, product])

    # Second appeal -> consensus round 2.
    appeal_2 = engine.call_method(
        appeals,
        "create_appeal",
        ["prod-3", HOST, int(time.time()), 85, GUEST, HOST, "host escalates", ""],
    )
    assert json.loads(engine.call_method(appeals, "get_appeal", [appeal_2]))[
        "new_consensus_round"
    ] == 2

    # Round 1's outcome exists — but it cannot finalize the round-2 appeal.
    with pytest.raises(Exception, match="no resolved appeal outcome for round 2"):
        engine.call_method(appeals, "finalize_appeal_from_state", [appeal_2, product])

    # After the specialist resolves round 2 (tighter tolerance), it can.
    _mock_round(engine, refund=70)
    outcome_2 = json.loads(engine.call_method(product, "resolve_appeal", ["prod-3", 2]))
    assert outcome_2["round_no"] == 2
    assert outcome_2["tolerance"] == 5  # tightened again vs round 1's 10

    result = json.loads(
        engine.call_method(appeals, "finalize_appeal_from_state", [appeal_2, product])
    )
    assert result["consensus_round"] == 2
    assert result["new_refund_percentage"] == 70

    # Both rounds remain on record, each under its own round.
    r1 = json.loads(engine.call_method(product, "get_appeal_outcome_for_round", ["prod-3", 1]))
    r2 = json.loads(engine.call_method(product, "get_appeal_outcome_for_round", ["prod-3", 2]))
    assert (r1["round_no"], r1["appeal_refund_pct"]) == (1, 85)
    assert (r2["round_no"], r2["appeal_refund_pct"]) == (2, 70)
    # The unqualified view reports the latest round.
    assert json.loads(engine.call_method(product, "get_appeal_outcome", ["prod-3"])) == r2


def test_resolve_appeal_rounds_are_strictly_monotonic(engine):
    product, appeals = _deploy_pair(engine)
    _open_dispute_and_appeal(engine, product, appeals, "prod-4")

    _mock_round(engine, refund=85)
    with pytest.raises(Exception, match="appeal round mismatch"):
        engine.call_method(product, "resolve_appeal", ["prod-4", 2])  # skip ahead
    with pytest.raises(Exception, match="appeal round mismatch"):
        engine.call_method(product, "resolve_appeal", ["prod-4", 0])

    engine.call_method(product, "resolve_appeal", ["prod-4", 1])
    with pytest.raises(Exception, match="appeal round mismatch"):
        engine.call_method(product, "resolve_appeal", ["prod-4", 1])  # re-run round 1


def test_no_arbitrary_finalization_path_exists(engine):
    """The appeal manager exposes no method that accepts a caller-supplied
    verdict/refund: outcomes can only enter via the specialist's round-bound
    on-chain state."""
    _, appeals = _deploy_pair(engine)
    instance = engine._instances[appeals.lower()]
    assert not hasattr(instance, "finalize_appeal")
    schema = engine.get_schema(appeals) or {}
    assert "finalize_appeal" not in (schema.get("methods") or {})
