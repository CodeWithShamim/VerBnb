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

VALID_SEVERITY = ("MINOR", "MODERATE", "MAJOR", "COUNTERFEIT")


@allow_storage
@dataclass
class ProductDispute:
    dispute_id: str
    seller_listing_url: str
    buyer_evidence_url: str
    verdict: str
    refund_percentage: u8
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
            }
        )
