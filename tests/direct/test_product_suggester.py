"""Direct-mode tests for product_suggester.py (curated product roundups)."""

import json

CONTRACT = "contracts/product_suggester.py"

PAGE = (
    "The best noise-cancelling headphones of 2026: our top pick is the "
    "Sony WH-1000XM6 ($399, 9.2/10) for its class-leading ANC. Runner-up: "
    "Bose QuietComfort Ultra ($379, 8.9/10) with plush comfort."
)

LLM_RESULT = {
    "topic": "noise-cancelling headphones",
    "products": [
        {
            "name": "Sony WH-1000XM6",
            "brand": "Sony",
            "price": "$399",
            "rating": "9.2/10",
            "why": "Class-leading ANC.",
            "source_quote": "our top pick is the Sony WH-1000XM6",
        },
        {
            "name": "Bose QuietComfort Ultra",
            "brand": "Bose",
            "price": "$379",
            "rating": "8.9/10",
            "why": "Plush comfort.",
            "source_quote": "Bose QuietComfort Ultra ($379, 8.9/10) with plush comfort",
        },
    ],
    "summary": "Sony leads for ANC; Bose is the comfort runner-up.",
}


def _mock(direct_vm, body=PAGE, llm=None):
    direct_vm.mock_web(r".*", {"status": 200, "body": body})
    direct_vm.mock_llm(r".*curator.*", json.dumps(llm if llm is not None else LLM_RESULT))


def test_happy_path_and_storage(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    c.add_trusted_domain("https://reviews.example.com")
    assert c.is_trusted_domain("reviews.example.com") is True

    direct_vm.sender = direct_alice
    _mock(direct_vm)
    c.refresh_suggestions("Noise-Cancelling Headphones", "https://reviews.example.com/best-anc")

    s = json.loads(c.get_suggestions("noise-cancelling headphones"))
    assert s["topic"] == "Noise-Cancelling Headphones"
    assert s["source_host"] == "reviews.example.com"
    assert s["source_url"] == "https://reviews.example.com/best-anc"
    assert len(s["products"]) == 2
    assert s["products"][0]["name"] == "Sony WH-1000XM6"
    assert s["products"][1]["brand"] == "Bose"
    assert s["summary"]
    assert s["checked_at"]

    topics = json.loads(c.get_topics())
    assert topics["topics"] == ["noise-cancelling headphones"]
    assert c.get_last_updated("Noise-Cancelling Headphones") > 0


def test_seeded_default_domain_works(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    assert c.is_trusted_domain("www.wirecutter.com") is True
    direct_vm.sender = direct_alice
    _mock(direct_vm)
    c.refresh_suggestions("headphones", "https://www.wirecutter.com/best-headphones")
    assert json.loads(c.get_suggestions("headphones"))["products"]


def test_untrusted_source_reverts(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm)
    with direct_vm.expect_revert("untrusted source"):
        c.refresh_suggestions("headphones", "https://sketchy-blog.example.net/top10")


def test_non_owner_add_trusted_domain_reverts(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        c.add_trusted_domain("evil.example.com")


def test_non_owner_remove_trusted_domain_reverts(direct_vm, direct_deploy, direct_bob):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("unauthorized"):
        c.remove_trusted_domain("www.wirecutter.com")


def test_removed_domain_becomes_untrusted(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    c.remove_trusted_domain("www.rtings.com")
    assert c.is_trusted_domain("www.rtings.com") is False
    direct_vm.sender = direct_alice
    _mock(direct_vm)
    with direct_vm.expect_revert("untrusted source"):
        c.refresh_suggestions("monitors", "https://www.rtings.com/monitor/best")


def test_malformed_llm_output_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*", {"status": 200, "body": PAGE})
    direct_vm.mock_llm(r".*curator.*", "looks great, buy the Sony!")
    with direct_vm.expect_revert("LLM_ERROR"):
        c.refresh_suggestions("headphones", "https://www.wirecutter.com/best-headphones")


def test_empty_products_raises_llm_error(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, llm={"topic": "headphones", "products": [], "summary": "none"})
    with direct_vm.expect_revert("LLM_ERROR"):
        c.refresh_suggestions("headphones", "https://www.wirecutter.com/best-headphones")


def test_empty_web_body_raises_external(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm, body="")
    with direct_vm.expect_revert("EXTERNAL"):
        c.refresh_suggestions("headphones", "https://www.wirecutter.com/best-headphones")


def test_unknown_topic_not_found(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.get_suggestions("never-seen"))
    assert out["error"] == "not_found"
    assert c.get_last_updated("never-seen") == 0
    assert json.loads(c.get_topics())["topics"] == []


def test_refresh_same_topic_does_not_duplicate(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    _mock(direct_vm)
    c.refresh_suggestions("headphones", "https://www.wirecutter.com/best-headphones")
    c.refresh_suggestions("Headphones", "https://www.rtings.com/headphones/best")
    topics = json.loads(c.get_topics())
    assert topics["topics"] == ["headphones"]
    # Latest refresh wins.
    s = json.loads(c.get_suggestions("headphones"))
    assert s["source_host"] == "www.rtings.com"
