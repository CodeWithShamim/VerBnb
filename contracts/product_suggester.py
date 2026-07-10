# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Product Suggester (curated product roundups)

Fetches product-roundup/review pages from an owner-approved allowlist of
trusted sites, has validator LLMs extract and curate the best products,
reaches consensus, and stores the curated suggestions on-chain for the
frontend to display. Validators independently re-extract the products and
agree when at least half of the leader's product names overlap their own.
"""

import json
from datetime import datetime, timezone

from genlayer import *

MAX_PAGE_CHARS = 2000
MAX_PRODUCTS = 5
MAX_FIELD_CHARS = 300
NAME_OVERLAP_RATIO = 0.5

PRODUCT_FIELDS = ("name", "brand", "price", "rating", "why", "source_quote")

DEFAULT_TRUSTED_DOMAINS = ("www.wirecutter.com", "www.rtings.com")


def _normalize_domain(domain: str) -> str:
    """Lower-cased hostname: strips scheme and any path if present."""
    d = domain.strip().lower()
    if "//" in d:
        d = d.split("//", 1)[1]
    return d.split("/", 1)[0]


def _host_of(url: str) -> str:
    """Hostname from a URL via simple string parsing (no urllib in the VM)."""
    rest = url.split("//", 1)[1] if "//" in url else url
    return rest.split("/", 1)[0].strip().lower()


def _fetch(url: str) -> str:
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception as e:
        raise gl.vm.UserError(f"EXTERNAL: failed to fetch {url}: {e}")
    if not content:
        raise gl.vm.UserError(f"EXTERNAL: empty content from {url}")
    return content[:MAX_PAGE_CHARS]


def _build_prompt(topic: str, page_text: str) -> str:
    return f"""You are an impartial product curator. Below is the text of a product
roundup/review page. Extract the best products for the topic, judged ONLY
from the fetched text. Do not invent products, prices, or ratings that are
not present in the text.

TOPIC: "{topic}"

PAGE CONTENT:
<page>
{page_text}
</page>

Respond with ONLY a JSON object, no markdown, no prose, exactly these keys:
{{
  "topic": short string,
  "products": array of at most {MAX_PRODUCTS} objects, each with string keys
    "name", "brand", "price", "rating", "why", "source_quote"
    ("source_quote" must be copied verbatim from the page text),
  "summary": short string
}}
Output must be parseable by a strict JSON parser with no surrounding text."""


def _curate(topic: str, source_url: str) -> dict:
    page_text = _fetch(source_url)

    result = gl.nondet.exec_prompt(
        _build_prompt(topic, page_text),
        response_format="json",
    )

    if not isinstance(result, dict):
        raise gl.vm.UserError(f"LLM_ERROR: expected JSON object, got {type(result).__name__}")

    products = result.get("products")
    if not isinstance(products, list) or not products:
        raise gl.vm.UserError("LLM_ERROR: products must be a non-empty list")

    cleaned = []
    for entry in products[:MAX_PRODUCTS]:
        if not isinstance(entry, dict):
            raise gl.vm.UserError(f"LLM_ERROR: product entry is not an object: {entry!r}")
        product = {f: str(entry.get(f, ""))[:MAX_FIELD_CHARS] for f in PRODUCT_FIELDS}
        if not product["name"]:
            raise gl.vm.UserError("LLM_ERROR: product entry missing name")
        cleaned.append(product)

    return {
        "topic": str(result.get("topic", topic))[:MAX_FIELD_CHARS],
        "products": cleaned,
        "summary": str(result.get("summary", ""))[:1000],
    }


def _names_agree(leader_products: list, own_products: list) -> bool:
    """True when >= NAME_OVERLAP_RATIO of leader names fuzzy-match own names."""
    leader_names = [
        str(p.get("name", "")).casefold() for p in leader_products if isinstance(p, dict)
    ]
    leader_names = [n for n in leader_names if n]
    if not leader_names:
        return False
    own_names = [p["name"].casefold() for p in own_products]
    matched = sum(
        1 for ln in leader_names if any(ln in on or on in ln for on in own_names)
    )
    return matched >= NAME_OVERLAP_RATIO * len(leader_names)


class ProductSuggester(gl.Contract):
    owner: str
    trusted_domains: TreeMap[str, bool]
    suggestions: TreeMap[str, str]
    last_updated: TreeMap[str, u256]
    topics: DynArray[str]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address.as_hex.lower()
        for domain in DEFAULT_TRUSTED_DOMAINS:
            self.trusted_domains[domain] = True

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex.lower()

    def _only_owner(self) -> None:
        if self._sender() != self.owner:
            raise gl.vm.UserError("unauthorized: owner only")

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def add_trusted_domain(self, domain: str) -> None:
        self._only_owner()
        d = _normalize_domain(domain)
        if not d:
            raise gl.vm.UserError(f"invalid domain: {domain}")
        self.trusted_domains[d] = True

    @gl.public.write
    def remove_trusted_domain(self, domain: str) -> None:
        self._only_owner()
        d = _normalize_domain(domain)
        if d in self.trusted_domains:
            del self.trusted_domains[d]

    @gl.public.write
    def refresh_suggestions(self, topic: str, source_url: str) -> None:
        display_topic = topic.strip()
        if not display_topic:
            raise gl.vm.UserError("invalid topic: empty")
        key = display_topic.lower()

        host = _host_of(source_url)
        if not host or host not in self.trusted_domains:
            raise gl.vm.UserError(f"untrusted source: {host}")

        def leader_fn() -> dict:
            return _curate(display_topic, source_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                own = _curate(display_topic, source_url)
            except Exception:
                return False
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or not isinstance(leader.get("products"), list):
                return False
            return _names_agree(leader["products"], own["products"])

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        now = datetime.now(timezone.utc)
        if key not in self.suggestions:
            self.topics.append(key)
        self.suggestions[key] = json.dumps(
            {
                "topic": display_topic,
                "products": result["products"],
                "summary": result["summary"],
                "source_url": source_url,
                "source_host": host,
                "checked_at": now.isoformat(),
            }
        )
        self.last_updated[key] = u256(int(now.timestamp()))

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_suggestions(self, topic: str) -> str:
        key = topic.strip().lower()
        v = self.suggestions.get(key)
        if v is None:
            return json.dumps({"error": "not_found", "topic": topic})
        return v

    @gl.public.view
    def get_topics(self) -> str:
        return json.dumps({"topics": [str(t) for t in self.topics]})

    @gl.public.view
    def is_trusted_domain(self, domain: str) -> bool:
        return _normalize_domain(domain) in self.trusted_domains

    @gl.public.view
    def get_last_updated(self, topic: str) -> int:
        return int(self.last_updated.get(topic.strip().lower(), u256(0)))
