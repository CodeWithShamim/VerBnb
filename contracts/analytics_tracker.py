# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Analytics Tracker (outcome stats + insights)

Aggregates every finalized verdict into per-category statistics and a
platform-wide health summary. Validators can pull historical verdict
distributions (and keyword-similar past cases) to calibrate new judgments.

Deterministic only. record_outcome is called by the off-chain orchestrator
after a verdict finalizes, mirroring the existing mark_resolved lifecycle.

consensus_rate = first-round verdicts (0 appeals) / total disputes, per category.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

VALID_CATEGORIES = ("RENTAL", "PRODUCT", "SOURCING", "DELIVERY")
VERDICT_FAVORABLE = "FAVORABLE"
VERDICT_UNFAVORABLE = "UNFAVORABLE"

# Common words ignored when matching similar disputes.
_STOPWORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
        "was", "were", "is", "are", "not", "no", "my", "i", "it", "this", "that",
        "as", "at", "be", "by", "but", "had", "has",
    }
)


@allow_storage
@dataclass
class CategoryStats:
    category: str
    total_disputes: u32
    favorable_verdicts: u32
    unfavorable: u32
    avg_refund_pct: u8
    avg_resolution_time: u32  # seconds
    first_round_count: u32  # disputes resolved with 0 appeals
    consensus_rate: u8  # %
    last_updated: u256


@allow_storage
@dataclass
class DisputeOutcomeRecord:
    dispute_id: str
    category: str
    verdict: str  # FAVORABLE | UNFAVORABLE
    refund_percentage: u8
    resolution_time: u32  # seconds
    required_appeals: u8
    claim_snippet: str
    recorded_at: u256


def _clamp_pct(value: object) -> int:
    try:
        pct = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        return 0
    return max(0, min(100, pct))


def _tokens(text: str) -> set:
    out = set()
    for raw in text.lower().split():
        word = "".join(ch for ch in raw if ch.isalnum())
        if len(word) > 2 and word not in _STOPWORDS:
            out.add(word)
    return out


