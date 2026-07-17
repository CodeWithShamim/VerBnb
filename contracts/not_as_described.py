# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Not As Described (PRODUCT / marketplace disputes)

Arbitrates product disputes where the received item differs from the listing.
Works for eBay, AliExpress, and local marketplaces. Validators independently
fetch the seller listing and the buyer's evidence, ask an LLM for a verdict,
and agree when their refund recommendations are within +/- 15.
"""

import json
from dataclasses import dataclass

from genlayer import *

MAX_PAGE_CHARS = 2000
REFUND_TOLERANCE = 15
# An appeal re-runs consensus with a TIGHTER equivalence bar each round, so the
# validator set must agree more closely than in the original round. Round 1
# allows +/-10, round 2 +/-5, and it floors at +/-5 thereafter.
APPEAL_MIN_TOLERANCE = 5
APPEAL_TOLERANCE_STEP = 5

VALID_SEVERITY = ("MINOR", "MODERATE", "MAJOR", "COUNTERFEIT")


def _appeal_tolerance(round_no: int) -> int:
    """Stricter refund-agreement bar for appeal round `round_no` (1-indexed)."""
    r = max(1, int(round_no))
    return max(APPEAL_MIN_TOLERANCE, REFUND_TOLERANCE - APPEAL_TOLERANCE_STEP * r)


def _outcome_key(dispute_id: str, round_no: int) -> str:
    """Storage key binding an appeal outcome to its consensus round."""
    return f"{dispute_id}#r{int(round_no)}"


@allow_storage
@dataclass
class ProductDispute:
    dispute_id: str
    seller_listing_url: str
    buyer_evidence_url: str
    verdict: str
    refund_percentage: u8
    resolved: bool
    submitter: str


@allow_storage
@dataclass
class AppealOutcome:
    """The re-evaluated verdict for a dispute, produced ON-CHAIN by re-running
    validator consensus over this contract's own authenticated evidence (the
    stored listing/evidence URLs) — never supplied by an off-chain caller."""

    dispute_id: str
    round_no: u8
    tolerance: u8
    original_verdict: str
    original_refund_pct: u8
    appeal_verdict: str
    appeal_refund_pct: u8
    overturned: bool
    resolved: bool


def _clamp_percentage(value: object) -> int:
    try:
        pct = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"LLM_ERROR: non-numeric refund_percentage: {value!r}")
    return max(0, min(100, pct))


def _fetch(url: str) -> str:
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception as e:
        raise gl.vm.UserError(f"EXTERNAL: failed to fetch {url}: {e}")
    if not content:
        raise gl.vm.UserError(f"EXTERNAL: empty content from {url}")
    return content[:MAX_PAGE_CHARS]


def _build_prompt(listing_text: str, evidence_text: str) -> str:
    return f"""You are an impartial marketplace arbitrator. A buyer claims the product
they received is not as described in the seller's listing.

SELLER LISTING (what was advertised):
<listing>
{listing_text}
</listing>

BUYER EVIDENCE (what the buyer received / documented):
<evidence>
{evidence_text}
</evidence>

Decide, strictly from the text above, whether there is a genuine discrepancy
and what refund is fair. A wrong, broken, or counterfeit item warrants a high
refund; trivial cosmetic differences warrant little or none.

