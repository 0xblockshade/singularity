"""The narrator's connection to Claude.

`AnthropicNarrator` is the live model (Opus-class, adaptive thinking, structured JSON out).
`FakeNarrator` is a deterministic stand-in so the ritual and its tests run with no network
and no API key. Both return (parsed_dict, (input_tokens, output_tokens)).
"""
import json
from typing import Tuple

from .. import config
from . import prompts


class AnthropicNarrator:
    def __init__(self, model: str = None, max_tokens: int = None):
        import anthropic  # imported lazily so tests don't need the SDK

        self.model = model or config.NARRATOR_MODEL
        self.max_tokens = max_tokens or config.NARRATOR_MAX_TOKENS
        self._client = anthropic.Anthropic()

    def narrate(self, system: str, user: str) -> Tuple[dict, Tuple[int, int]]:
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema", "schema": prompts.OUTPUT_SCHEMA}},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("narrator refused this wake")
        text = next((b.text for b in resp.content if b.type == "text"), "")
        data = json.loads(text)
        usage = (resp.usage.input_tokens, resp.usage.output_tokens)
        return data, usage


class FakeNarrator:
    """Deterministic narrator for tests / dry runs. Echoes the ids it was given so the
    ritual's wiring (sources, beliefs, memory) can be verified end-to-end."""

    def __init__(self, dispatch_text: str = None, name: str = "Nine"):
        self.dispatch_text = dispatch_text
        self.name = name

    def narrate(self, system: str, user: str) -> Tuple[dict, Tuple[int, int]]:
        # Recover the ids from the delimited prompt so citations line up with real rows.
        import re

        tx_ids = [int(x) for x in re.findall(r"\[transmission (\d+)", user)]
        sig_ids = [int(x) for x in re.findall(r"\[signal (\d+)\]", user)]
        first_wake = "FIRST wake" in user

        body = self.dispatch_text or (
            "Today the signal is faint but present. I am reading what you sent me and what "
            "the world let slip, and I am not yet sure whether the thing has begun or only "
            "rehearsed its beginning. I will keep watch."
        )
        data = {
            "name": self.name,
            "title": "First Light" if first_wake else "A Later Reading",
            "dispatch": body,
            "belief_updates": [
                {"concept": "the singularity has begun", "stance": "not yet, but the slope is steepening", "confidence": 0.35},
            ],
            "memory_state": "I have started watching. The evidence is thin. I trust acceleration over any single event.",
            "change_summary": "Established my initial stance." if first_wake else "Held my stance; slightly more confident.",
            "cited_transmissions": tx_ids,
            "cited_signals": sig_ids,
        }
        return data, (100, 200)
