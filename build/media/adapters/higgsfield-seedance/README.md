# Higgsfield Seedance 2.0 Mini service

> **The default route for video creation** — author's instruction 2026-08-17,
> `docs/narrative-development/10-clip.md` § *The video route*.
> `scripts/open-router-seedance` remains the fallback for the agent half.

Video client for Seedance models on a Higgsfield account — `--model` selects the
job type (`seedance_2_0_mini` is the default, the portrait/free-work route;
`seedance_2_5` verified for the season's 16:9 1080p work, and any attachment on a
non-mini model is submitted as `omni_reference` automatically). Same request
contract, single-JSON-object output and exit codes as
`scripts/open-router-seedance`; the carrier is different.

| | OpenRouter service | this service |
|---|---|---|
| model | `bytedance/seedance-2.0-mini` | `seedance_2_0_mini` |
| transport | HTTPS to `openrouter.ai` | the `higgsfield` CLI |
| credential | `OPENROUTER_API_KEY` | account OAuth session |
| local references | uploaded to S3, presigned, deleted after | uploaded by the CLI |
| billing | OpenRouter credits (USD) | Higgsfield workspace credits |
| first/last frame | not supported | `--start-image` / `--end-image` |

Seedance takes a first frame, a last frame and reference images at the same
time, and they share one nine-image budget. **A single accepted panel belongs
in `--start-image`; boards and identity plates belong in `--image-reference`.**
When every attachment is material and none is a frame, use the storyboard
sibling — it refuses frames outright.

## Setup

```bash
npm i -g @higgsfield/cli
higgsfield auth login                       # browser OAuth, no API key
higgsfield workspace set <workspace_id>     # required; account status fails without it
```

Nothing goes in the repository `.env`. Set `HIGGSFIELD_BIN` or pass
`--higgsfield-bin` if the binary is not on `PATH`.

**Programmatic generation needs a paid plan.** The free plan rejects every
submission before a job exists with `job_minimum_basic_plan_required`, spending
nothing; the service reports that as a permanent `plan_required` error. Web
frontend generation on a free account is unaffected, so check
`higgsfield account status` for the plan, not the credit balance.

If the OAuth callback host is unreachable (remote box, WSL, container), the
login is still recoverable: leave `higgsfield auth login --port 8765` listening,
approve in whatever browser you have, then hand the redirect back to the
listener from the machine running the CLI:

```bash
curl -s "http://127.0.0.1:8765/callback?code=<code>&state=<state>"
```

## A take against an accepted panel

```bash
python3 scripts/higgsfield-seedance/seedance.py \
  --prompt-file production/opening/010_arrival/SHOT.md \
  --prompt-section 7 \
  --duration 8 --format portrait-720p \
  --start-image @panel=production/<sequence>/<shot>/staging/I_day_milo-at-the-grinder.png \
  --image-reference @milo=world/characters/milo/milo_turnaround.png \
  --image-reference @milo_face=world/characters/milo/milo_face.png \
  --image-reference @jade=world/characters/jade/jade_turnaround.png \
  --image-reference @jade_face=world/characters/jade/jade_face.png \
  --output .../D003_A_02_take-r1.mp4
```

`--prompt-section 7` lifts the first fenced block under `# 7. …` verbatim, so
the take prompt is never retyped. Pass `--dry-run` to print the exact
`higgsfield generate create` invocation and spend nothing; do that before every
paid take.

### How attachments are named to the model

Every attachment must be mentioned in the prompt or the request is rejected.
The service prepends a legend naming each one by alias, role and file, and
leaves the author's prompt untouched beneath it:

```text
The attached files, in the order they are attached:
- @panel = the FIRST FRAME of the film, attached as the start frame (I_day_milo-at-the-grinder.png)
- @milo = image reference 1, attached as reference material only (milo_turnaround.png)
...
```

The OpenRouter service rewrites `@alias` into Seedance's native `@Image N`
slots. That syntax is **not** verified on this carrier — the Higgsfield
frontend uses `<<<image_N>>>` instead — so this service gambles on neither and
explains the aliases in plain words. If identity or framing drifts on a take,
`<<<image_N>>>` is the first lever to try.

