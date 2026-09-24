# Media Adapters

The generators the media service runs, ported from `filmset`'s `scripts/` on 2026-09-21 under
`BO_0273_003`. They are the upstream tools, not a rewrite: only the constants that located their
siblings changed, so an improvement made on either side transfers as a copy.

| Folder | Makes | Service | Credential |
| --- | --- | --- | --- |
| `higgsfield-image/` | stills, `gpt_image_2` / `seedream_v5_pro` | Higgsfield, through its CLI | `higgsfield auth login` |
| `higgsfield-seedance/` | video takes, Seedance 2.0 mini / 2.5 | Higgsfield, through its CLI | `higgsfield auth login` |
| `openart-seedream/` | stills, Seedream 5 Pro | OpenArt, through its CLI | `openart login` |
| `openart-seedance/` | video takes, Seedance | OpenArt, through its CLI | `openart login` |
| `open-router-seedance/` | — | — | — |

`open-router-seedance/` travels as the **shared base** the others import for their transport, their
error vocabulary, the reference and retry shapes and the prompt expansion — `higgsfield-seedance`
loads it, and `higgsfield-image` and `openart-seedance` load it through their own siblings. **No
route offers it**: OpenRouter's video model needs a reference the open internet can fetch, which
this instance does not serve (`docs/system/media-service.md`, Not Here, and the change `BO_0273`).
Keep the five folders together; each loads its siblings by path.

## What the port changed

- `higgsfield-seedance` finds its base, `higgsfield-image` its transport, and `openart-seedance`
  its two halves, as siblings under this directory rather than under a repository's `scripts/`.
- `open-router-seedance` reads its environment file from `CALLIOPA_MEDIA_ENV`, defaulting to
  `/run/secrets/calliopa/media.env`, where the service's secrets are mounted, rather than from a
  checkout's `.env`.
- Nothing else. The shared contract is unchanged: one JSON object on stdout, exit `0` ok /
  `2` bad request / `75` retry later / `1` permanent, a `retry` block in every result,
  `--reference @alias=PATH` attachments the prompt names by alias, `--dry-run` quoting the cost and
  spending nothing, and `--job-id` / `--resume` collecting a job already paid for.
- Each folder's own `README.md` is the upstream tool's, and its examples still name the blueprint's
  paths and characters. They document the CLI, which is what the service calls.

## Tests

Offline, with the transport mocked and nothing spent:

```bash
for t in infra/media/adapters/*/; do (cd "$t" && python3 -m unittest discover -p 'test_*.py'); done
```

117 tests over the five folders, all passing at the port (2026-09-21). Only `openart-seedream`
needs a package (`Pillow`, see its `requirements.txt`); the rest are standard library only.
