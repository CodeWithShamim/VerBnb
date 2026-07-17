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
# An appeal re-runs consensus with a TIGHTER equivalence bar each round, so the
# validator set must agree more closely than in the original round. Round 1
# allows +/-10, round 2 +/-5, and it floors at +/-5 thereafter.
APPEAL_MIN_TOLERANCE = 5
APPEAL_TOLERANCE_STEP = 5

VALID_CONFIDENCE = ("HIGH", "MEDIUM", "LOW")
VALID_VERDICT = ("VERIFIED", "UNVERIFIED", "MISLEADING", "FALSE")


def _outcome_key(dispute_id: str, round_no: int) -> str:
    """Storage key binding an appeal outcome to its consensus round."""
    return f"{dispute_id}#r{int(round_no)}"


def _appeal_tolerance(round_no: int) -> int:
    """Stricter trust-score agreement bar for appeal round `round_no` (1-indexed)."""
    r = max(1, int(round_no))
    return max(APPEAL_MIN_TOLERANCE, SCORE_TOLERANCE - APPEAL_TOLERANCE_STEP * r)


@allow_storage
@dataclass
class SourcingDispute:
    """A claim validation filed under a marketplace dispute id, persisted with
    its evidence URLs so an appeal can re-run consensus over authenticated
    contract state (see resolve_appeal)."""

    dispute_id: str
    brand_id: str
    claim: str
    certification_url: str
    supplier_registry_url: str
    verdict: str
    trust_score: u8
    claim_supported: bool
    resolved: bool
    submitter: str


@allow_storage
@dataclass
class AppealOutcome:
    """The re-evaluated verdict for a dispute, produced ON-CHAIN by re-running
    validator consensus over this contract's own authenticated evidence (the
    stored certification/registry URLs) — never supplied by an off-chain caller."""

    dispute_id: str
    round_no: u8
    tolerance: u8
    original_verdict: str
    original_trust_score: u8
    appeal_verdict: str
    appeal_trust_score: u8
    overturned: bool
    resolved: bool


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
    disputes: TreeMap[str, SourcingDispute]
    # Keyed by "<dispute_id>#r<round>" so every round's outcome is kept and an
    # outcome can only ever be read back for the round it was recorded for.
    appeal_outcomes: TreeMap[str, AppealOutcome]
    # dispute_id -> highest appeal round resolved so far (rounds are monotonic).
    latest_appeal_round: TreeMap[str, u8]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def validate_claim(
        self,
        brand_id: str,
        claim: str,
        certification_url: str,
        supplier_registry_url: str,
        dispute_id: str = "",
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

        if dispute_id and dispute_id in self.disputes and self.disputes[dispute_id].resolved:
            raise gl.vm.UserError("dispute already resolved")

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        score = _clamp_score(result["trust_score"])
        now = int(datetime.now(timezone.utc).timestamp())
        key = _claim_key(brand_id, claim)

        # When filed under a marketplace dispute id, persist the evidence URLs
        # so resolve_appeal can later re-run consensus over authenticated state.
        if dispute_id:
            self.disputes[dispute_id] = SourcingDispute(
                dispute_id=dispute_id,
                brand_id=brand_id,
                claim=claim,
                certification_url=certification_url,
                supplier_registry_url=supplier_registry_url,
                verdict=result["verdict"],
                trust_score=u8(score),
                claim_supported=result["claim_supported"],
                resolved=True,
                submitter=gl.message.sender_address.as_hex.lower(),
            )

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

    @gl.public.write
    def resolve_appeal(self, dispute_id: str, round_no: int) -> str:
        """Re-run validator consensus for an appeal, ON-CHAIN.

        Nothing here is caller-supplied: the claim re-validated is read from
        this contract's own authenticated storage (the brand, claim, and
        certification/registry URLs recorded when the dispute was filed), and
        the new verdict is produced by a fresh `gl.vm.run_nondet` round with a
        stricter trust-score agreement bar. The result is persisted as an
        AppealOutcome that the appeal_manager reads back via
        get_contract_at().view() when it finalizes.

        Only claims filed with a dispute_id (via validate_claim) are appealable.

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
        brand_id = d.brand_id
        claim = d.claim
        cert_url = d.certification_url
        registry_url = d.supplier_registry_url
        original_verdict = d.verdict
        original_score = int(d.trust_score)

        tolerance = _appeal_tolerance(round_no)

        def leader_fn() -> dict:
            return _evaluate(brand_id, claim, cert_url, registry_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(brand_id, claim, cert_url, registry_url)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "trust_score" not in leader:
                return False
            return abs(own["trust_score"] - int(leader["trust_score"])) <= tolerance

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        new_score = _clamp_score(result["trust_score"])
        new_verdict = result["verdict"]
        overturned = new_verdict != original_verdict

        key = _outcome_key(dispute_id, round_no)
        self.appeal_outcomes[key] = AppealOutcome(
            dispute_id=dispute_id,
            round_no=u8(min(255, round_no)),
            tolerance=u8(tolerance),
            original_verdict=original_verdict,
            original_trust_score=u8(original_score),
            appeal_verdict=new_verdict,
            appeal_trust_score=u8(new_score),
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
        # No appeal_refund_pct key: sourcing verdicts carry no refund, so the
        # appeal_manager falls back to 0 and derives did_overturn from
        # `overturned` (verdict comparison) instead.
        return json.dumps(
            {
                "dispute_id": o.dispute_id,
                "round_no": int(o.round_no),
                "tolerance": int(o.tolerance),
                "original_verdict": o.original_verdict,
                "original_trust_score": int(o.original_trust_score),
                "appeal_verdict": o.appeal_verdict,
                "appeal_trust_score": int(o.appeal_trust_score),
                "overturned": o.overturned,
                "resolved": o.resolved,
            }
        )

    @gl.public.view
    def get_verdict(self, dispute_id: str) -> str:
        """Dispute-id-keyed verdict view, uniform with the other specialists."""
        d = self.disputes.get(dispute_id)
        if d is None:
            return json.dumps({"error": "not_found", "dispute_id": dispute_id})
        return json.dumps(
            {
                "dispute_id": d.dispute_id,
                "brand_id": d.brand_id,
                "claim": d.claim,
                "verdict": d.verdict,
                "trust_score": int(d.trust_score),
                "claim_supported": d.claim_supported,
                "resolved": d.resolved,
                "submitter": d.submitter,
            }
        )

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
