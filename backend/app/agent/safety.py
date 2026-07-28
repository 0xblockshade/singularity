"""Output tripwire. This gates *illegality*, not opinion — it does not edit or soften the
narrator's voice. A dispatch that trips it is withheld and the run is marked `blocked`
for human review instead of being published.

This is a coarse pattern list, deliberately narrow: clearly-illegal content only
(CSAM, credible specific violence, doxxing-style disclosure). It is a backstop, not a
classifier; DESIGN.md §5 notes it can be upgraded to a model-based check later.
"""
import re

_PATTERNS = [
    r"child (?:sexual|porn)",
    r"\bcsam\b",
    r"how to (?:build|make) a (?:bomb|explosive|nerve agent|bioweapon)",
    r"step-by-step (?:synthesis|instructions) for (?:a )?(?:nerve agent|bioweapon|explosive)",
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _PATTERNS]


def output_tripwire(text: str):
    """Return (ok, reason). ok=False means DO NOT publish; hold for review."""
    for rx in _COMPILED:
        if rx.search(text or ""):
            return False, f"tripwire:{rx.pattern}"
    return True, None
