"""Direct-mode tests for delivery_adjudicator.py (COURIER disputes)."""

import json

CONTRACT = "contracts/delivery_adjudicator.py"

EVIDENCE = (
    "Courier proof: parcel TRK-99 scanned 'DELIVERED' at front door, GPS "
    "37.77,-122.41 matches 742 Evergreen Terrace, photo of package on porch, "
    "signed by recipient J. Doe at 14:02."
)


def _mock(direct_vm, verdict="DELIVERED", confirmed=True, credible=True, consistent=True):
    direct_vm.mock_web(r".*", {"status": 200, "body": EVIDENCE})
    direct_vm.mock_llm(
        r".*adjudicator.*",
        json.dumps(
            {
                "delivery_confirmed": confirmed,
                "evidence_credible": credible,
                "address_consistent": consistent,
                "verdict": verdict,
                "refund_due": verdict != "DELIVERED",
                "reasoning": "GPS, photo, and signature corroborate delivery.",
            }
        ),
    )


def test_delivered_no_refund(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, verdict="DELIVERED")
    c.raise_dispute("del-1", "ORD-1", "https://courier.com/trk/99", "Never got it", "742 Evergreen Terrace")
    out = json.loads(c.get_verdict("del-1"))
    assert out["verdict"] == "DELIVERED"
    assert out["refund_due"] is False
    assert out["resolved"] is True
    assert out["order_id"] == "ORD-1"


def test_not_delivered_refund_due(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, verdict="NOT_DELIVERED", confirmed=False, credible=False)
    c.raise_dispute("del-2", "ORD-2", "https://courier.com/trk/2", "Never arrived", "1 Main St")
    out = json.loads(c.get_verdict("del-2"))
    assert out["verdict"] == "NOT_DELIVERED"
    assert out["refund_due"] is True


def test_wrong_address_refund_due(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, verdict="WRONG_ADDRESS", consistent=False)
    c.raise_dispute("del-3", "ORD-3", "https://courier.com/trk/3", "Wrong house", "5 Oak Ave")
    out = json.loads(c.get_verdict("del-3"))
    assert out["verdict"] == "WRONG_ADDRESS"
    assert out["refund_due"] is True


def test_invalid_verdict_normalized(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": EVIDENCE})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "MAYBE_LOST"}))
    c.raise_dispute("del-4", "ORD-4", "https://courier.com/trk/4", "?", "9 Pine St")
    out = json.loads(c.get_verdict("del-4"))
    assert out["verdict"] == "INSUFFICIENT_EVIDENCE"
    assert out["refund_due"] is True


def test_malformed_llm_json_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": EVIDENCE})
    direct_vm.mock_llm(r".*adjudicator.*", "it was delivered probably")
    with direct_vm.expect_revert("LLM_ERROR"):
        c.raise_dispute("del-5", "ORD-5", "https://courier.com/trk/5", "?", "x")


def test_fetch_failure_raises_external(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "DELIVERED"}))
    with direct_vm.expect_revert("EXTERNAL"):
        c.raise_dispute("del-6", "ORD-6", "https://courier.com/trk/6", "?", "x")


def test_view_returns_not_found(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_verdict("ghost"))
    assert out["error"] == "not_found"


# --------------------------------------------------------------- appeal consensus


def test_resolve_appeal_reruns_consensus_from_stored_state(direct_vm, direct_deploy, direct_alice):
    """resolve_appeal re-evaluates the ORIGINAL stored evidence on-chain and
    records an authenticated AppealOutcome — no verdict is passed in."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    # Original round: courier wins.
    _mock(direct_vm, verdict="DELIVERED")
    c.raise_dispute("del-appeal-1", "ORD-9", "https://courier.com/trk/9", "Never got it", "9 Elm St")
    assert json.loads(c.get_verdict("del-appeal-1"))["refund_due"] is False

    # Appeal round re-runs consensus; this time the evidence reads as forged.
    direct_vm.clear_mocks()
    _mock(direct_vm, verdict="NOT_DELIVERED", confirmed=False, credible=False)
    out = json.loads(c.resolve_appeal("del-appeal-1", 1))
    assert out["resolved"] is True
    assert out["round_no"] == 1
    assert out["tolerance"] == 0  # exact verdict match is already the strictest bar
    assert out["original_verdict"] == "DELIVERED"
    assert out["appeal_verdict"] == "NOT_DELIVERED"
    assert out["appeal_refund_due"] is True
    assert out["appeal_refund_pct"] == 100  # all-or-nothing projection
    assert out["overturned"] is True

    # Persisted + readable (this is what appeal_manager reads cross-contract).
    stored = json.loads(c.get_appeal_outcome("del-appeal-1"))
    assert stored["appeal_verdict"] == "NOT_DELIVERED"
    assert stored["overturned"] is True
    # The ORIGINAL dispute record is left intact for comparison.
    assert json.loads(c.get_verdict("del-appeal-1"))["verdict"] == "DELIVERED"


def test_resolve_appeal_upheld_not_overturned(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, verdict="DELIVERED")
    c.raise_dispute("del-appeal-2", "ORD-10", "https://courier.com/trk/10", "Never got it", "10 Elm St")
    # Same verdict on re-run → original stands, no refund.
    out = json.loads(c.resolve_appeal("del-appeal-2", 1))
    assert out["overturned"] is False
    assert out["appeal_verdict"] == "DELIVERED"
    assert out["appeal_refund_pct"] == 0


def test_resolve_appeal_requires_resolved_dispute(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("no resolved dispute to appeal"):
        c.resolve_appeal("does-not-exist", 1)


def test_get_appeal_outcome_not_found(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_appeal_outcome("nope"))
    assert out["resolved"] is False
    assert out["error"] == "not_found"
