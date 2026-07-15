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


# --------------------------------------------------------------- appeal consensus


def test_resolve_appeal_reruns_consensus_from_stored_state(direct_vm, direct_deploy, direct_alice):
    """resolve_appeal re-evaluates the ORIGINAL stored evidence on-chain and
    records an authenticated AppealOutcome — no verdict is passed in."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    # Original round grants a partial refund.
    _mock(direct_vm, refund=50, genuine=True, severity="MODERATE")
    c.raise_dispute("prod-appeal-1", "https://ebay.com/itm/9", "https://ipfs.io/e9")
    assert json.loads(c.get_verdict("prod-appeal-1"))["refund_percentage"] == 50

    # Appeal round re-runs consensus; this time validators land on a full refund.
    direct_vm.clear_mocks()
    _mock(direct_vm, refund=95, genuine=True, severity="MAJOR")
    out = json.loads(c.resolve_appeal("prod-appeal-1", 1))
    assert out["resolved"] is True
    assert out["round_no"] == 1
    assert out["tolerance"] == 10  # REFUND_TOLERANCE(15) - 5*round(1)
    assert out["original_refund_pct"] == 50
    assert out["appeal_refund_pct"] == 95
    assert out["overturned"] is True

    # Persisted + readable (this is what appeal_manager reads cross-contract).
    stored = json.loads(c.get_appeal_outcome("prod-appeal-1"))
    assert stored["appeal_refund_pct"] == 95
    assert stored["overturned"] is True
    # The ORIGINAL dispute record is left intact for comparison.
    assert json.loads(c.get_verdict("prod-appeal-1"))["refund_percentage"] == 50


def test_resolve_appeal_tightens_tolerance_each_round(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, refund=40)
    c.raise_dispute("prod-appeal-2", "https://ebay.com/itm/10", "https://ipfs.io/e10")

    assert json.loads(c.resolve_appeal("prod-appeal-2", 1))["tolerance"] == 10
    assert json.loads(c.resolve_appeal("prod-appeal-2", 2))["tolerance"] == 5
    assert json.loads(c.resolve_appeal("prod-appeal-2", 3))["tolerance"] == 5  # floored


def test_resolve_appeal_upheld_not_overturned(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, refund=90, genuine=True, severity="COUNTERFEIT")
    c.raise_dispute("prod-appeal-3", "https://ebay.com/itm/11", "https://ipfs.io/e11")
    # Same verdict on re-run → original stands.
    out = json.loads(c.resolve_appeal("prod-appeal-3", 1))
    assert out["overturned"] is False
    assert out["appeal_verdict"] == "REFUND_GRANTED"


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