Respond with ONLY a JSON object, no markdown, no prose, exactly these keys:
{{
  "discrepancy_genuine": true or false,
  "severity": one of "MINOR", "MODERATE", "MAJOR", "COUNTERFEIT",
  "issues_found": array of short strings,
  "refund_percentage": integer 0 to 100,
  "reasoning": short string
}}
Output must be parseable by a strict JSON parser with no surrounding text."""


def _evaluate(listing_url: str, evidence_url: str) -> dict:
    listing_text = _fetch(listing_url)
    evidence_text = _fetch(evidence_url)

    result = gl.nondet.exec_prompt(
        _build_prompt(listing_text, evidence_text),
        response_format="json",
    )

    if not isinstance(result, dict):
        raise gl.vm.UserError(f"LLM_ERROR: expected JSON object, got {type(result).__name__}")

    if "refund_percentage" not in result or "discrepancy_genuine" not in result:
        raise gl.vm.UserError(f"LLM_ERROR: missing required fields, got keys {list(result.keys())}")

    severity = str(result.get("severity", "MODERATE")).upper()
    if severity not in VALID_SEVERITY:
        severity = "MODERATE"

    issues = result.get("issues_found", [])
    if not isinstance(issues, list):
        issues = [str(issues)]

    return {
        "discrepancy_genuine": bool(result.get("discrepancy_genuine")),
        "severity": severity,
        "issues_found": [str(i) for i in issues][:10],
        "refund_percentage": _clamp_percentage(result.get("refund_percentage")),
        "reasoning": str(result.get("reasoning", ""))[:1000],
    }


class NotAsDescribed(gl.Contract):
    disputes: TreeMap[str, ProductDispute]
    # Keyed by "<dispute_id>#r<round>" so every round's outcome is kept and an
    # outcome can only ever be read back for the round it was recorded for.
    appeal_outcomes: TreeMap[str, AppealOutcome]
    # dispute_id -> highest appeal round resolved so far (rounds are monotonic).
    latest_appeal_round: TreeMap[str, u8]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def raise_dispute(
        self,
        dispute_id: str,
        seller_listing_url: str,
        buyer_evidence_url: str,
    ) -> None:
        if dispute_id in self.disputes and self.disputes[dispute_id].resolved:
            raise gl.vm.UserError("dispute already resolved")

        submitter = gl.message.sender_address.as_hex.lower()

        def leader_fn() -> dict:
            return _evaluate(seller_listing_url, buyer_evidence_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(seller_listing_url, buyer_evidence_url)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "refund_percentage" not in leader:
                return False
            return abs(own["refund_percentage"] - int(leader["refund_percentage"])) <= REFUND_TOLERANCE

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        refund = _clamp_percentage(result["refund_percentage"])
        verdict = "REFUND_GRANTED" if result["discrepancy_genuine"] else "DISPUTE_REJECTED"

        self.disputes[dispute_id] = ProductDispute(
            dispute_id=dispute_id,
            seller_listing_url=seller_listing_url,
            buyer_evidence_url=buyer_evidence_url,
            verdict=verdict,
            refund_percentage=u8(refund),
            resolved=True,
            submitter=submitter,
        )

    @gl.public.write
    def resolve_appeal(self, dispute_id: str, round_no: int) -> str:
        """Re-run validator consensus for an appeal, ON-CHAIN.

        Unlike the original flow, nothing here is caller-supplied: the evidence
        re-evaluated is read from this contract's own authenticated storage (the
        listing + evidence URLs recorded when the dispute was first resolved),
        and the new verdict is produced by a fresh `gl.vm.run_nondet` round with
        a stricter equivalence bar. The result is persisted as an AppealOutcome
        that the appeal_manager reads back via get_contract_at().view() when it
        finalizes — so the appeal verdict is derived from authenticated contract
        state, not trusted from an off-chain orchestrator.

        Rounds are strictly monotonic: round_no must be exactly one past the
        last resolved round, and each round's outcome is stored under its own
        round-bound key, so a past round can never be re-run or overwritten.
        """
        d = self.disputes.get(dispute_id)
        if d is None or not d.resolved:
            raise gl.vm.UserError(f"no resolved dispute to appeal: {dispute_id}")

        prev = self.latest_appeal_round.get(dispute_id)
        last_round = int(prev) if prev is not None else 0
        round_no = int(round_no)
        if round_no != last_round + 1:
            raise gl.vm.UserError(
                f"appeal round mismatch: next round for {dispute_id} is "
                f"{last_round + 1}, got {round_no}"
            )

        # Authenticated original facts (from storage, not the caller).
        listing_url = d.seller_listing_url
        evidence_url = d.buyer_evidence_url
        original_verdict = d.verdict
        original_refund = int(d.refund_percentage)

        tolerance = _appeal_tolerance(round_no)

        def leader_fn() -> dict:
            return _evaluate(listing_url, evidence_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(listing_url, evidence_url)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "refund_percentage" not in leader:
                return False
            return abs(own["refund_percentage"] - int(leader["refund_percentage"])) <= tolerance

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        new_refund = _clamp_percentage(result["refund_percentage"])
        new_verdict = "REFUND_GRANTED" if result["discrepancy_genuine"] else "DISPUTE_REJECTED"
        overturned = new_verdict != original_verdict or new_refund != original_refund

        key = _outcome_key(dispute_id, round_no)
        self.appeal_outcomes[key] = AppealOutcome(
            dispute_id=dispute_id,
            round_no=u8(min(255, round_no)),
            tolerance=u8(tolerance),
            original_verdict=original_verdict,
            original_refund_pct=u8(original_refund),
            appeal_verdict=new_verdict,
            appeal_refund_pct=u8(new_refund),
            overturned=overturned,
            resolved=True,
        )
        self.latest_appeal_round[dispute_id] = u8(min(255, round_no))
        return self._serialize_outcome(self.appeal_outcomes[key])

    @gl.public.view
    def get_appeal_outcome(self, dispute_id: str) -> str:
        """Latest round's outcome (round-specific: get_appeal_outcome_for_round)."""
        last = self.latest_appeal_round.get(dispute_id)
        if last is None:
            return json.dumps({"error": "not_found", "dispute_id": dispute_id, "resolved": False})
        return self.get_appeal_outcome_for_round(dispute_id, int(last))

    @gl.public.view
    def get_appeal_outcome_for_round(self, dispute_id: str, round_no: int) -> str:
        o = self.appeal_outcomes.get(_outcome_key(dispute_id, round_no))
        if o is None:
            return json.dumps(
                {
                    "error": "not_found",
                    "dispute_id": dispute_id,
                    "round_no": int(round_no),
                    "resolved": False,
                }
            )
        return self._serialize_outcome(o)

    def _serialize_outcome(self, o: AppealOutcome) -> str:
        return json.dumps(
            {
                "dispute_id": o.dispute_id,
                "round_no": int(o.round_no),
                "tolerance": int(o.tolerance),
                "original_verdict": o.original_verdict,
                "original_refund_pct": int(o.original_refund_pct),
                "appeal_verdict": o.appeal_verdict,
                "appeal_refund_pct": int(o.appeal_refund_pct),
                "overturned": o.overturned,
                "resolved": o.resolved,
            }
        )

    @gl.public.view
    def get_verdict(self, dispute_id: str) -> str:
        d = self.disputes.get(dispute_id)
        if d is None:
            return json.dumps({"error": "not_found", "dispute_id": dispute_id})
        return json.dumps(
            {
                "dispute_id": d.dispute_id,
                "verdict": d.verdict,
                "refund_percentage": int(d.refund_percentage),
                "resolved": d.resolved,
                "submitter": d.submitter,
            }
        )
