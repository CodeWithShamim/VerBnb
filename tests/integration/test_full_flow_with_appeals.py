"""
Integration test for Verdix / VerBnb Phase 2 — full flow with appeals.

Run against a live GenLayer environment (local Studio or testnet Bradbury):

    # local Studio (Docker) — full GenVM, recommended:
    genlayer up
    gltest tests/integration/test_full_flow_with_appeals.py -v -s --network localnet

    # testnet Bradbury (needs a funded GENLAYER_PRIVATE_KEY in .env):
    gltest tests/integration/test_full_flow_with_appeals.py -v -s --network testnet_bradbury

The 4 new tracker contracts are STANDALONE and orchestrated off-chain (the
registry stores their addresses but does not call them synchronously — the
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
  7. Finalizes the appeal with a new verdict; asserts it overturns + records.
  8. Asserts all tracker state changed.
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

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

    # 7. Re-evaluate with the bigger panel and finalize, overturning the result.
    new_refund = 90 if original_refund != 90 else 20
    result = json.loads(
        appeals.finalize_appeal(args=[appeal_id, "REFUND_GRANTED", new_refund]).call()
    )
    assert tx_execution_succeeded(
        appeals.finalize_appeal(args=[appeal_id, "REFUND_GRANTED", new_refund]).transact()
    )
    assert result["did_overturn_original"] is True
    assert result["new_refund_percentage"] == new_refund

    # Record the appeal outcome in reputation.
    assert tx_execution_succeeded(
        reputation.record_appeal_outcome(args=[winner, True]).transact()
    )

    # 8. Assert appeal verdict overwrote the original + all state propagated.
    final_appeal = json.loads(appeals.get_appeal(args=[appeal_id]).call())
    assert final_appeal["appeal_status"] == "FINALIZED"
    assert final_appeal["appeal_refund_pct"] == new_refund
    assert final_appeal["original_refund_pct"] == original_refund

    rep_after = json.loads(reputation.get_reputation(args=[winner]).call())
    assert rep_after["appeal_filed"] == 1
    assert rep_after["appeal_won"] == 1

    stats = json.loads(registry.get_platform_stats().call())
    assert stats["total_resolved"] >= 1
