# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Ethical Sourcing (BRAND claim validation)

Validates a brand's ethical-sourcing claim against public certification
registries and supplier databases. Validators independently fetch the
certification page, ask an LLM to score trustworthiness, and agree when
their trust scores are within +/- 15 of the leader's.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

MAX_PAGE_CHARS = 2000
SCORE_TOLERANCE = 15

VALID_CONFIDENCE = ("HIGH", "MEDIUM", "LOW")
VALID_VERDICT = ("VERIFIED", "UNVERIFIED", "MISLEADING", "FALSE")


def _claim_key(brand_id: str, claim: str) -> str:
    """Length-prefixed so a ':' inside brand_id can't collide with another pair."""
    return f"{len(brand_id)}:{brand_id}:{claim}"


def _clamp_score(value: object) -> int:
    try:
        score = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"LLM_ERROR: non-numeric trust_score: {value!r}")
    return max(0, min(100, score))


def _fetch(url: str) -> str:
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception as e:
        raise gl.vm.UserError(f"EXTERNAL: failed to fetch {url}: {e}")
    if not content:
        raise gl.vm.UserError(f"EXTERNAL: empty content from {url}")
    return content[:MAX_PAGE_CHARS]


def _build_prompt(brand_id: str, claim: str, cert_text: str, registry_text: str) -> str:
    return f"""You are an impartial ethical-sourcing auditor. A brand has made a public
sourcing/sustainability claim. Validate it against the certification and supplier
data below.

BRAND: {brand_id}
CLAIM: "{claim}"

CERTIFICATION REGISTRY CONTENT:
<certification>
{cert_text}
</certification>

SUPPLIER REGISTRY CONTENT:
<supplier_registry>
{registry_text}
</supplier_registry>

Judge strictly from the evidence above. If the certification clearly supports the
claim, trust is high. Contradictions, expired/absent certifications, or unrelated
data lower trust. Do not assume facts not present in the text.

Respond with ONLY a JSON object, no markdown, no prose, exactly these keys:
{{
  "claim_supported": true or false,
  "confidence": one of "HIGH", "MEDIUM", "LOW",
  "trust_score": integer 0 to 100,
  "contradictions": array of short strings,
  "verdict": one of "VERIFIED", "UNVERIFIED", "MISLEADING", "FALSE",
  "summary": short string
}}
Output must be parseable by a strict JSON parser with no surrounding text."""


def _evaluate(brand_id: str, claim: str, cert_url: str, registry_url: str) -> dict:
    cert_text = _fetch(cert_url)
    registry_text = _fetch(registry_url)

    result = gl.nondet.exec_prompt(
        _build_prompt(brand_id, claim, cert_text, registry_text),
        response_format="json",
    )

    if not isinstance(result, dict):
        raise gl.vm.UserError(f"LLM_ERROR: expected JSON object, got {type(result).__name__}")

    if "trust_score" not in result or "verdict" not in result:
        raise gl.vm.UserError(f"LLM_ERROR: missing required fields, got keys {list(result.keys())}")

    confidence = str(result.get("confidence", "LOW")).upper()
    if confidence not in VALID_CONFIDENCE:
        confidence = "LOW"

    verdict = str(result.get("verdict", "UNVERIFIED")).upper()
    if verdict not in VALID_VERDICT:
        verdict = "UNVERIFIED"

    contradictions = result.get("contradictions", [])
    if not isinstance(contradictions, list):
        contradictions = [str(contradictions)]

    return {
        "claim_supported": bool(result.get("claim_supported")),
        "confidence": confidence,
        "trust_score": _clamp_score(result.get("trust_score")),
        "contradictions": [str(c) for c in contradictions][:10],
        "verdict": verdict,
        "summary": str(result.get("summary", ""))[:1000],
    }


class EthicalSourcing(gl.Contract):
    trust_scores: TreeMap[str, u8]
    claim_verdicts: TreeMap[str, str]
    last_checked: TreeMap[str, u256]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def validate_claim(
        self,
        brand_id: str,
        claim: str,
        certification_url: str,
        supplier_registry_url: str,
    ) -> None:
        def leader_fn() -> dict:
            return _evaluate(brand_id, claim, certification_url, supplier_registry_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(brand_id, claim, certification_url, supplier_registry_url)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "trust_score" not in leader:
                return False
            return abs(own["trust_score"] - int(leader["trust_score"])) <= SCORE_TOLERANCE

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        score = _clamp_score(result["trust_score"])
        now = int(datetime.now(timezone.utc).timestamp())
        key = _claim_key(brand_id, claim)

        self.trust_scores[brand_id] = u8(score)
        self.claim_verdicts[key] = json.dumps(
            {
                "brand_id": brand_id,
                "claim": claim,
                "claim_supported": result["claim_supported"],
                "confidence": result["confidence"],
                "trust_score": score,
                "contradictions": result["contradictions"],
                "verdict": result["verdict"],
                "summary": result["summary"],
                "checked_at": now,
            }
        )
        self.last_checked[brand_id] = u256(now)

    @gl.public.view
    def get_trust_score(self, brand_id: str) -> int:
        return int(self.trust_scores.get(brand_id, u8(0)))

    @gl.public.view
    def get_claim_verdict(self, brand_id: str, claim: str) -> str:
        key = _claim_key(brand_id, claim)
        v = self.claim_verdicts.get(key)
        if v is None:
            return json.dumps({"error": "not_found", "brand_id": brand_id, "claim": claim})
        return v
