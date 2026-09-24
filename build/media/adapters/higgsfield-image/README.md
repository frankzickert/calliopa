# Higgsfield image: GPT Image 2 / 2.5 and Seedream 5.0 Pro

**The image route the user approves call by call** (2026-09-17). One call makes one image through
the account-authenticated `higgsfield` CLI. It emits one JSON object on stdout, exits 0 ok,
2 bad request, 75 retry later or 1 permanent, and uses the `--reference @alias=PATH` contract
shared by the other tools here. It is new in this repo: the blueprint made its `gpt_image_2`
plates by hand in the Higgsfield web app.

| `--model` | Higgsfield job type | Aspect ratios | `--resolution` | `--quality` | Quote (2026-09-17, one reference) |
| --- | --- | --- | --- | --- | --- |
| `gpt_image_2` *(default)* | GPT Image 2 | auto, 1:1, 4:3, 3:4, 16:9, 21:9, **9:16**, 3:2, 2:3, 4:5, 5:4 | 1k, **2k**, 4k | low, medium, **high** | 6.5 credits at 2k high |
| `gpt_image_2_5` | GPT Image 2.5 | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, **9:16**, 21:9, 27:16, 16:27, 9:8, 8:9, 4:5, 5:4 | 1k, **2k**, 4k | low, medium, **high**, xhigh, max | 3 / 5 / 10 credits at 2k high / xhigh / max (2026-09-18); 16 at 4k max |
| `seedream_v5_pro` | Seedream 5.0 Pro | 1:1, 4:3, 3:4, 16:9, **9:16**, 3:2, 2:3, 21:9 | 1k, 1.5k, **2k** | none | 3 credits at 2k |

Bold marks the defaults. **9:16** is the delivery aspect in `world/WORLD.md`. Up to ten references
on any model, all png, jpg or webp (for `gpt_image_2_5` that limit is assumed from GPT Image 2;
`higgsfield model get` does not state one).

`gpt_image_2_5` also takes `--variant flare|sunburst`. The tool always sends it, `flare` when left
out (the service default), so the request log records it. The variant does not change the quote.
`--variant` and the `xhigh` / `max` qualities are refused on the other models.

## Setup

Same as `../higgsfield-seedance/README.md`: `npm i -g @higgsfield/cli`, `higgsfield auth login`,
`higgsfield workspace set <id>`, and a paid plan for CLI submissions. It needs no `.env` entry.
`HIGGSFIELD_BIN` or `--higgsfield-bin` points at a CLI that is not on `PATH`. The transport and
its error vocabulary are imported from `../higgsfield-seedance/seedance.py`, so keep the folders
together.

## One call, the gated way

```bash
# 1. dry run: the exact CLI call, the expanded prompt, the attachments in order, a credit quote. Free.
python3 scripts/higgsfield-image/higgsfield_image.py \
  --prompt-file production/opening/010_arrival/SHOT.md --prompt-section 5 \
  --reference @set=world/places/studio-set/textured/C_holo_set.png \
  --reference @codey=world/characters/codey/codey_turnaround.png \
  --reference @codey_face=world/characters/codey/codey_face.png \
  --output production/opening/010_arrival/staging/panel_v01.png \
  --dry-run

# 2. the user approves that call   3. the same command without --dry-run
```

- **The prompt must name every attachment, and every `@alias` it names must be attached.** A
  legend listing each alias with its position and file goes at the top of what is sent. The
  author's text follows unchanged.
- **`--output` must be versioned** (`_v01`, `_v02`, …) and new. The tool refuses to overwrite.
- **A submission is never retried automatically.** Every call bills. When a job exists but
  polling or download fails, the result carries its id, and `--job-id <id> --output <path>`
  collects it for free. A re-collect never overwrites an image already on disk.
- **Every response body is kept** beside the image: `<name>_vNN.response.json` (the request, the
  submission response and the final job) and `<name>_vNN.prompt.txt` (exactly what was sent).
  They are written even when the call fails.
- A job that fails server-side exits `1`. Higgsfield has refunded such failures before, so check
  the account before re-sending, and re-send under the same version only when nothing came back.

The image comes from the job's top-level `result_url`. The attached plates are under
`params.medias` and are never taken as the result (verified on real jobs 2026-09-17).

## Tests

Offline: the CLI is faked, and nothing is uploaded or spent.

```bash
cd scripts/higgsfield-image && python3 -m unittest discover -p 'test_*.py'
```
