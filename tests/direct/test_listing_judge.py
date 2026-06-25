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
