# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Delivery Adjudicator (COURIER delivery disputes)

Adjudicates disputes where a courier claims a parcel was delivered and the
customer says it never arrived. Validators independently fetch the courier's
proof-of-delivery evidence, ask an LLM for a verdict, and agree only when
their verdict strings match exactly.
"""

import json
from dataclasses import dataclass

from genlayer import *

MAX_PAGE_CHARS = 2000

VALID_VERDICT = ("DELIVERED", "NOT_DELIVERED", "WRONG_ADDRESS", "INSUFFICIENT_EVIDENCE")


@allow_storage
@dataclass
class DeliveryDispute:
    dispute_id: str
    order_id: str
    courier_evidence_url: str
    customer_claim: str
    expected_address: str
    verdict: str
    refund_due: bool
    resolved: bool
    submitter: str


@allow_storage
@dataclass
class AppealOutcome:
    """The re-evaluated verdict for a dispute, produced ON-CHAIN by re-running
    validator consensus over this contract's own authenticated evidence (the
    stored courier evidence + claim) — never supplied by an off-chain caller.

    DELIVERY consensus already demands an EXACT verdict-string match — the
    strictest possible bar — so appeal rounds re-run with the same rule and
    `tolerance` is always 0."""

    dispute_id: str
    round_no: u8
    tolerance: u8
    original_verdict: str
    original_refund_due: bool
    appeal_verdict: str
    appeal_refund_due: bool
    overturned: bool
    resolved: bool


def _fetch(url: str) -> str:
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception as e:
        raise gl.vm.UserError(f"EXTERNAL: failed to fetch {url}: {e}")
    if not content:
        raise gl.vm.UserError(f"EXTERNAL: empty content from {url}")
    return content[:MAX_PAGE_CHARS]


def _build_prompt(order_id: str, evidence_text: str, customer_claim: str, expected_address: str) -> str:
    return f"""You are an impartial delivery-dispute adjudicator. A courier claims a parcel
was delivered; the customer disputes it.

ORDER ID: {order_id}
EXPECTED DELIVERY ADDRESS: {expected_address}

COURIER PROOF-OF-DELIVERY EVIDENCE:
<evidence>
{evidence_text}
</evidence>

CUSTOMER CLAIM:
<customer_claim>
{customer_claim}
</customer_claim>

Judge strictly from the evidence above:
- "DELIVERED": credible proof the parcel reached the expected address.
- "NOT_DELIVERED": evidence is absent, fabricated, or contradicts delivery.
- "WRONG_ADDRESS": proof shows delivery to a different address than expected.
- "INSUFFICIENT_EVIDENCE": evidence is too weak/ambiguous to decide.

A refund is due unless the verdict is "DELIVERED".

