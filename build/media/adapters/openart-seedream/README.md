# Seedream 5.0 Pro on OpenArt

Headless Python interface for generating images with ByteDance's Seedream 5.0 Pro
(OpenArt model id `byte-plus-seedream-5-pro`) through OpenArt, with the same `@alias` reference handling as
`scripts/gpt-image`. It emits exactly one JSON object on stdout and uses the same exit
codes.

## How it talks to OpenArt

OpenArt has no API key. Its CLI (`openart`) signs in through the browser and keeps the
credential in `~/.openart/cli-credentials.json`. The script uses the CLI for what sits
behind that login:

- the credit balance, read before and after each call
- the model's parameter form
- reference uploads
- polling

The script makes one call itself, `POST https://openart.ai/suite/api/cli/v1/generate`, using
the CLI's own request body. It does this because `openart generate image` sends no
aspect ratio, and a staging still has to come back 9:16.

Every parameter is checked against `openart model form byte-plus-seedream-5-pro image2image`
before anything is uploaded or charged. If the form rejects a value, you get exit `2`
and spend nothing.

## Setup

```bash
# the CLI (checksum-verified; installs to ~/.local/bin when /usr/local/bin is not writable)
curl -fsSL https://raw.githubusercontent.com/OpenArt-AI/cli/main/install.sh | sh
openart login          # browser OAuth; in Claude Code type: ! openart login
openart account        # plan and credits

python3 -m pip install -r scripts/openart-seedream/requirements.txt
```

## Direct CLI

Same shape as a gpt-image invocation: a prompt file, one `--reference` per `@alias`, a
format, and an output.

```bash
python3 scripts/openart-seedream/seedream.py \
  --prompt-file versions/K1_v01.prompt.txt \
  --reference @the_shop=inputs/the-shop_office.png \
  --reference @codey=inputs/codey_turnaround.png \
  --reference @codey_face=inputs/codey_face.png \
  --reference @codey_hands=inputs/codey_hands.png \
  --reference @clauderic=inputs/clauderic_turnaround.png \
  --reference @clauderic_face=inputs/clauderic_face.png \
  --reference @reply=inputs/reply_sheet.png \
  --format portrait-720p \
  --output versions/K1_v01.png
```

References are sent in the order given, at most ten. Each one is a local file (jpg,
png, webp or heic, uploaded by the CLI) or a URL already on `https://cdn.openart.ai/`.
The prompt that is sent gets a legend at the top, and each `@alias` is rewritten as
`Image N (@alias)`. The label on each reference is its alias. An `@alias` in the prompt
with no matching `--reference` is a local error.

`--dry-run` prints the full request (the params, the expanded prompt, and the quoted
credit cost when you are logged in) and uploads and sends nothing. It also works when
you are logged out, but then the params are not checked against the form.

Any other parameter the form offers goes through `--param key=value`. As of
2026-09-11 the form offers `resolution` (`1K` default, or `2K`), `imageCount` (1–8) and
`autoEnhancePrompt` (default `false`; leave it off, or OpenArt rewrites the prompt).
Unknown keys, values outside the form's enum, and wrong types fail locally. `prompt`,
the references, and the aspect ratio are set by the script, not by `--param`.

## Formats

| `--format` | Aspect sent | Saved |
| --- | --- | --- |
| `portrait-720p` | `9:16` | exactly `720x1280` (center-crop, Lanczos) |
| `landscape-1080p` | `16:9` | exactly `1920x1080` |
| `portrait` · `landscape` · `square` | `9:16` · `16:9` · `1:1` | the pixels Seedream returns |

Seedream renders at `1K` unless you pass `--param resolution=2K`. The quote on
2026-09-11 was 30 credits per image at 1K, and 2K costs twice as much. Every reference
after the first may add a credit. `--dry-run` prints the current quote, and
`credits.spent` records what was actually charged.

The native-resolution original stays in OpenArt's history. Its URL is in
`image.source_url` of the JSON.

## One paid call, never retried

The submission is never resent automatically, whatever the failure:

- **HTTP 429/5xx:** `retry.allowed=true` with `after_seconds`; the decision to resend
  is yours.
- **Connection dropped during the submission:** `ambiguous_submission`. The call may
  have been charged. Check `openart creation list --limit 3` before sending again.
- **Result not back within `--timeout-seconds` (default 600):** exit `75` with
  `error.kind=still_running` and a `resume` string. Collect it with `--resume
  <history-id>`, which uploads and sends nothing.

  ```bash
  python3 .../seedream.py --resume <history-id> --format portrait-720p --output versions/K1_v01.png
  ```

## Output

```json
{
  "ok": true,
  "submitted": true,
  "history_id": "…",
  "image": {"path": "/abs/versions/K1_v01.png", "width": 720, "height": 1280,
            "native_width": 1536, "native_height": 2730, "upscaled": false,
            "preset": "portrait-720p", "source_url": "https://cdn.openart.ai/…"},
  "credits": {"before": 1200, "after": 1190, "spent": 10},
  "retry": {"allowed": false, "after_seconds": null, "reason": "request completed"}
}
```

Cost log: one line per call that reaches the API, in the shot's `SHOT.md` § Approvals and log
or the asset's own `.md` § Log, following `AGENTS.md` § Generation gate. The cost is
`credits.spent`, in OpenArt credits.

Exit codes:

- `0`: image generated (or dry run printed)
- `2`: invalid local request, not logged in, or an upload/form lookup failed; nothing
  was sent
- `75`: temporary failure or still running; read `retry` and `resume`
- `1`: permanent failure; do not resend unchanged

## Tests

The tests replace the CLI and the HTTP call with fakes, so they spend no credits:

```bash
cd scripts/openart-seedream
python3 -m unittest -v
```
