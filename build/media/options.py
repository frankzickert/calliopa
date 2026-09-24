#!/usr/bin/env python3
"""What one model takes, asked of the vendor (`BO_0279_001`).

Both vendors describe their own models, and their word is the only one that cannot drift from
what a generation will be refused for: `higgsfield model get <model> --json` answers each
parameter with its `enum` and its `default`, and `openart model form <model> <mode> --json`
answers a JSON Schema its own help calls the source of truth for what `generate` accepts.

The two disagree in spelling — `aspect_ratio` against `aspectRatio`, `1k` against `1K` — so this
normalises them into one vocabulary: an ordered list of axes, each with the values it takes and
the vendor's own default. An axis this service has no flag for is reported under its own name
rather than dropped, so a parameter nobody here has heard of still reaches the person choosing.

Free: a description is not a generation. Standard library only, as the rest is.
"""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any, Callable

# The service's own word for an axis, against what each vendor calls it. A vendor key absent from
# here keeps its own name: `BO_0279_001` says an unknown axis is reported, not dropped.
CANONICAL = {
    "aspect_ratio": "aspect-ratio",
    "aspectRatio": "aspect-ratio",
    "resolution": "resolution",
    "quality": "quality",
    "variant": "variant",
    "background": "background",
    "duration": "duration",
    "genre": "genre",
    "bitrate_mode": "bitrate-mode",
}

# Axes that are not a person's choice: the prompt, the references and the frames are the request
# itself, and a control for them would be nonsense.
NOT_AN_OPTION = {
    "prompt", "image_references", "video_references", "audio_references", "visualReferences",
    "start_image", "end_image", "mask", "is_inpaint", "resume", "seed", "job_id",
    "autoEnhancePrompt", "imageCount", "generate_audio", "remove_bg", "width", "height",
}

# How a chosen value reaches the adapter. `higgsfield-image` already takes named flags;
# `openart-seedream` takes `--param KEY=VALUE`, whose help points at the very schema read here;
# the video adapters take named flags once `BO_0279_002` lands.
FLAG = "flag"
PARAM = "param"

# Which adapters take their axes as `--param KEY=VALUE` rather than named flags, and the vendor's
# own spelling for each canonical axis. The route reports both per model; this is the same truth
# for the sending side, which cannot call the vendor on the path of a press. BO_0279_003
TAKES_PARAMS = {"openart-seedream"}
VENDOR_KEYS = {
    "openart": {"aspect-ratio": "aspectRatio", "resolution": "resolution"},
}


def vendor_key(service: str, axis: str) -> str:
    """The vendor's own name for an axis. An axis nobody renamed keeps its own."""
    return VENDOR_KEYS.get(service, {}).get(axis, axis)


def vendor_bin(service: str) -> str:
    if service == "openart":
        return os.environ.get("OPENART_BIN", "openart")
    return os.environ.get("HIGGSFIELD_BIN", "higgsfield")


def axis_of(name: str) -> str:
    return CANONICAL.get(name, name)


def describe(service: str, model: str, kind: str, *,
             runner: Callable[..., Any] | None = None) -> dict[str, Any]:
    """The axes one model takes, or an empty set with the reason it could not be read.

    Never raises for a vendor that will not answer: a model whose axes are unknown is still
    offered, and a press then sends no options and takes the vendor's own defaults
    (`BO_0279_014`).
    """
    if service == "higgsfield":
        axes, reason = _higgsfield(model, runner=runner)
    elif service == "openart":
        axes, reason = _openart(model, kind, runner=runner)
    else:
        axes, reason = [], f"unknown service {service!r}"
    answer: dict[str, Any] = {"service": service, "model": model, "kind": kind, "axes": axes}
    if reason is not None:
        answer["reason"] = reason
    return answer


def _run(argv: list[str], runner: Callable[..., Any] | None) -> tuple[Any | None, str | None]:
    call = runner or subprocess.run
    try:
        completed = call(argv, capture_output=True, text=True, timeout=60.0)
    except FileNotFoundError:
        return None, f"the {argv[0]} CLI is not installed in this image"
    except subprocess.TimeoutExpired:
        return None, f"the {argv[0]} CLI did not answer"
    if completed.returncode != 0:
        said = (completed.stderr or completed.stdout or "").strip()
        return None, said[-300:] or "the vendor would not describe this model"
    try:
        return json.loads((completed.stdout or "").strip() or "null"), None
    except json.JSONDecodeError:
        return None, "the vendor's description was not JSON"


def _higgsfield(model: str, *, runner: Callable[..., Any] | None
                ) -> tuple[list[dict[str, Any]], str | None]:
    """`model get` answers `params`, each with its `enum` and `default` where it has them."""
    described, reason = _run([vendor_bin("higgsfield"), "model", "get", model, "--json"], runner)
    if described is None:
        return [], reason
    params = described.get("params") if isinstance(described, dict) else None
    if not isinstance(params, list):
        return [], "the vendor named no parameters for this model"
    axes = []
    for param in params:
        if not isinstance(param, dict):
            continue
        name = str(param.get("name") or "")
        values = param.get("enum")
        # Only a closed set is a dropdown. A free string or a number is not a choice this
        # surface can offer, and inventing values for it would be worse than leaving it out.
        if name in NOT_AN_OPTION or not isinstance(values, list) or not values:
            continue
        axes.append({
            "axis": axis_of(name),
            "vendorKey": name,
            "takes": FLAG,
            "values": [str(value) for value in values],
            "default": None if param.get("default") is None else str(param["default"]),
        })
    return axes, None


# What `openart model form` is asked about. An image model is `text2image`; a video model is
# asked as `image2video` first, because a clip is made from a picture here (`BO_0273_045`).
MODES = {"image": ("text2image",), "video": ("image2video", "text2video")}


def _openart(model: str, kind: str, *, runner: Callable[..., Any] | None
             ) -> tuple[list[dict[str, Any]], str | None]:
    """`model form` answers a JSON Schema whose properties carry `enum` and `default`."""
    last = None
    for mode in MODES.get(kind, ("text2image",)):
        described, reason = _run(
            [vendor_bin("openart"), "model", "form", model, mode, "--json"], runner)
        last = reason
        if described is None:
            continue
        schema = described.get("jsonSchema") if isinstance(described, dict) else None
        properties = schema.get("properties") if isinstance(schema, dict) else None
        if not isinstance(properties, dict):
            continue
        axes = []
        for name, described_axis in properties.items():
            values = described_axis.get("enum") if isinstance(described_axis, dict) else None
            if name in NOT_AN_OPTION or not isinstance(values, list) or not values:
                continue
            axes.append({
                "axis": axis_of(name),
                "vendorKey": name,
                # Its adapter takes `--param KEY=VALUE`, which its own help points at this
                # schema for, so an axis reaches the vendor under the vendor's own key.
                "takes": PARAM,
                "values": [str(value) for value in values],
                "default": None if described_axis.get("default") is None
                else str(described_axis["default"]),
            })
        return axes, None
    return [], last or "the vendor would not describe this model"