class AnalyticsTracker(gl.Contract):
    owner: str
    category_stats: TreeMap[str, CategoryStats]
    dispute_records: TreeMap[str, DisputeOutcomeRecord]
    # category -> ids, so similar-case search stays category-scoped.
    category_disputes: TreeMap[str, DynArray[str]]
    total_resolution_time: u256  # platform-wide sum, for global avg
    total_records: u256
    total_first_round: u256

    def __init__(self) -> None:
        self.owner = gl.message.sender_address.as_hex.lower()
        self.total_resolution_time = u256(0)
        self.total_records = u256(0)
        self.total_first_round = u256(0)

    # ---------------------------------------------------------------- helpers

    def _only_owner(self) -> None:
        if gl.message.sender_address.as_hex.lower() != self.owner:
            raise gl.vm.UserError("unauthorized: owner only")

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _norm_category(self, category: str) -> str:
        cat = category.upper()
        return cat if cat in VALID_CATEGORIES else ""

    def _get_or_create(self, category: str) -> CategoryStats:
        stats = self.category_stats.get(category)
        if stats is None:
            stats = CategoryStats(
                category=category,
                total_disputes=u32(0),
                favorable_verdicts=u32(0),
                unfavorable=u32(0),
                avg_refund_pct=u8(0),
                avg_resolution_time=u32(0),
                first_round_count=u32(0),
                consensus_rate=u8(0),
                last_updated=u256(0),
            )
            self.category_stats[category] = stats
        return self.category_stats[category]

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def record_outcome(
        self,
        dispute_id: str,
        category: str,
        verdict_string: str,
        refund_pct: u8,
        res_time: u32,
        appeals: u8,
        claim_snippet: str,
    ) -> None:
        self._only_owner()
        cat = self._norm_category(category)
        if cat == "":
            raise gl.vm.UserError(f"unknown category: {category}")
        if dispute_id in self.dispute_records:
            raise gl.vm.UserError(f"outcome already recorded: {dispute_id}")

        refund = _clamp_pct(int(refund_pct))
        # Verdict is FAVORABLE when any refund was granted.
        v = verdict_string.upper()
        if v not in (VERDICT_FAVORABLE, VERDICT_UNFAVORABLE):
            v = VERDICT_FAVORABLE if refund > 0 else VERDICT_UNFAVORABLE
        res = max(0, int(res_time))
        appeal_count = max(0, int(appeals))
        now = self._now()

        self.dispute_records[dispute_id] = DisputeOutcomeRecord(
            dispute_id=dispute_id,
            category=cat,
            verdict=v,
            refund_percentage=u8(refund),
            resolution_time=u32(min(res, 4_294_967_295)),
            required_appeals=u8(min(255, appeal_count)),
            claim_snippet=claim_snippet[:500],
            recorded_at=u256(now),
        )
        self.category_disputes.get_or_insert_default(cat).append(dispute_id)

        stats = self._get_or_create(cat)
        prev_total = int(stats.total_disputes)
        new_total = prev_total + 1

        # Rolling averages over the category's prior total.
        prev_avg_refund = int(stats.avg_refund_pct)
        new_avg_refund = (prev_avg_refund * prev_total + refund) // new_total

        prev_avg_time = int(stats.avg_resolution_time)
        new_avg_time = (prev_avg_time * prev_total + res) // new_total

        if v == VERDICT_FAVORABLE:
            stats.favorable_verdicts = u32(int(stats.favorable_verdicts) + 1)
        else:
            stats.unfavorable = u32(int(stats.unfavorable) + 1)

        if appeal_count == 0:
            stats.first_round_count = u32(int(stats.first_round_count) + 1)
            self.total_first_round += u256(1)

        stats.total_disputes = u32(new_total)
        stats.avg_refund_pct = u8(_clamp_pct(new_avg_refund))
        stats.avg_resolution_time = u32(min(new_avg_time, 4_294_967_295))
        stats.consensus_rate = u8(int(stats.first_round_count) * 100 // new_total)
        stats.last_updated = u256(now)

        self.total_resolution_time += u256(res)
        self.total_records += u256(1)

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_category_stats(self, category: str) -> str:
        cat = self._norm_category(category)
        stats = self.category_stats.get(cat) if cat else None
        if stats is None:
            return json.dumps(self._empty_category(category.upper()))
        return json.dumps(self._serialize_category(stats))

    @gl.public.view
    def get_all_stats(self) -> str:
        out = {}
        for cat in VALID_CATEGORIES:
            stats = self.category_stats.get(cat)
            out[cat] = (
                self._serialize_category(stats) if stats is not None else self._empty_category(cat)
            )
        return json.dumps(out)

    @gl.public.view
    def get_similar_disputes(self, category: str, claim_snippet: str) -> str:
        """Keyword-match past disputes in a category. Returns top 5 by overlap."""
        cat = self._norm_category(category)
        query = _tokens(claim_snippet)
        ids = self.category_disputes.get(cat) if cat else None
        scored = []
        if ids is not None and query:
            for did in ids:
                rec = self.dispute_records.get(str(did))
                if rec is None:
                    continue
                overlap = len(query & _tokens(rec.claim_snippet))
                if overlap > 0:
                    scored.append((overlap, rec))
        scored.sort(key=lambda s: s[0], reverse=True)
        results = []
        for overlap, rec in scored[:5]:
            results.append(
                {
                    "dispute_id": rec.dispute_id,
                    "verdict": rec.verdict,
                    "refund_percentage": int(rec.refund_percentage),
                    "required_appeals": int(rec.required_appeals),
                    "match_score": overlap,
                    "claim_snippet": rec.claim_snippet,
                }
            )
        return json.dumps(
            {"category": cat, "match_count": len(scored), "results": results}
        )

    @gl.public.view
    def get_platform_health(self) -> str:
        total = int(self.total_records)
        total_favorable = 0
        total_unfavorable = 0
        most_common_category = ""
        most_common_count = -1
        for cat in VALID_CATEGORIES:
            stats = self.category_stats.get(cat)
            if stats is None:
                continue
            total_favorable += int(stats.favorable_verdicts)
            total_unfavorable += int(stats.unfavorable)
            if int(stats.total_disputes) > most_common_count:
                most_common_count = int(stats.total_disputes)
                most_common_category = cat

        avg_time = (int(self.total_resolution_time) // total) if total > 0 else 0
        consensus = (int(self.total_first_round) * 100 // total) if total > 0 else 0
        return json.dumps(
            {
                "total_disputes_all_time": total,
                "total_resolved": total,
                "total_favorable": total_favorable,
                "total_unfavorable": total_unfavorable,
                "avg_resolution_time_all_categories": avg_time,
                "consensus_rate_overall": consensus,
                "most_common_category": most_common_category if most_common_count > 0 else "",
            }
        )

    # ------------------------------------------------------------- internal

    def _serialize_category(self, stats: CategoryStats) -> dict:
        return {
            "category": stats.category,
            "total_disputes": int(stats.total_disputes),
            "favorable_verdicts": int(stats.favorable_verdicts),
            "unfavorable": int(stats.unfavorable),
            "avg_refund_pct": int(stats.avg_refund_pct),
            "avg_resolution_time": int(stats.avg_resolution_time),
            "consensus_rate": int(stats.consensus_rate),
            "last_updated": int(stats.last_updated),
        }

    def _empty_category(self, category: str) -> dict:
        return {
            "category": category,
            "total_disputes": 0,
            "favorable_verdicts": 0,
            "unfavorable": 0,
            "avg_refund_pct": 0,
            "avg_resolution_time": 0,
            "consensus_rate": 0,
            "last_updated": 0,
        }
