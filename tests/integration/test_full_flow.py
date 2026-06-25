"""
Integration test for Verdix / VerBnb — full end-to-end flow.

Run against a live GenLayer environment (local Studio or testnet Bradbury):

    # local Studio (Docker) — full GenVM, recommended:
    genlayer up
    gltest tests/integration/ -v -s --network localnet

    # testnet Bradbury (needs a funded GENLAYER_PRIVATE_KEY in .env):
    gltest tests/integration/ -v -s --network testnet_bradbury

NOTE ON GLSim: the lightweight `glsim` simulator (genlayer-test[sim]) runs the
runner natively rather than inside GenVM and currently mishandles contracts that
use `@allow_storage` dataclasses inside a `TreeMap` (it fails class storage
re-registration on deploy). The contract storage layout is verified instead by
the 34 direct-mode tests (which execute the *same* py-genlayer-std SDK in
process). Use Studio or testnet for true end-to-end consensus validation.

This test:
  1. Deploys all 4 specialist contracts.
  2. Deploys the registry with the 4 specialist addresses (constructor args).
  3. Registers a dispute for each category in the registry.
  4. Raises the matching dispute on each specialist contract (real consensus).
  5. Marks each dispute resolved in the registry.
  6. Re-discovers each specialist *through the registry* and fetches its verdict.
  7. Asserts resolution_rate > 0 in the platform stats.

Note: steps 4 run real LLM + web calls through validator consensus, so they
are slower and depend on the configured models. URLs below are public, stable
pages so leaders and validators fetch the same content.
"""

import json
from pathlib import Path

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

CONTRACTS_DIR = Path(__file__).parent.parent.parent / "contracts"

# Stable, publicly reachable evidence pages (same content for leader + validators).
LISTING_URL = "https://test-server.genlayer.com/static/genvm/hello.html"
EVIDENCE_URL = "https://test-server.genlayer.com/static/genvm/hello.html"

WAIT = {"wait_interval": 10000, "wait_retries": 30}


def _factory(filename: str):
    return get_contract_factory(contract_file_path=CONTRACTS_DIR / filename)


def test_full_flow():
    # 1. Deploy the four specialist contracts.
    listing = _factory("listing_accuracy_judge.py").deploy(args=[])
    product = _factory("not_as_described.py").deploy(args=[])
    sourcing = _factory("ethical_sourcing.py").deploy(args=[])
    delivery = _factory("delivery_adjudicator.py").deploy(args=[])

    # 2. Deploy the registry pointing at the four specialists.
    registry = _factory("verBnb_registry.py").deploy(
        args=[listing.address, product.address, sourcing.address, delivery.address]
    )

    # 3. Confirm routing resolves to the deployed addresses.
    assert registry.get_contract_for_category(args=["RENTAL"]).call() == listing.address
    assert registry.get_contract_for_category(args=["PRODUCT"]).call() == product.address
    assert registry.get_contract_for_category(args=["SOURCING"]).call() == sourcing.address
    assert registry.get_contract_for_category(args=["DELIVERY"]).call() == delivery.address

    # 4. Register + raise + resolve a dispute for each category.

    # RENTAL
    assert tx_execution_succeeded(
        registry.register_dispute(args=["rent-1", "RENTAL", listing.address]).transact()
    )
    assert tx_execution_succeeded(
        listing.raise_dispute(
            args=["rent-1", LISTING_URL, EVIDENCE_URL, 500000], **WAIT
        ).transact()
    )
    assert tx_execution_succeeded(registry.mark_resolved(args=["rent-1"]).transact())

    # PRODUCT
    assert tx_execution_succeeded(
        registry.register_dispute(args=["prod-1", "PRODUCT", product.address]).transact()
    )
    assert tx_execution_succeeded(
        product.raise_dispute(args=["prod-1", LISTING_URL, EVIDENCE_URL], **WAIT).transact()
    )
    assert tx_execution_succeeded(registry.mark_resolved(args=["prod-1"]).transact())

    # SOURCING
    assert tx_execution_succeeded(
        registry.register_dispute(args=["src-1", "SOURCING", sourcing.address]).transact()
    )
    assert tx_execution_succeeded(
        sourcing.validate_claim(
            args=["brandco", "ethically sourced", LISTING_URL, EVIDENCE_URL], **WAIT
        ).transact()
    )
    assert tx_execution_succeeded(registry.mark_resolved(args=["src-1"]).transact())

    # DELIVERY
    assert tx_execution_succeeded(
        registry.register_dispute(args=["del-1", "DELIVERY", delivery.address]).transact()
    )
    assert tx_execution_succeeded(
        delivery.raise_dispute(
            args=["del-1", "ORD-1", EVIDENCE_URL, "Never arrived", "742 Evergreen Terrace"],
            **WAIT,
        ).transact()
    )
    assert tx_execution_succeeded(registry.mark_resolved(args=["del-1"]).transact())

    # 5. Re-discover each specialist THROUGH the registry and fetch its verdict.
    rental_addr = registry.get_contract_for_category(args=["RENTAL"]).call()
    rental_contract = _factory("listing_accuracy_judge.py").build_contract(
        contract_address=rental_addr
    )
    rental_verdict = json.loads(rental_contract.get_verdict(args=["rent-1"]).call())
    assert rental_verdict["resolved"] is True
    assert 0 <= rental_verdict["refund_percentage"] <= 100

    delivery_verdict = json.loads(delivery.get_verdict(args=["del-1"]).call())
    assert delivery_verdict["resolved"] is True
    assert delivery_verdict["verdict"] in (
        "DELIVERED",
        "NOT_DELIVERED",
        "WRONG_ADDRESS",
        "INSUFFICIENT_EVIDENCE",
    )

    # 6. Platform stats must show resolutions.
    stats = json.loads(registry.get_platform_stats().call())
    assert stats["total_disputes"] == 4
    assert stats["total_resolved"] == 4
    assert stats["resolution_rate"] > 0
