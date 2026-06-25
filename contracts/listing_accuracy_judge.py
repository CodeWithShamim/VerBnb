# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Listing Accuracy Judge (RENTAL / Airbnb-style disputes)

Judges whether a rental listing materially misrepresented the property.
Validators independently fetch the listing page and the guest's evidence,
ask an LLM for a verdict, and reach consensus when their recommended
refund percentages are within +/- 15 of the leader's.
"""

import json
from dataclasses import dataclass

from genlayer import *

# Maximum characters of fetched web content fed to the LLM (token-overflow guard).
MAX_PAGE_CHARS = 2000
# Validator agrees when its own refund recommendation is within this many points.
REFUND_TOLERANCE = 15

VALID_SEVERITY = ("MINOR", "MODERATE", "MAJOR", "FRAUDULENT")


@allow_storage
@dataclass
class ListingDispute:
    dispute_id: str
    listing_url: str
    guest_evidence_url: str
    claimed_amount: u256
    verdict: str
    refund_percentage: u8
    resolved: bool


def _clamp_percentage(value: object) -> int:
    """Coerce an LLM-supplied value into an int in the range [0, 100]."""
    try:
        pct = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"LLM_ERROR: non-numeric refund_percentage: {value!r}")
    return max(0, min(100, pct))


def _fetch(url: str) -> str:
    """Fetch a page as text, sliced to MAX_PAGE_CHARS. Raises EXTERNAL on failure."""
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception as e:
        raise gl.vm.UserError(f"EXTERNAL: failed to fetch {url}: {e}")
    if not content:
        raise gl.vm.UserError(f"EXTERNAL: empty content from {url}")
    return content[:MAX_PAGE_CHARS]


def _build_prompt(listing_text: str, evidence_text: str, claimed_amount: int) -> str:
    return f"""You are an impartial rental-dispute adjudicator for an Airbnb-style marketplace.
A guest claims a listing materially misrepresented the property.

LISTING DESCRIPTION (what was advertised):
<listing>
{listing_text}
</listing>

GUEST EVIDENCE (what the guest reported / documented):
<evidence>
{evidence_text}
</evidence>

The guest paid {claimed_amount} (smallest currency unit) for this stay.

Decide, strictly from the text above, whether the listing was materially
misleading and what refund is fair. Be conservative: minor subjective
differences do not justify a large refund; clear, material misrepresentation does.

Respond with ONLY a JSON object, no markdown, no prose, exactly these keys:
{{
  "materially_misleading": true or false,
  "severity": one of "MINOR", "MODERATE", "MAJOR", "FRAUDULENT",
  "misrepresented_features": array of short strings,
  "refund_percentage": integer 0 to 100,
  "reasoning": short string
}}
Output must be parseable by a strict JSON parser with no surrounding text."""


def _evaluate(listing_url: str, evidence_url: str, claimed_amount: int) -> dict:
    """Non-deterministic core: fetch evidence + run the LLM. Returns a clean dict."""
    listing_text = _fetch(listing_url)
    evidence_text = _fetch(evidence_url)

    result = gl.nondet.exec_prompt(
        _build_prompt(listing_text, evidence_text, claimed_amount),
        response_format="json",
    )

    if not isinstance(result, dict):
        raise gl.vm.UserError(f"LLM_ERROR: expected JSON object, got {type(result).__name__}")

    if "refund_percentage" not in result or "materially_misleading" not in result:
        raise gl.vm.UserError(f"LLM_ERROR: missing required fields, got keys {list(result.keys())}")

    severity = str(result.get("severity", "MODERATE")).upper()
    if severity not in VALID_SEVERITY:
        severity = "MODERATE"

    features = result.get("misrepresented_features", [])
    if not isinstance(features, list):
        features = [str(features)]

    return {
        "materially_misleading": bool(result.get("materially_misleading")),
        "severity": severity,
        "misrepresented_features": [str(f) for f in features][:10],
        "refund_percentage": _clamp_percentage(result.get("refund_percentage")),
        "reasoning": str(result.get("reasoning", ""))[:1000],
    }


class ListingAccuracyJudge(gl.Contract):
    disputes: TreeMap[str, ListingDispute]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def raise_dispute(
        self,
        dispute_id: str,
        listing_url: str,
        guest_evidence_url: str,
        claimed_amount: u256,
    ) -> None:
        if dispute_id in self.disputes and self.disputes[dispute_id].resolved:
            raise gl.vm.UserError("dispute already resolved")

        claimed_int = int(claimed_amount)

        def leader_fn() -> dict:
            return _evaluate(listing_url, guest_evidence_url, claimed_int)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            # Reject if the leader errored or returned a non-value result.
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(listing_url, guest_evidence_url, claimed_int)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "refund_percentage" not in leader:
                return False
            return abs(own["refund_percentage"] - int(leader["refund_percentage"])) <= REFUND_TOLERANCE

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        refund = _clamp_percentage(result["refund_percentage"])
        verdict = "REFUND_GRANTED" if result["materially_misleading"] else "DISPUTE_REJECTED"

        self.disputes[dispute_id] = ListingDispute(
            dispute_id=dispute_id,
            listing_url=listing_url,
            guest_evidence_url=guest_evidence_url,
            claimed_amount=u256(claimed_int),
            verdict=verdict,
            refund_percentage=u8(refund),
            resolved=True,
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
                "claimed_amount": int(d.claimed_amount),
                "resolved": d.resolved,
            }
        )