## Verified model limits

From `higgsfield model get seedance_2_0_mini --json`, 2026-08-16:

- duration is an integer from **4 to 15** seconds (3 and 16 are rejected server-side). **`seedance_2_5` runs to 30 s** — `generate cost` accepts 30 and refuses 31, verified 2026-08-28; the script allows 4–30 on non-mini models
- at most **9** images, **counting `start_image` and `end_image`**; 3 video
  references; 3 audio references; 12 attachments in total
- an audio reference needs at least one image or video attached
- resolution `480p` or `720p` only. **720p is the vertical delivery by choice** (author,
  2026-08-17); 1080p/4k would need `seedance_2_0`, and this script is deliberately not to be
  given a model switch to reach it. 480p is for cheap rehearsals, never a delivery
- aspect ratio `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9`
- `generate_audio` is a real boolean, default true
- optional `genre` and `bitrate_mode`
- **no `seed` parameter** — a request carrying one is rejected locally rather
  than silently dropped

The published `higgsfield-ai/skills` catalogue is stale on two counts: it omits
`seedance_2_0_mini` entirely and claims `seedance_2_0` rejects `generate_audio`.
Trust `higgsfield model list --json` over it.

### Formats

`portrait-720p` and `landscape-720p` behave as in the OpenRouter service.
`portrait-480p` and `landscape-480p` render at 40% of the credit cost, for test
takes. Reported pixel dimensions are the preset's nominal values.

### Cost

Credits are linear in duration: **2.5 per second at 720p**, 1 per second at
480p. Check before submitting, and log every real call in
the shot's `SHOT.md` § Approvals and log:

```bash
higgsfield generate cost seedance_2_0_mini --prompt "..." --duration 8 --resolution 720p --json
```

## JSON

References must be local paths — the CLI uploads them, so a remote URL is
rejected rather than passed through. A `role` of `start`/`first_frame` or
`end`/`last_frame` marks a frame; everything else is reference material.

```json
{
  "prompt": "Use @panel as the shot. Use @hero only for identity.",
  "duration": 8,
  "references": [
    {"alias": "panel", "path": "production/<sequence>/<shot>/staging/panel.png", "type": "image", "role": "start"},
    {"alias": "hero", "path": "world/characters/hero/turnaround.png", "type": "image"}
  ],
  "format": "portrait-720p",
  "generate_audio": true,
  "output": "build/take.mp4"
}
```

Resume an accepted paid job without resubmitting it:

```bash
python3 scripts/higgsfield-seedance/seedance.py --job-id JOB_ID --output build/take.mp4
```

## Exit codes

`0` success · `2` invalid request · `75` temporary, retry per the `retry` block ·
`1` permanent.

`plan_required`, `unauthenticated`, `no_workspace`, `insufficient_credits`,
`cli_missing`, `moderation_blocked`, `invalid_request` and `job_not_found` are
permanent. Only CLI timeouts, connection failures and 5xx downloads are
retryable, and a submission whose outcome is unknown is never retried
automatically — so a paid job is never created twice.

## Response shapes

Verified against a real completed job on 2026-08-17. `generate get --json`
returns `id`, `status: "completed"`, and `result_url` (the mp4), alongside
`min_result_url` and `thumbnail_url`. `video_url_of` scores candidates so the
full render wins over a preview or a thumbnail, and there is a regression test
pinning those exact field names.

The parsers stay tolerant anyway — `job_id_of` also accepts `job_id` / `jobId` /
`job_set_id` / `request_id`, nested or bare — because only one carrier shape has
been observed. If a completed job ever yields no URL, the service raises with
the raw JSON in the message rather than guessing.

## Known quirk

Delivered files land mode `0600`, from `mkstemp` in the shared base's
`_save_video`. The OpenRouter service does the same. `chmod 644` if the file is
going anywhere that matters.

## Tests

```bash
cd scripts/higgsfield-seedance
python3 -m unittest -v
```

26 tests, all offline. They mock the CLI and spend no credits.
