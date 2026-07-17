"""Direct-mode tests for listing_accuracy_judge.py (RENTAL disputes)."""

import json

CONTRACT = "contracts/listing_accuracy_judge.py"

LISTING_TEXT = (
    "Sunny 2-bedroom apartment, 75 sqm, ocean view from every room, "
    "fully equipped kitchen, fast 200Mbps wifi, free parking, sleeps 4. "
    "Walking distance to the beach (2 min)."
)
EVIDENCE_TEXT = (
    "Guest report: apartment was 1 bedroom not 2, no ocean view (faced a wall), "
    "wifi was 5Mbps and dropped constantly, parking was paid street parking. "
    "Beach was a 25 minute walk."
)


def _mock_clean(direct_vm, refund=60, misleading=True, severity="MAJOR"):
    direct_vm.mock_web(r".*", {"status": 200, "body": LISTING_TEXT + " " + EVIDENCE_TEXT})
    direct_vm.mock_llm(
        r".*adjudicator.*",
        json.dumps(
            {
                "materially_misleading": misleading,
                "severity": severity,
                "misrepresented_features": ["bedroom count", "ocean view", "wifi speed"],
                "refund_percentage": refund,
                "reasoning": "Multiple advertised features were materially absent.",
            }
        ),
    )


def test_happy_path_and_storage(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock_clean(direct_vm, refund=60)

    c.raise_dispute("rent-1", "https://airbnb.com/rooms/1", "https://ipfs.io/ev1", 500000)

    out = json.loads(c.get_verdict("rent-1"))
    assert out["resolved"] is True
    assert out["verdict"] == "REFUND_GRANTED"
    # Refund within expected range of the mocked leader value.
    assert 45 <= out["refund_percentage"] <= 75
    assert out["claimed_amount"] == 500000
    assert out["dispute_id"] == "rent-1"


def test_rejected_verdict_when_not_misleading(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock_clean(direct_vm, refund=0, misleading=False, severity="MINOR")

    c.raise_dispute("rent-2", "https://airbnb.com/rooms/2", "https://ipfs.io/ev2", 100000)
    out = json.loads(c.get_verdict("rent-2"))
    assert out["verdict"] == "DISPUTE_REJECTED"
    assert out["refund_percentage"] == 0


def test_refund_clamped_to_100(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock_clean(direct_vm, refund=250)  # LLM over-reports
    c.raise_dispute("rent-3", "https://airbnb.com/rooms/3", "https://ipfs.io/ev3", 100000)
    out = json.loads(c.get_verdict("rent-3"))
    assert out["refund_percentage"] == 100


def test_malformed_llm_json_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": LISTING_TEXT})
    direct_vm.mock_llm(r".*adjudicator.*", "I think the guest is probably right, sorry!")
    with direct_vm.expect_revert("LLM_ERROR"):
        c.raise_dispute("rent-4", "https://airbnb.com/rooms/4", "https://ipfs.io/ev4", 100000)


def test_missing_fields_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": LISTING_TEXT})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"severity": "MAJOR"}))
    with direct_vm.expect_revert("LLM_ERROR"):
        c.raise_dispute("rent-5", "https://airbnb.com/rooms/5", "https://ipfs.io/ev5", 100000)


def test_fetch_failure_raises_external(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})  # empty content
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"refund_percentage": 10, "materially_misleading": False}))
    with direct_vm.expect_revert("EXTERNAL"):
        c.raise_dispute("rent-6", "https://airbnb.com/rooms/6", "https://ipfs.io/ev6", 100000)


def test_view_returns_not_found(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_verdict("does-not-exist"))
    assert out["error"] == "not_found"


# --------------------------------------------------------------- appeal consensus


def test_resolve_appeal_reruns_consensus_from_stored_state(direct_vm, direct_deploy, direct_alice):
    """resolve_appeal re-evaluates the ORIGINAL stored evidence on-chain and
    records an authenticated AppealOutcome — no verdict is passed in."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    # Original round grants a partial refund.
    _mock_clean(direct_vm, refund=50, misleading=True, severity="MODERATE")
    c.raise_dispute("rent-appeal-1", "https://airbnb.com/rooms/9", "https://ipfs.io/e9", 200000)
    assert json.loads(c.get_verdict("rent-appeal-1"))["refund_percentage"] == 50

    # Appeal round re-runs consensus; this time validators land on a full refund.
    direct_vm.clear_mocks()
    _mock_clean(direct_vm, refund=95, misleading=True, severity="FRAUDULENT")
    out = json.loads(c.resolve_appeal("rent-appeal-1", 1))
    assert out["resolved"] is True
    assert out["round_no"] == 1
    assert out["tolerance"] == 10  # REFUND_TOLERANCE(15) - 5*round(1)
    assert out["original_refund_pct"] == 50
    assert out["appeal_refund_pct"] == 95
    assert out["overturned"] is True

    # Persisted + readable (this is what appeal_manager reads cross-contract).
    stored = json.loads(c.get_appeal_outcome("rent-appeal-1"))
    assert stored["appeal_refund_pct"] == 95
    assert stored["overturned"] is True
    # The ORIGINAL dispute record is left intact for comparison.
    assert json.loads(c.get_verdict("rent-appeal-1"))["refund_percentage"] == 50


def test_resolve_appeal_tightens_tolerance_each_round(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock_clean(direct_vm, refund=40)
    c.raise_dispute("rent-appeal-2", "https://airbnb.com/rooms/10", "https://ipfs.io/e10", 100000)

    assert json.loads(c.resolve_appeal("rent-appeal-2", 1))["tolerance"] == 10
    assert json.loads(c.resolve_appeal("rent-appeal-2", 2))["tolerance"] == 5
    assert json.loads(c.resolve_appeal("rent-appeal-2", 3))["tolerance"] == 5  # floored


def test_resolve_appeal_upheld_not_overturned(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock_clean(direct_vm, refund=60, misleading=True, severity="MAJOR")
    c.raise_dispute("rent-appeal-3", "https://airbnb.com/rooms/11", "https://ipfs.io/e11", 100000)
    # Same verdict on re-run → original stands.
    out = json.loads(c.resolve_appeal("rent-appeal-3", 1))
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
