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
