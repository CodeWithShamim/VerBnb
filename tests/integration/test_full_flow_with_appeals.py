"""
Integration test for Verdix / VerBnb Phase 2 - full flow with appeals.

Run against a live GenLayer environment (local Studio or testnet Bradbury):

    # local Studio (Docker) - full GenVM, recommended:
    genlayer up
    gltest tests/integration/test_full_flow_with_appeals.py -v -s --network localnet

    # testnet Bradbury (needs a funded GENLAYER_PRIVATE_KEY in .env):
    gltest tests/integration/test_full_flow_with_appeals.py -v -s --network testnet_bradbury

The 4 new tracker contracts are STANDALONE and orchestrated off-chain (the
registry stores their addresses but does not call them synchronously - the
GenLayer registry is deterministic-only and the direct/glsim harness has no
cross-contract call support). This test plays the role of that off-chain
orchestrator: it deploys all 9 contracts, drives one RENTAL dispute to a
verdict, feeds the outcome into the trackers, files an appeal, re-evaluates it
with MORE validators, finalizes it, and asserts every state change propagated.

This test:
  1. Deploys all 9 contracts (4 specialists + 4 trackers + registry).
  2. Registry is wired with the 4 tracker addresses (constructor + view).
  3. Raises a RENTAL dispute on the specialist (real consensus).
  4. Records the verdict into reputation_tracker, fraud_detector, analytics.
  5. Files an appeal in appeal_manager (within the 7-day window).
  6. Asserts the appeal uses MORE validators than the original round.
  7. Re-runs consensus on the specialist (resolve_appeal) and finalizes from
     that round-bound on-chain state (finalize_appeal_from_state).
  8. Asserts all tracker state changed.
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

CONTRACTS_DIR = Path(__file__).parent.parent.parent / "contracts"

LISTING_URL = "https://test-server.genlayer.com/static/genvm/hello.html"
EVIDENCE_URL = "https://test-server.genlayer.com/static/genvm/hello.html"

WAIT = {"wait_interval": 10000, "wait_retries": 30}

# Two parties to the dispute (guest = winner if refund granted, host = loser).
GUEST = "0xaAaA000000000000000000000000000000000001"
HOST = "0xbBbB000000000000000000000000000000000002"
VALIDATOR = "0xddDD000000000000000000000000000000000004"


def _factory(filename: str):
    return get_contract_factory(contract_file_path=CONTRACTS_DIR / filename)


def test_full_flow_with_appeals():
    # 1. Deploy specialists.
    listing = _factory("listing_accuracy_judge.py").deploy(args=[])
    product = _factory("not_as_described.py").deploy(args=[])
    sourcing = _factory("ethical_sourcing.py").deploy(args=[])
    delivery = _factory("delivery_adjudicator.py").deploy(args=[])

    # Deploy the 4 standalone trackers.
    appeals = _factory("appeal_manager.py").deploy(args=[])
    reputation = _factory("reputation_tracker.py").deploy(args=[])
    fraud = _factory("fraud_detector.py").deploy(args=[])
    analytics = _factory("analytics_tracker.py").deploy(args=[])

    # 2. Deploy the registry with all 8 dependency addresses.
    registry = _factory("verBnb_registry.py").deploy(
        args=[
            listing.address,
            product.address,
            sourcing.address,
            delivery.address,
            appeals.address,
            reputation.address,
            fraud.address,
            analytics.address,
        ]
    )

    ext = json.loads(registry.get_extension_addresses().call())
    assert ext["appeal_manager"] == appeals.address
    assert ext["reputation_tracker"] == reputation.address
    assert ext["fraud_detector"] == fraud.address
    assert ext["analytics_tracker"] == analytics.address

    # 3. Register + raise a RENTAL dispute, then resolve it.
    assert tx_execution_succeeded(
        registry.register_dispute(args=["rent-1", "RENTAL", listing.address]).transact()
    )
    assert tx_execution_succeeded(
        listing.raise_dispute(
            args=["rent-1", LISTING_URL, EVIDENCE_URL, 500000], **WAIT
        ).transact()
    )
    assert tx_execution_succeeded(registry.mark_resolved(args=["rent-1"]).transact())

    verdict = json.loads(listing.get_verdict(args=["rent-1"]).call())
    assert verdict["resolved"] is True
    original_refund = int(verdict["refund_percentage"])
    # Treat the guest as the winner when a refund was granted.
    guest_won = original_refund > 0
    winner, loser = (GUEST, HOST) if guest_won else (HOST, GUEST)
    now = int(datetime.now(timezone.utc).timestamp())

    # 4. Feed the verdict into the trackers (the off-chain orchestrator's job).
    assert tx_execution_succeeded(
        reputation.record_dispute_filed(args=[GUEST, "rent-1"]).transact()
    )
    assert tx_execution_succeeded(
        reputation.record_verdict(
            args=[winner, loser, "rent-1", verdict["verdict"]]
        ).transact()
    )
    assert tx_execution_succeeded(
        reputation.record_validator_round(args=[VALIDATOR, True]).transact()
    )
    assert tx_execution_succeeded(
        fraud.check_and_flag_patterns(args=[GUEST, "rent-1", guest_won, now]).transact()
    )
    assert tx_execution_succeeded(
        fraud.check_and_flag_patterns(args=[HOST, "rent-1", not guest_won, now]).transact()
    )
    verdict_str = "FAVORABLE" if original_refund > 0 else "UNFAVORABLE"
    assert tx_execution_succeeded(
        analytics.record_outcome(
            args=["rent-1", "RENTAL", verdict_str, original_refund, 3600, 0, "ocean view missing"]
        ).transact()
    )

    # Verify tracker state recorded.
    rep = json.loads(reputation.get_reputation(args=[winner]).call())
    assert rep["disputes_won"] == 1
    cat = json.loads(analytics.get_category_stats(args=["RENTAL"]).call())
    assert cat["total_disputes"] == 1

    # 5. File an appeal within the 7-day window. The contract assigns a
    #    deterministic id (<dispute>-appeal-<round>); the first round is 1.
    assert tx_execution_succeeded(
        appeals.create_appeal(
            args=[
                "rent-1",
                winner,  # appellant must be a party
                now,  # original verdict time (just now)
                original_refund,
                GUEST,
                HOST,
                "Validators misunderstood evidence",
                EVIDENCE_URL,
            ]
        ).transact()
    )
    appeal_id = "rent-1-appeal-1"

    appeal = json.loads(appeals.get_appeal(args=[appeal_id]).call())
    assert appeal["appeal_status"] == "PENDING"
    assert appeal["new_consensus_round"] == 1

    # 6. The appeal round must use MORE validators than the original (3).
    original_validators = 3
    appeal_validators = appeals.validators_for_round(args=[1]).call()
    assert appeal_validators > original_validators
    assert appeal["validators_this_round"] == appeal_validators

    # 7. Re-evaluate ON-CHAIN with the bigger panel: the specialist re-runs
    #    consensus over its own stored evidence (resolve_appeal) and the
    #    appeal manager finalizes from that ROUND-BOUND state — no verdict is
    #    ever supplied off-chain.
    assert tx_execution_succeeded(
        listing.resolve_appeal(args=["rent-1", 1], **WAIT).transact()
    )
    outcome = json.loads(
        listing.get_appeal_outcome_for_round(args=["rent-1", 1]).call()
    )
    assert outcome["resolved"] is True
    assert outcome["round_no"] == 1

    assert tx_execution_succeeded(
        appeals.finalize_appeal_from_state(
            args=[appeal_id, listing.address], **WAIT
        ).transact()
    )
    did_overturn = bool(outcome["overturned"])

    # Record the appeal outcome in reputation.
    assert tx_execution_succeeded(
        reputation.record_appeal_outcome(args=[winner, did_overturn]).transact()
    )

    # 8. Assert the appeal record carries the specialist's round-1 outcome.
    final_appeal = json.loads(appeals.get_appeal(args=[appeal_id]).call())
    assert final_appeal["appeal_status"] == "FINALIZED"
    assert final_appeal["appeal_verdict"] == outcome["appeal_verdict"]
    assert final_appeal["appeal_refund_pct"] == int(outcome["appeal_refund_pct"])
    assert final_appeal["original_refund_pct"] == original_refund

    rep_after = json.loads(reputation.get_reputation(args=[winner]).call())
    assert rep_after["appeal_filed"] == 1
    assert rep_after["appeal_won"] == (1 if did_overturn else 0)

    stats = json.loads(registry.get_platform_stats().call())
    assert stats["total_resolved"] >= 1


def test_on_chain_appeal_derived_from_authenticated_state():
    """The state-derived appeal path: the specialist re-runs consensus over its
    OWN stored evidence (resolve_appeal) and the appeal_manager finalizes by
    reading that outcome cross-contract (finalize_appeal_from_state). No verdict
    is ever supplied off-chain.

    Cross-contract calls only execute on live GenVM, so this runs under
    --network localnet / testnet_bradbury (not the single-contract direct harness).
    """
    product = _factory("not_as_described.py").deploy(args=[])
    appeals = _factory("appeal_manager.py").deploy(args=[])

    # 1. Original PRODUCT dispute → real consensus verdict on the specialist.
    assert tx_execution_succeeded(
        product.raise_dispute(
            args=["prod-9", LISTING_URL, EVIDENCE_URL], **WAIT
        ).transact()
    )
    verdict = json.loads(product.get_verdict(args=["prod-9"]).call())
    assert verdict["resolved"] is True
    original_refund = int(verdict["refund_percentage"])

    now = int(datetime.now(timezone.utc).timestamp())

    # 2. File the appeal (bookkeeping only).
    assert tx_execution_succeeded(
        appeals.create_appeal(
            args=[
                "prod-9",
                GUEST,
                now,
                original_refund,
                GUEST,
                HOST,
                "Please re-review with a stricter panel",
                EVIDENCE_URL,
            ]
        ).transact()
    )
    appeal_id = "prod-9-appeal-1"

    # 3. Specialist re-runs consensus over its authenticated stored evidence.
    assert tx_execution_succeeded(
        product.resolve_appeal(args=["prod-9", 1], **WAIT).transact()
    )
    outcome = json.loads(product.get_appeal_outcome(args=["prod-9"]).call())
    assert outcome["resolved"] is True
    assert outcome["round_no"] == 1
    assert outcome["tolerance"] == 10  # stricter than the original +/-15

    # The outcome is bound to its round: the round-1 record matches the latest
    # view, and no round-2 record exists yet.
    by_round = json.loads(
        product.get_appeal_outcome_for_round(args=["prod-9", 1]).call()
    )
    assert by_round == outcome
    assert (
        json.loads(product.get_appeal_outcome_for_round(args=["prod-9", 2]).call())[
            "resolved"
        ]
        is False
    )

    # 4. Appeal manager finalizes by READING the specialist outcome on-chain.
    #    The verdict/refund it records must equal the specialist's, not an arg.
    assert tx_execution_succeeded(
        appeals.finalize_appeal_from_state(
            args=[appeal_id, product.address], **WAIT
        ).transact()
    )
    final_appeal = json.loads(appeals.get_appeal(args=[appeal_id]).call())
    assert final_appeal["appeal_status"] == "FINALIZED"
    assert final_appeal["appeal_refund_pct"] == outcome["appeal_refund_pct"]
    assert final_appeal["appeal_verdict"] == outcome["appeal_verdict"]


# Every specialist judge must support the state-derived appeal path, not just
# PRODUCT (covered above). Each case: (contract file, raise method, raise args
# for a dispute id, expected round-1 appeal tolerance). DELIVERY consensus is
# an exact verdict match, so its tolerance is always 0.
SPECIALIST_APPEAL_CASES = [
    pytest.param(
        "listing_accuracy_judge.py",
        "raise_dispute",
        lambda did: [did, LISTING_URL, EVIDENCE_URL, 500000],
        10,
        id="rental",
    ),
    pytest.param(
        "ethical_sourcing.py",
        "validate_claim",
        lambda did: ["brand-itg", "fair trade certified", LISTING_URL, EVIDENCE_URL, did],
        10,
        id="sourcing",
    ),
    pytest.param(
        "delivery_adjudicator.py",
        "raise_dispute",
        lambda did: [did, "ORD-77", EVIDENCE_URL, "parcel never arrived", "1 Main St"],
        0,
        id="delivery",
    ),
]


@pytest.mark.parametrize("filename,method,args_for,expected_tolerance", SPECIALIST_APPEAL_CASES)
def test_on_chain_appeal_every_specialist(filename, method, args_for, expected_tolerance):
    """Same state-derived appeal flow as above, for the other 3 specialists:
    resolve_appeal re-runs consensus over the judge's own stored evidence and
    finalize_appeal_from_state reads the outcome back cross-contract."""
    dispute_id = f"itg-{filename.removesuffix('.py')}-1"
    specialist = _factory(filename).deploy(args=[])
    appeals = _factory("appeal_manager.py").deploy(args=[])

    # 1. Original dispute → real consensus verdict stored on the specialist.
    assert tx_execution_succeeded(
        getattr(specialist, method)(args=args_for(dispute_id), **WAIT).transact()
    )
    verdict = json.loads(specialist.get_verdict(args=[dispute_id]).call())
    assert verdict["resolved"] is True
    original_refund = int(verdict.get("refund_percentage", 0))

    now = int(datetime.now(timezone.utc).timestamp())

    # 2. File the appeal (bookkeeping only).
    assert tx_execution_succeeded(
        appeals.create_appeal(
            args=[
                dispute_id,
                GUEST,
                now,
                original_refund,
                GUEST,
                HOST,
                "Please re-review with a stricter panel",
                EVIDENCE_URL,
            ]
        ).transact()
    )
    appeal_id = f"{dispute_id}-appeal-1"

    # 3. Specialist re-runs consensus over its authenticated stored evidence.
    assert tx_execution_succeeded(
        specialist.resolve_appeal(args=[dispute_id, 1], **WAIT).transact()
    )
    outcome = json.loads(specialist.get_appeal_outcome(args=[dispute_id]).call())
    assert outcome["resolved"] is True
    assert outcome["round_no"] == 1
    assert outcome["tolerance"] == expected_tolerance

    # 4. Appeal manager finalizes by READING the specialist outcome on-chain.
    assert tx_execution_succeeded(
        appeals.finalize_appeal_from_state(
            args=[appeal_id, specialist.address], **WAIT
        ).transact()
    )
    final_appeal = json.loads(appeals.get_appeal(args=[appeal_id]).call())
    assert final_appeal["appeal_status"] == "FINALIZED"
    assert final_appeal["appeal_verdict"] == outcome["appeal_verdict"]
    assert final_appeal["appeal_refund_pct"] == int(outcome.get("appeal_refund_pct", 0))
