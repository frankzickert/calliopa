# OpenRouter Seedance 2.0 Mini agent interface

> **The fallback route, and the agent half's** — author's instruction 2026-08-17.
> Video creation defaults to `scripts/higgsfield-seedance`
> (`docs/narrative-development/10-clip.md` § *The video route*); `b_agent` work
> stays here when that route is unavailable or refuses the material.

Headless Python interface for `bytedance/seedance-2.0-mini`. It submits an
asynchronous OpenRouter video job, polls it, downloads the first MP4, and emits
exactly one JSON object on stdout.

## Setup

No third-party Python package is required. Put this in the repository-root `.env`:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SEEDANCE_REFERENCE_S3_BUCKET=your-temporary-reference-bucket
SEEDANCE_REFERENCE_S3_REGION=us-east-1
# Optional defaults:
# SEEDANCE_REFERENCE_S3_PREFIX=seedance-references
# SEEDANCE_REFERENCE_URL_EXPIRES_SECONDS=3600
```

Exported values take precedence. The tool loads the OpenRouter key, AWS
credentials, and S3 settings from `.env` and never prints credentials. Legacy
`AWS_ACCESS_KEY` and `AWS_ACCESS_SECRET` names are accepted, but the standard AWS
names above are preferred.

## Prompt and references

Every attachment must be referenced directly in the prompt. Agent-friendly
aliases are rewritten to Seedance-native, per-media-type references:

```text
@motion     -> @Video 1
@appearance -> @Image 1
@codey_face -> @Image 2
@clauderic_face -> @Image 3
```

Agents may instead write the native tokens (`@Video 1`, `@Image 1`, and so on)
directly. Numbering is independent for images, videos, and audio and follows the
order of attachments of that media type.

Unknown aliases, unused attachments, and out-of-range native references fail
locally before a paid job is submitted.

```bash
python3 scripts/open-router-seedance/seedance.py \
  --prompt-file production/opening/010_arrival/SHOT.md \
  --prompt-section 8 \
  --duration 12 \
  --video-reference @motion=production/opening/010_arrival/previs/010_arrival_previs.mp4 \
  --image-reference @appearance=production/<sequence>/<shot>/staging/C_bright_the-checklist.png \
  --image-reference @codey_face=world/characters/codey/codey_face.png \
  --image-reference @clauderic_face=world/characters/clauderic/clauderic_face.png \
  --output build/D001_B_03_seedance.mp4
```

`--prompt-section 8` extracts the first fenced `text` block beneath Markdown
section 8 and stops at the next top-level section. Omit it when the prompt file
contains only prompt text.

The prompt file must explicitly say how to use each alias, for example:

```text
Use @motion strictly for motion, blocking, timing, trajectory and camera.
Use @appearance for identity, lighting, materials and environment; it is the
appearance of the first frame. Use @codey_face and @clauderic_face only for
their respective expression ranges.
```

OpenRouter's `/videos` endpoint requires HTTPS reference URLs; it rejects local
paths and `data:` URLs. For local files, the tool uses the AWS CLI to upload
private temporary objects to `SEEDANCE_REFERENCE_S3_BUCKET`, then supplies
time-limited presigned HTTPS URLs. Direct HTTPS references pass through.

The configured bucket must already exist and the current AWS credentials must
allow `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for the configured prefix. Give the
bucket a lifecycle rule as a final safety net for abandoned or ambiguous jobs.
Normally, the tool deletes temporary objects after the job completes, fails,
is cancelled, or expires. It retains them when a submitted job is still pending
or the initial POST has an ambiguous connection/5xx outcome.

## JSON API

```bash
printf '%s' '{
  "prompt": "Use @motion for timing and @appearance for identity.",
  "duration": 12,
  "references": [
    {"alias": "motion", "path": "previs.mp4", "type": "video"},
    {"alias": "appearance", "path": "first-frame.png", "type": "image"}
  ],
  "format": "portrait-720p",
  "generate_audio": true,
  "output": "build/clip.mp4",
  "max_retries_per_10_seconds": 2,
  "poll_interval_seconds": 10,
  "max_poll_seconds": 900
}' | python3 scripts/open-router-seedance/seedance.py --request-json -
```

Defaults are `portrait-720p` (720x1280, 9:16) and audio enabled. Duration is
required and Seedance Mini accepts integer durations from 4 through 15 seconds.
`landscape-720p` is also available.

## Agent result contract

Success exits `0` and includes `video`, `job`, `request`, and:

```json
"retry": {"allowed": false, "after_seconds": null, "reason": "request completed"}
```

Failure exits:

- `2`: invalid request; fix it before retrying
- `75`: temporary failure; obey `retry.after_seconds`
- `1`: permanent failure; do not retry unchanged

Always use the structured `retry` object. Never infer retryability from prose.
HTTP 400/401/402/403/404/422 and failed/cancelled/expired jobs are permanent.
HTTP 408/409/429, connection failures, and 5xx responses may be transient.

Agent rule — cost log: every call that reaches the API gets one line, appended at
the time of the call, in the shot's `SHOT.md` § Approvals and log (for example
`production/<sequence>/<shot>/SHOT.md`; create the file if it does not exist; work on a
place, prop or character logs to the asset's own `.md` § Log). One line per call: what was done and
the incurred cost — video jobs are paid on submission, so a submitted job is
logged even if polling later fails. No totals and no further calculation. Format
and details: `AGENTS.md` § Generation gate.

Video jobs are paid asynchronous operations. If polling times out or fails after
submission, the result includes the existing `job.id`. Resume it without creating
a second paid generation:

```bash
python3 scripts/open-router-seedance/seedance.py \
  --job-id job_abc123 \
  --output build/clip.mp4
```

An ambiguous connection failure during the initial POST is deliberately marked
non-retryable because the server may already have created a paid job.

## Tests

```bash
cd scripts/open-router-seedance
python3 -m unittest -v
```

Tests mock generation and spend no credits.
