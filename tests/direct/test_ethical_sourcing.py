"""Direct-mode tests for ethical_sourcing.py (BRAND claim validation)."""

import json

CONTRACT = "contracts/ethical_sourcing.py"

CERT = (
    "Fair Trade International certification registry: EcoThreads Co. - "
    "certificate FT-2024-8841, status ACTIVE, scope: organic cotton apparel, "
    "valid through 2026."
)
REGISTRY = (
    "Supplier registry: EcoThreads sources from 3 audited cooperatives in India, "
    "all SA8000 certified, last audit passed."
)


def _mock(direct_vm, score=88, supported=True, verdict="VERIFIED", confidence="HIGH"):
    direct_vm.mock_web(r".*", {"status": 200, "body": CERT + " " + REGISTRY})
    direct_vm.mock_llm(
        r".*auditor.*",
        json.dumps(
            {
                "claim_supported": supported,
                "confidence": confidence,
                "trust_score": score,
                "contradictions": [],
                "verdict": verdict,
                "summary": "Active certification supports the claim.",
            }
        ),
    )


def test_happy_path_and_storage(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=88, verdict="VERIFIED")
    c.validate_claim(
        "ecothreads",
        "100% organic cotton, fair trade certified",
        "https://fairtrade.org/cert/8841",
        "https://supplier-registry.org/ecothreads",
    )
    assert c.get_trust_score("ecothreads") == 88
    v = json.loads(c.get_claim_verdict("ecothreads", "100% organic cotton, fair trade certified"))
    assert v["verdict"] == "VERIFIED"
    assert v["trust_score"] == 88
    assert v["claim_supported"] is True
    assert isinstance(v["contradictions"], list)
    assert v["checked_at"] > 0


def test_false_claim_low_score(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=12, supported=False, verdict="FALSE", confidence="HIGH")
    c.validate_claim("fastfashion", "ethically made", "https://x.org/c", "https://x.org/r")
    assert c.get_trust_score("fastfashion") == 12
    v = json.loads(c.get_claim_verdict("fastfashion", "ethically made"))
    assert v["verdict"] == "FALSE"


def test_score_clamped(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=-30, supported=False, verdict="FALSE")
    c.validate_claim("brandx", "claim", "https://x.org/c", "https://x.org/r")
    assert c.get_trust_score("brandx") == 0


def test_malformed_llm_json_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": CERT})
    direct_vm.mock_llm(r".*auditor.*", "looks legit to me!")
    with direct_vm.expect_revert("LLM_ERROR"):
        c.validate_claim("brandy", "claim", "https://x.org/c", "https://x.org/r")


def test_fetch_failure_raises_external(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})
    direct_vm.mock_llm(r".*auditor.*", json.dumps({"trust_score": 50, "verdict": "VERIFIED"}))
    with direct_vm.expect_revert("EXTERNAL"):
        c.validate_claim("brandz", "claim", "https://x.org/c", "https://x.org/r")


def test_unknown_brand_defaults(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    assert c.get_trust_score("never-seen") == 0
    out = json.loads(c.get_claim_verdict("never-seen", "x"))
    assert out["error"] == "not_found"


# --------------------------------------------------------------- appeal consensus


def test_validate_claim_with_dispute_id_stores_dispute(direct_vm, direct_deploy, direct_alice):
    """A dispute_id persists the evidence URLs so the claim is appealable."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=88, verdict="VERIFIED")
    c.validate_claim(
        "ecothreads",
        "100% organic cotton",
        "https://fairtrade.org/cert/8841",
        "https://supplier-registry.org/ecothreads",
        "src-1",
    )
    d = json.loads(c.get_verdict("src-1"))
    assert d["resolved"] is True
    assert d["brand_id"] == "ecothreads"
    assert d["verdict"] == "VERIFIED"
    assert d["trust_score"] == 88
    # Brand-keyed views keep working unchanged.
    assert c.get_trust_score("ecothreads") == 88


def test_resolve_appeal_reruns_consensus_from_stored_state(direct_vm, direct_deploy, direct_alice):
    """resolve_appeal re-validates the ORIGINAL stored claim on-chain and
    records an authenticated AppealOutcome — no verdict is passed in."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    # Original round verifies the claim.
    _mock(direct_vm, score=85, verdict="VERIFIED")
    c.validate_claim("greenco", "carbon neutral", "https://x.org/c", "https://x.org/r", "src-appeal-1")

    # Appeal round re-runs consensus; this time the cert reads as expired.
    direct_vm.clear_mocks()
    _mock(direct_vm, score=20, supported=False, verdict="MISLEADING", confidence="HIGH")
    out = json.loads(c.resolve_appeal("src-appeal-1", 1))
    assert out["resolved"] is True
    assert out["round_no"] == 1
    assert out["tolerance"] == 10  # SCORE_TOLERANCE(15) - 5*round(1)
    assert out["original_verdict"] == "VERIFIED"
    assert out["original_trust_score"] == 85
    assert out["appeal_verdict"] == "MISLEADING"
    assert out["appeal_trust_score"] == 20
    assert out["overturned"] is True

    # Persisted + readable (this is what appeal_manager reads cross-contract).
    stored = json.loads(c.get_appeal_outcome("src-appeal-1"))
    assert stored["appeal_verdict"] == "MISLEADING"
    assert stored["overturned"] is True
    # The ORIGINAL dispute record is left intact for comparison.
    assert json.loads(c.get_verdict("src-appeal-1"))["verdict"] == "VERIFIED"


def test_resolve_appeal_tightens_tolerance_each_round(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=70, verdict="VERIFIED")
    c.validate_claim("brandq", "claim", "https://x.org/c", "https://x.org/r", "src-appeal-2")

    assert json.loads(c.resolve_appeal("src-appeal-2", 1))["tolerance"] == 10
    assert json.loads(c.resolve_appeal("src-appeal-2", 2))["tolerance"] == 5
    assert json.loads(c.resolve_appeal("src-appeal-2", 3))["tolerance"] == 5  # floored


def test_resolve_appeal_upheld_not_overturned(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=90, verdict="VERIFIED")
    c.validate_claim("brandu", "claim", "https://x.org/c", "https://x.org/r", "src-appeal-3")
    # Same verdict on re-run → original stands (score drift alone is no overturn).
    out = json.loads(c.resolve_appeal("src-appeal-3", 1))
    assert out["overturned"] is False
    assert out["appeal_verdict"] == "VERIFIED"


def test_resolve_appeal_requires_stored_dispute(direct_vm, direct_deploy, direct_alice):
    """Claims validated WITHOUT a dispute_id are not appealable."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, score=80, verdict="VERIFIED")
    c.validate_claim("brandv", "claim", "https://x.org/c", "https://x.org/r")
    with direct_vm.expect_revert("no resolved dispute to appeal"):
        c.resolve_appeal("brandv", 1)


def test_get_appeal_outcome_not_found(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_appeal_outcome("nope"))
    assert out["resolved"] is False
    assert out["error"] == "not_found"
