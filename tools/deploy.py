#!/usr/bin/env python3
"""
Verdix / VerBnb - Bradbury testnet deploy script.

Deploys the 4 specialist contracts, then the registry (constructor args =
the 4 specialist addresses), verifies each schema, and writes all addresses to
deployments/bradbury.json.

Usage:
    # 1. Put a FUNDED Bradbury key in .env  (GENLAYER_PRIVATE_KEY=0x...)
    #    Faucet: https://testnet-faucet.genlayer.foundation
    # 2. Run:
    python tools/deploy.py
    #    or target another network:
    python tools/deploy.py --network localnet

Prereqs: pip install -r requirements.txt  (genlayer-py, python-dotenv, eth-account)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
import os

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.chains import testnet_bradbury, localnet, studionet
from genlayer_py.types import TransactionStatus

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
DEPLOYMENTS = ROOT / "deployments"

CHAINS = {
    "testnet_bradbury": testnet_bradbury,
    "localnet": localnet,
    "studionet": studionet,
}

# Deploy order matters: specialists first, registry last (needs their addresses).
SPECIALISTS = [
    ("listing_accuracy_judge", "listing_accuracy_judge.py"),
    ("not_as_described", "not_as_described.py"),
    ("ethical_sourcing", "ethical_sourcing.py"),
    ("delivery_adjudicator", "delivery_adjudicator.py"),
]
# Phase 2 extension trackers (standalone; orchestrated off-chain). Deployed
# before the registry so their addresses can be passed into its constructor.
EXTENSIONS = [
    ("appeal_manager", "appeal_manager.py"),
    ("reputation_tracker", "reputation_tracker.py"),
    ("fraud_detector", "fraud_detector.py"),
    ("analytics_tracker", "analytics_tracker.py"),
    # Standalone; not wired into the registry (which only tracks the 4 above).
    ("product_suggester", "product_suggester.py"),
]
REGISTRY = ("verBnb_registry", "verBnb_registry.py")


def _extract_address(receipt) -> str:
    if isinstance(receipt, dict):
        dec = receipt.get("tx_data_decoded") or receipt.get("txDataDecoded")
        if isinstance(dec, dict):
            for k in ("contractAddress", "contract_address"):
                if dec.get(k):
                    return dec[k]
        data = receipt.get("data")
        if isinstance(data, dict) and data.get("contract_address"):
            return data["contract_address"]
        # On Bradbury the deployed contract address is the tx recipient.
        if receipt.get("recipient"):
            return receipt["recipient"]
    raise ValueError(f"Could not find contract address in receipt: {receipt}")


def deploy_one(client, account, filename: str, args: list) -> str:
    code = (CONTRACTS / filename).read_bytes()
    print(f"  submitting {filename} ...", flush=True)
    tx_hash = client.deploy_contract(code=code, account=account, args=args)
    print(f"    tx={tx_hash}", flush=True)
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash,
        status=TransactionStatus.ACCEPTED,
        interval=8000,
        retries=45,
    )
    addr = _extract_address(receipt)
    print(f"  deployed {filename} -> {addr}", flush=True)
    return addr


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", default=os.getenv("GENLAYER_NETWORK", "testnet_bradbury"))
    parser.add_argument("--env", default=str(ROOT / ".env"))
    parser.add_argument(
        "--add-contracts",
        action="store_true",
        help=(
            "Deploy only the Phase 2 extension trackers and wire them into the "
            "registry already recorded in deployments/bradbury.json (via "
            "set_extension_addresses). Leaves the 5 existing contracts untouched."
        ),
    )
    args = parser.parse_args()

    load_dotenv(args.env, override=True)
    key = os.getenv("GENLAYER_PRIVATE_KEY")
    if not key or key.startswith("0x0000000000000000000000000000000000000000000000000000000000000001"):
        print("ERROR: set a REAL funded GENLAYER_PRIVATE_KEY in .env first.", file=sys.stderr)
        print("Faucet: https://testnet-faucet.genlayer.foundation", file=sys.stderr)
        return 1

    chain = CHAINS.get(args.network)
    if chain is None:
        print(f"ERROR: unknown network {args.network}. Options: {list(CHAINS)}", file=sys.stderr)
        return 1

    account = Account.from_key(key)
    client = create_client(chain=chain, account=account)
    print(f"Deploying Verdix to {args.network} as {account.address}")

    deployment_path = DEPLOYMENTS / "bradbury.json"
    addresses: dict[str, str] = {}
    if deployment_path.exists():
        try:
            addresses = json.loads(deployment_path.read_text()).get("contracts", {})
        except (json.JSONDecodeError, OSError):
            addresses = {}

    def persist():
        rpc = chain.rpc_urls["default"]["http"][0]
        out = {
            "network": args.network,
            "rpc": rpc,
            "chain_id": chain.id,
            "deployer": account.address,
            "contracts": addresses,
        }
        DEPLOYMENTS.mkdir(exist_ok=True)
        deployment_path.write_text(json.dumps(out, indent=2) + "\n")

    if args.add_contracts:
        registry_addr = addresses.get(REGISTRY[0])
        if not registry_addr:
            print(
                "ERROR: --add-contracts needs an existing registry in "
                "deployments/bradbury.json. Run a full deploy first.",
                file=sys.stderr,
            )
            return 1

        print("Deploying Phase 2 extension trackers...")
        for name, filename in EXTENSIONS:
            addresses[name] = deploy_one(client, account, filename, args=[])
            persist()

        print("Wiring extensions into the existing registry...")
        tx_hash = client.write_contract(
            address=registry_addr,
            function_name="set_extension_addresses",
            account=account,
            args=[
                addresses["appeal_manager"],
                addresses["reputation_tracker"],
                addresses["fraud_detector"],
                addresses["analytics_tracker"],
            ],
        )
        client.wait_for_transaction_receipt(
            transaction_hash=tx_hash, status=TransactionStatus.ACCEPTED, interval=8000, retries=45
        )
        print(f"  registry {registry_addr} updated with 4 extension addresses")
        persist()
        print(f"\nWrote {deployment_path} ({len(addresses)} contracts)")
        return 0

    print("Deploying specialist contracts...")
    for name, filename in SPECIALISTS:
        addresses[name] = deploy_one(client, account, filename, args=[])
        persist()  # incremental: survive a mid-run failure

    print("Deploying Phase 2 extension trackers...")
    for name, filename in EXTENSIONS:
        addresses[name] = deploy_one(client, account, filename, args=[])
        persist()

    print("Deploying registry...")
    # Registry now takes 8 args: 4 specialists + 4 extension trackers.
    registry_args = [
        addresses["listing_accuracy_judge"],
        addresses["not_as_described"],
        addresses["ethical_sourcing"],
        addresses["delivery_adjudicator"],
        addresses["appeal_manager"],
        addresses["reputation_tracker"],
        addresses["fraud_detector"],
        addresses["analytics_tracker"],
    ]
    addresses[REGISTRY[0]] = deploy_one(client, account, REGISTRY[1], args=registry_args)
    persist()

    print(f"\nWrote {deployment_path} ({len(addresses)} contracts)")
    print("\nRegistry address (frontend picks it up from deployments/bradbury.json):")
    print(f"  {addresses[REGISTRY[0]]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
