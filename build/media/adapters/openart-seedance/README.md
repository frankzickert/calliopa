# Seedance 2.0 Mini on OpenArt

Video client for Seedance 2.0 Mini (OpenArt model id `byte-plus-seedance-2-mini`) through
an OpenArt account. It has the same flags, request JSON, single-JSON-object output and
exit codes as `scripts/higgsfield-seedance`. The request class, the attachment legend
and the flag parsing are loaded from that script. The OpenArt connection (login, model
form, uploads, the generate POST) is loaded from `scripts/openart-seedream`.

| | Higgsfield service | this service |
|---|---|---|
| model | `seedance_2_0_mini` (or `--model`) | `byte-plus-seedance-2-mini` only |
| transport | the `higgsfield` CLI | the `openart` CLI, plus one direct POST |
| credential | Higgsfield OAuth session | `openart login` (`~/.openart/cli-credentials.json`) |
| billing | Higgsfield credits | OpenArt credits |
| start frame **with** references | yes, one call | **refused**, see below |
| `--genre` / `--bitrate-mode` | yes | not in OpenArt's form, so no flags |
| `--seed` | refused on the mini | accepted |
| delivered file | mode `0600` | mode `0644` |

## Setup

Same as the image service: install the CLI and log in once. The steps are in
`scripts/openart-seedream/README.md`. In Claude Code, run `! openart login`.

## Frames and references are separate modes on OpenArt

OpenArt exposes Seedance 2.0 Mini as three modes, each with a closed parameter form
(`additionalProperties: false`, verified 2026-09-11):

- `image2video`: `startFrame` (required) and optionally `endFrame`. No references.
- `element2video`: `visualReferences` (image, video and audio elements). No frames.
- `text2video`: no attachments. This service does not use it, because it requires at
  least one attachment, like the Higgsfield service.

The script picks the mode from the attachments you pass:

- `--start-image` alone, or with `--end-image`, is sent as `image2video`.
- Any mix of `--image-reference`, `--video-reference` and `--audio-reference` is sent as
  `element2video`.
- A start frame together with references is **refused locally with exit 2**, because no
  form accepts both. You have three options:
  - drop the references;
  - attach the panel with `--image-reference` and name it as the opening frame in the
    prompt;
  - send the take through `scripts/higgsfield-seedance`, which takes both.
- An end frame without a start frame is also refused.

## A take

```bash
python3 scripts/openart-seedance/seedance.py \
  --prompt-file narrative/.../CLIP.md --prompt-section 7 \
  --duration 8 --format portrait-720p \
  --image-reference @milo=world/characters/milo/milo_turnaround.png \
  --image-reference @milo_face=world/characters/milo/milo_face.png \
  --image-reference @cafe=production/<sequence>/<shot>/staging/I_day_milo-at-the-grinder.png \
  --output .../take-r1.mp4
```

Always pass `--dry-run` first. It validates the request and checks the body against the
live model form. It prints the body with placeholder uploads and OpenArt's credit quote.
It uploads nothing and sends nothing. The quote is for the config that the quote itself
names (the server default: 5 s, 16:9, 720p). That config is not your request, so the
quote is not the cost of this take.

Every attachment must be named in the prompt. The prompt is sent with the Higgsfield
service's legend on top, which names each alias with its role and file. The labels
OpenArt receives are the aliases. `autoEnhancePrompt` is sent as `false` in
`element2video`, so OpenArt does not rewrite the prompt.

References must be local files (jpg, jpeg, png, webp, heic, heif, mp4, mov, qt, mp3,
wav, m4a, flac, aac). The CLI uploads them, and the uploads stay in the OpenArt library.
Limits are the Higgsfield service's: at most 9 images, 3 videos, 3 audios and 12
attachments in total. An audio element needs an image or a video beside it.

## Formats

| `--format` | aspect | resolution | nominal size |
|---|---|---|---|
| `portrait-720p` (default) | 9:16 | 720p | 720x1280 |
| `landscape-720p` | 16:9 | 720p | 1280x720 |
| `portrait-480p` | 9:16 | 480p | 480x854 |
| `landscape-480p` | 16:9 | 480p | 854x480 |

480p is for rehearsals. The form allows only 480p and 720p, and duration from 4 to 15
seconds. The reported pixel sizes are the preset's nominal values and are not measured
from the file.

## JSON

A request JSON written for `scripts/higgsfield-seedance` runs unchanged. A `model` of
`seedance_2_0_mini` or `byte-plus-seedance-2-mini` is accepted, and any other model is
refused.

```json
{
  "prompt": "Use @panel as the shot.",
  "duration": 8,
  "references": [
    {"alias": "panel", "path": "production/<sequence>/<shot>/staging/panel.png", "type": "image", "role": "start"}
  ],
  "format": "portrait-720p",
  "output": "take.mp4"
}
```

## One paid call, never resent

- The form check, the account check and the token refresh all run before the first
  upload. A value the form refuses exits `2` and spends nothing.
- The POST is made once. A connection that drops during submission comes back
  non-retryable, because the call may have been charged. Check
  `openart creation list --limit 3` before you send again.
- HTTP 429 and 5xx come back with `retry.allowed=true`. The script never resends a paid
  call by itself.
- Polling runs `openart creation get <history-id>`. If the clip is not back within
  `--max-poll-seconds` (default 900), or the download fails, the result carries
  `job.id`. Collect the clip without paying again:

  ```bash
  python3 scripts/openart-seedance/seedance.py --job-id <history-id> --output take.mp4
  ```

## Output

The output has the same shape as the Higgsfield service's output. `job.id` is the
OpenArt history id. `job.usage` records the credit balance before and after the call:

```json
{"ok": true, "attempts": 3,
 "job": {"id": "…", "status": "completed",
         "usage": {"credits_before": 21054, "credits_after": 20734, "credits_spent": 320}},
 "video": {"path": "/abs/take.mp4", "bytes": 1234567, "width": 720, "height": 1280,
           "duration": 8, "preset": "portrait-720p", "format": "mp4"},
 "request": {"model": "byte-plus-seedance-2-mini", "service": "openart", "openart_mode": "element2video", "…": "…"},
 "retry": {"allowed": false, "after_seconds": null, "reason": "request completed"}}
```

`credits_spent` is the difference between the two balances. It is wrong if another
generation runs on the account at the same time. Log it as the call's cost, following
`AGENTS.md` § Generation gate.

Exit codes: `0` success · `2` invalid request · `75` temporary, read `retry` · `1`
permanent (including `not_logged_in`, `insufficient_credits`, `upload_failed`).

## Not yet verified live

Up to 2026-09-11 only dry runs have been made. No paid generation has run yet. Four
things are inferred rather than observed:

- the body shape, which is inferred from the forms and from the CLI's own `image2video`
  dry run;
- the `creation get` status strings while a generation is running;
- where the video URL sits in a completed video record;
- whether video and audio elements need metadata beyond `{type, id, url, label}`.

If the first take fails on any of these, the error message carries the raw response.

## Tests

```bash
cd scripts/openart-seedance
python3 -m unittest -v
```

The suite has 27 tests, all offline. The CLI, the POST and the download are fakes, so
the tests spend no credits.