Respond with ONLY a JSON object, no markdown, no prose, exactly these keys:
{{
  "delivery_confirmed": true or false,
  "evidence_credible": true or false,
  "address_consistent": true or false,
  "verdict": one of "DELIVERED", "NOT_DELIVERED", "WRONG_ADDRESS", "INSUFFICIENT_EVIDENCE",
  "refund_due": true or false,
  "reasoning": short string
}}
Output must be parseable by a strict JSON parser with no surrounding text."""


def _evaluate(order_id: str, evidence_url: str, customer_claim: str, expected_address: str) -> dict:
    evidence_text = _fetch(evidence_url)

    result = gl.nondet.exec_prompt(
        _build_prompt(order_id, evidence_text, customer_claim, expected_address),
        response_format="json",
    )

    if not isinstance(result, dict):
        raise gl.vm.UserError(f"LLM_ERROR: expected JSON object, got {type(result).__name__}")

    if "verdict" not in result:
        raise gl.vm.UserError(f"LLM_ERROR: missing 'verdict', got keys {list(result.keys())}")

    verdict = str(result.get("verdict", "INSUFFICIENT_EVIDENCE")).upper()
    if verdict not in VALID_VERDICT:
        verdict = "INSUFFICIENT_EVIDENCE"

    # Refund is due unless the parcel was confirmed delivered.
    refund_due = verdict != "DELIVERED"

    return {
        "delivery_confirmed": bool(result.get("delivery_confirmed")),
        "evidence_credible": bool(result.get("evidence_credible")),
        "address_consistent": bool(result.get("address_consistent")),
        "verdict": verdict,
        "refund_due": refund_due,
        "reasoning": str(result.get("reasoning", ""))[:1000],
    }


class DeliveryAdjudicator(gl.Contract):
    disputes: TreeMap[str, DeliveryDispute]
    appeal_outcomes: TreeMap[str, AppealOutcome]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def raise_dispute(
        self,
        dispute_id: str,
        order_id: str,
        courier_evidence_url: str,
        customer_claim: str,
        expected_address: str,
    ) -> None:
        if dispute_id in self.disputes and self.disputes[dispute_id].resolved:
            raise gl.vm.UserError("dispute already resolved")

        submitter = gl.message.sender_address.as_hex.lower()

        def leader_fn() -> dict:
            return _evaluate(order_id, courier_evidence_url, customer_claim, expected_address)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(order_id, courier_evidence_url, customer_claim, expected_address)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            # DELIVERY consensus: validators must agree on the exact verdict string.
            return own["verdict"] == str(leader["verdict"]).upper()

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        self.disputes[dispute_id] = DeliveryDispute(
            dispute_id=dispute_id,
            order_id=order_id,
            courier_evidence_url=courier_evidence_url,
            customer_claim=customer_claim,
            expected_address=expected_address,
            verdict=result["verdict"],
            refund_due=result["refund_due"],
            resolved=True,
            submitter=submitter,
        )

    @gl.public.write
    def resolve_appeal(self, dispute_id: str, round_no: int) -> str:
        """Re-run validator consensus for an appeal, ON-CHAIN.

        Nothing here is caller-supplied: the evidence re-evaluated is read from
        this contract's own authenticated storage (the order, courier evidence
        URL, claim, and address recorded when the dispute was first resolved),
        and the new verdict is produced by a fresh `gl.vm.run_nondet` round.
        DELIVERY consensus already requires an exact verdict match, so appeals
        keep that same (strictest) bar. The result is persisted as an
        AppealOutcome that the appeal_manager reads back via
        get_contract_at().view() when it finalizes.
        """
        d = self.disputes.get(dispute_id)
        if d is None or not d.resolved:
            raise gl.vm.UserError(f"no resolved dispute to appeal: {dispute_id}")

        # Authenticated original facts (from storage, not the caller).
        order_id = d.order_id
        evidence_url = d.courier_evidence_url
        customer_claim = d.customer_claim
        expected_address = d.expected_address
        original_verdict = d.verdict
        original_refund_due = d.refund_due

        def leader_fn() -> dict:
            return _evaluate(order_id, evidence_url, customer_claim, expected_address)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _evaluate(order_id, evidence_url, customer_claim, expected_address)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            return own["verdict"] == str(leader["verdict"]).upper()

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        new_verdict = result["verdict"]
        new_refund_due = result["refund_due"]
        overturned = new_verdict != original_verdict

        self.appeal_outcomes[dispute_id] = AppealOutcome(
            dispute_id=dispute_id,
            round_no=u8(min(255, max(1, int(round_no)))),
            tolerance=u8(0),
            original_verdict=original_verdict,
            original_refund_due=original_refund_due,
            appeal_verdict=new_verdict,
            appeal_refund_due=new_refund_due,
            overturned=overturned,
            resolved=True,
        )
        return self._serialize_outcome(self.appeal_outcomes[dispute_id])

    @gl.public.view
    def get_appeal_outcome(self, dispute_id: str) -> str:
        o = self.appeal_outcomes.get(dispute_id)
        if o is None:
            return json.dumps({"error": "not_found", "dispute_id": dispute_id, "resolved": False})
        return self._serialize_outcome(o)

    def _serialize_outcome(self, o: AppealOutcome) -> str:
        # appeal_refund_pct projects refund_due onto the appeal_manager's
        # percentage interface: delivery refunds are all-or-nothing.
        return json.dumps(
            {
                "dispute_id": o.dispute_id,
                "round_no": int(o.round_no),
                "tolerance": int(o.tolerance),
                "original_verdict": o.original_verdict,
                "original_refund_due": o.original_refund_due,
                "original_refund_pct": 100 if o.original_refund_due else 0,
                "appeal_verdict": o.appeal_verdict,
                "appeal_refund_due": o.appeal_refund_due,
                "appeal_refund_pct": 100 if o.appeal_refund_due else 0,
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
                "order_id": d.order_id,
                "verdict": d.verdict,
                "refund_due": d.refund_due,
                "resolved": d.resolved,
                "submitter": d.submitter,
            }
        )
