# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - VerBnb Registry (master registry)

Single entry point the frontend connects to. Holds the four specialist
contract addresses, routes each dispute category to its contract, and tracks
every dispute raised across the platform. Deterministic only - all AI
adjudication happens in the specialist contracts.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

# Canonical category strings.
CATEGORY_RENTAL = "RENTAL"
CATEGORY_PRODUCT = "PRODUCT"
CATEGORY_SOURCING = "SOURCING"
CATEGORY_DELIVERY = "DELIVERY"
VALID_CATEGORIES = (CATEGORY_RENTAL, CATEGORY_PRODUCT, CATEGORY_SOURCING, CATEGORY_DELIVERY)


@allow_storage
@dataclass
class DisputeRecord:
    dispute_id: str
    category: str
    contract_address: str
    submitter: str
    timestamp: u256
    resolved: bool


class VerBnbRegistry(gl.Contract):
    listing_judge_address: str
    not_described_address: str
    sourcing_address: str
    delivery_address: str
    all_disputes: TreeMap[str, DisputeRecord]
    user_disputes: TreeMap[str, DynArray[str]]
    total_disputes: u256
    total_resolved: u256

    def __init__(
        self,
        listing_judge_address: str,
        not_described_address: str,
        sourcing_address: str,
        delivery_address: str,
    ) -> None:
        self.listing_judge_address = listing_judge_address
        self.not_described_address = not_described_address
        self.sourcing_address = sourcing_address
        self.delivery_address = delivery_address
        self.total_disputes = u256(0)
        self.total_resolved = u256(0)

    def _address_for_category(self, category: str) -> str:
        cat = category.upper()
        if cat == CATEGORY_RENTAL:
            return self.listing_judge_address
        if cat == CATEGORY_PRODUCT:
            return self.not_described_address
        if cat == CATEGORY_SOURCING:
            return self.sourcing_address
        if cat == CATEGORY_DELIVERY:
            return self.delivery_address
        return ""

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def register_dispute(self, dispute_id: str, category: str, contract_address: str) -> None:
        cat = category.upper()
        if cat not in VALID_CATEGORIES:
            raise gl.vm.UserError(f"unknown category: {category}")
        if dispute_id in self.all_disputes:
            raise gl.vm.UserError(f"dispute already registered: {dispute_id}")

        submitter = gl.message.sender_address.as_hex
        now = int(datetime.now(timezone.utc).timestamp())

        self.all_disputes[dispute_id] = DisputeRecord(
            dispute_id=dispute_id,
            category=cat,
            contract_address=contract_address,
            submitter=submitter,
            timestamp=u256(now),
            resolved=False,
        )
        self.user_disputes.get_or_insert_default(submitter).append(dispute_id)
        self.total_disputes += u256(1)

    @gl.public.write
    def mark_resolved(self, dispute_id: str) -> None:
        record = self.all_disputes.get(dispute_id)
        if record is None:
            raise gl.vm.UserError(f"unknown dispute: {dispute_id}")
        if record.resolved:
            return
        record.resolved = True
        self.total_resolved += u256(1)

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_contract_for_category(self, category: str) -> str:
        return self._address_for_category(category)

    @gl.public.view
    def get_platform_stats(self) -> str:
        total = int(self.total_disputes)
        resolved = int(self.total_resolved)
        rate = (resolved * 100 // total) if total > 0 else 0
        return json.dumps(
            {
                "total_disputes": total,
                "total_resolved": resolved,
                "resolution_rate": rate,
            }
        )

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        d = self.all_disputes.get(dispute_id)
        if d is None:
            return json.dumps({"error": "not_found", "dispute_id": dispute_id})
        return json.dumps(
            {
                "dispute_id": d.dispute_id,
                "category": d.category,
                "contract_address": d.contract_address,
                "submitter": d.submitter,
                "timestamp": int(d.timestamp),
                "resolved": d.resolved,
            }
        )

    @gl.public.view
    def get_user_disputes(self, user_address: str) -> str:
        ids = self.user_disputes.get(user_address)
        dispute_ids = [str(x) for x in ids] if ids is not None else []
        return json.dumps({"user_address": user_address, "dispute_ids": dispute_ids})

    @gl.public.view
    def get_addresses(self) -> str:
        return json.dumps(
            {
                "RENTAL": self.listing_judge_address,
                "PRODUCT": self.not_described_address,
                "SOURCING": self.sourcing_address,
                "DELIVERY": self.delivery_address,
            }
        )
