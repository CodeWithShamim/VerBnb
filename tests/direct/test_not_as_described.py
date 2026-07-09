"""Direct-mode tests for not_as_described.py (PRODUCT disputes)."""

import json

CONTRACT = "contracts/not_as_described.py"

LISTING = (
    "Apple AirPods Pro (2nd gen), brand new sealed, USB-C, active noise "
    "cancellation, includes MagSafe case and warranty card."
)
EVIDENCE = (
    "Buyer received used earbuds in a plain box, no warranty card, lightning "
    "case not USB-C, serial number not recognized by Apple - likely counterfeit."
)


def _mock(direct_vm, refund=90, genuine=True, severity="COUNTERFEIT"):
    direct_vm.mock_web(r".*", {"status": 200, "body": LISTING + " " + EVIDENCE})
    direct_vm.mock_llm(
        r".*arbitrator.*",
        json.dumps(
            {
                "discrepancy_genuine": genuine,
                "severity": severity,
                "issues_found": ["used not new", "counterfeit serial", "wrong connector"],
                "refund_percentage": refund,
                "reasoning": "Item appears counterfeit and materially different.",
            }
        ),
    )


def test_happy_path_and_storage(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, refund=90)
    c.raise_dispute("prod-1", "https://ebay.com/itm/1", "https://ipfs.io/p1")
    out = json.loads(c.get_verdict("prod-1"))
    assert out["resolved"] is True
    assert out["verdict"] == "REFUND_GRANTED"
    assert 80 <= out["refund_percentage"] <= 100
    assert out["dispute_id"] == "prod-1"


def test_rejected_when_not_genuine(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, refund=0, genuine=False, severity="MINOR")
    c.raise_dispute("prod-2", "https://ebay.com/itm/2", "https://ipfs.io/p2")
    out = json.loads(c.get_verdict("prod-2"))
    assert out["verdict"] == "DISPUTE_REJECTED"
    assert out["refund_percentage"] == 0


def test_malformed_llm_json_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": LISTING})
    direct_vm.mock_llm(r".*arbitrator.*", "the buyer is right i guess")
    with direct_vm.expect_revert("LLM_ERROR"):
        c.raise_dispute("prod-3", "https://ebay.com/itm/3", "https://ipfs.io/p3")


def test_fetch_failure_raises_external(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})
    direct_vm.mock_llm(r".*arbitrator.*", json.dumps({"refund_percentage": 10, "discrepancy_genuine": False}))
    with direct_vm.expect_revert("EXTERNAL"):
        c.raise_dispute("prod-4", "https://ebay.com/itm/4", "https://ipfs.io/p4")


def test_view_returns_not_found(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_verdict("nope"))
    assert out["error"] == "not_found"
