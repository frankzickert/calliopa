# CA_0064_FIX_the-settings-leads-wrap

Status: completed

Requested: 2026-09-22, by the user: "the settings page assumes a wide screen. below 1800px the
buttons besides key fields disappear"

The buttons do not go anywhere. The settings view grows wider than the workspace region, the
region clips its horizontal overflow, and the row's trailing controls — *Save*, *Test*, *Clear*
beside a key field, *Save* beside a channel's fields — stand past the clip. This change makes the
view take the region's width, as every other view does, so the row wraps its buttons under the
field instead of losing them.

## Where This Starts

- **The section leads are preformatted.** In `shell.css` the selector `.settings-section__lead,`
  is joined, across a comment, to the `.settings-commands` rule that the Update tab's command log
  and updater log take (`BO_0223_014`): monospace at 0.8rem, a raised ground with a border,
  `overflow-x: auto`, `white-space: pre`. So the three leads — *Keys Calliopa presents…*, *Where
  your work is published…*, *Who holds authority…* — render as one unbreakable line each; the
  Channels lead is 200 characters.
- **An unbreakable line is the view's minimum width.** The lead is a flex item of the view's
  column, and the view is a grid item of `.view-host`, whose one implicit track is `auto`. The
  track grows to the items' min-content contribution, and a line that cannot break contributes
  its whole length; `overflow-x: auto` on the lead does not lower what the lead contributes to
  its parent. `.workspace` is `overflow-x: hidden`, so what the view takes past the region's edge
  is cut off.
- **Measured on the served build** (pin 1472, Chromium, both panels shown, viewport 1280 CSS px):
  the workspace clips at 928px and the host is 864px, the settings view is 1307px, and the key
  row's buttons stand at x 1446–1626. Injecting `white-space: normal` on the leads alone brings the
  view to 864px and the buttons to x 1003–1183, inside the region. Above about 1800px the region is
  wide enough for the longest lead and nothing is clipped, which is the width the report names.
- **The frame already says whose the overflow is.** [Workspace Shell](../system/workspace/frame.md):
  horizontal overflow belongs to the content that has it, never to the region around it. The
  command log honours that with its own `overflow-x: auto`; the view host does not enforce it, so
  any content that cannot break widens the view instead of scrolling inside its own box.

## What This Change Does

- The leads get their own rule and stop sharing the command log's: prose in the muted colour, with
  the paragraph's normal wrapping, the way the People section's facts read. `.settings-commands`
  keeps every declaration it has; nothing about the Update tab's command log or updater log
  changes.
- The view host's track is `minmax(0, 1fr)` rather than `auto`, so a view is handed the region's
  width and never more, and content that cannot break scrolls inside the box that declared its
  overflow — the frame's rule, enforced where the view is mounted. With the leads wrapping this
  changes no pixel today; it is what keeps the next unbreakable line from clipping a row again.
- Verification is the measurement above, repeated on the built stylesheets: at 1280 CSS px with
  both panels shown, the settings view is the host's width, every `.connection__action` lies
  inside the workspace, and the leads wrap; at 1900 the layout is unchanged from today's but the
  leads' face. The command log keeps `white-space: pre` and its own horizontal scroll.
- The release note goes under *Fixed*: the settings page's buttons beside a key field are visible
  at every window width.

## System Tasks

Implemented 2026-09-22: the leads' rule and the view-host guard, both in `shell.css`; `_001`–`_004`
folded to truth. Completed 2026-09-22: promoted to pin 1497 and walked by the user (`_005` folded).

Transferred 2026-09-22: `CA_0064_001`, `_003`, `_004`, `_005` in the settings extension's
[Settings Surface](../../src/extensions/settings/docs/system/settings-surface.md); `CA_0064_002`,
the view-host guard, in [Workspace Shell](../system/workspace/frame.md). The guard is the one line
to strike before ready if the leads' rule is to land alone.
