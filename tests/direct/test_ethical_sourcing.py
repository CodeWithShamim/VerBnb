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
