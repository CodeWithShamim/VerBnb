"""Direct-mode stand-in for a specialist judge's cross-contract view.

appeal_manager.finalize_appeal_from_state reads the specialist's round-bound
AppealOutcome via gl.get_contract_at().view().get_appeal_outcome_for_round().
The single-contract direct harness has no second contract, so tests install
this gl_call hook to serve that read from a plain dict, using the same wire
format glsim's cross-contract hook produces (ResultCode byte 0 for success +
calldata-encoded return value).

The full two-contract flow (real NotAsDescribed + AppealManager) is exercised
end-to-end in tests/sim/test_product_appeal_state_derived.py.
"""

import json

# Any well-formed address works: the stub answers for every address.
SPECIALIST_ADDRESS = "0x" + "5a" * 20


def outcome_for(
    dispute_id: str,
    round_no: int,
    appeal_verdict: str = "REFUND_GRANTED",
    appeal_refund_pct: int = 80,
    original_refund_pct: int = 40,
    overturned: bool | None = None,
) -> dict:
    """A specialist AppealOutcome JSON payload, as _serialize_outcome emits it."""
    out = {
        "dispute_id": dispute_id,
        "round_no": round_no,
        "tolerance": 10,
        "original_verdict": "REFUND_GRANTED",
        "original_refund_pct": original_refund_pct,
        "appeal_verdict": appeal_verdict,
        "appeal_refund_pct": appeal_refund_pct,
        "resolved": True,
    }
    if overturned is not None:
        out["overturned"] = overturned
    return out


def install_specialist_stub(direct_vm, outcomes: dict) -> None:
    """Serve get_appeal_outcome_for_round reads from `outcomes`.

    `outcomes` maps (dispute_id, round_no) -> outcome dict and may be mutated
    after installation (e.g. to record a later round mid-test). Unknown rounds
    answer with the specialists' not_found/resolved=False shape.
    """
    from genlayer.py import calldata

    def hook(vm, request):
        call = request.get("CallContract")
        if call is None:
            return None
        cd = call.get("calldata", {})
        method = cd.get("method")
        args = list(cd.get("args", []))
        if method == "get_appeal_outcome_for_round" and len(args) >= 2:
            dispute_id, round_no = str(args[0]), int(args[1])
            out = outcomes.get((dispute_id, round_no))
            if out is None:
                out = {
                    "error": "not_found",
                    "dispute_id": dispute_id,
                    "round_no": round_no,
                    "resolved": False,
                }
            return bytes([0]) + calldata.encode(json.dumps(out))
        return bytes([1]) + f"unsupported stub method: {method}".encode()

    direct_vm._gl_call_hook = hook
