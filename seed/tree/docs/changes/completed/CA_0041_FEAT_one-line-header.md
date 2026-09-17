# CA_0041_FEAT_one-line-header

Status: completed

Requested: 2026-09-10 by the user. The header is one line, as tall as the laurel and the *Calliopa* wordmark. On a phone the tab heads sit below that line and nothing else does, which means the line has to use less space.

## Where This Starts

At dataRevision 284:

- **The header's height follows whatever it holds.** `.shell-header` in `src/components/shell/shell.css` is a flex row around the wordmark (1.2rem, with the laurel 1.55em tall). On a phone the row wraps (`flex-wrap: wrap`), so the controls take as many lines as they need. The tab strip gets its own row through `order: 10`.

- **Three controls are words.** The theme toggle (`theme-toggle.tsx`) shows its choice as text: `light`, `dark` or `system`. The signed-in person is shown as three things: the name, a class phrase (`may establish` or `proposes`) and a *Sign out* button (`.identity` in `shell.tsx`, `BO_0209_003`). The owner's update hint reads *Update available: <version>* on both form factors (`BO_0223_013`). Settings (`⚙`) and the layout controls (`◧`, `◨`) are text characters, not Phosphor icons.

- **The licence warning is a paragraph.** It grows into the free width and wraps (`.licence-warning`, `BO_0209_005`), so while it shows it can make the header several lines tall on either form factor.

- **The phone's sheet handles** (`.sheet-handle`) are fixed 0.7rem from the top, at the left and right edges, and are 2.75rem tall. They sit in the 2.25rem the header reserves on each side (`padding-inline`). That reservation works and stays.

## Intent

* The header is always one line, as tall as the laurel and the *Calliopa* wordmark. This holds on both form factors, whatever the line holds.

* On a phone, the tab strip sits below that line. It is the one exception, and the header takes no more height than those two rows.

* On a phone, the library and inspector sheet handles sit centered vertically on the header's line, at the left and right edges as now. The header keeps reserving that space on both sides.

* The theme choice is an icon toggle using Phosphor icons. It still cycles `light → dark → system`.

* The signed-in person is one icon button, Phosphor `user`, at the very right of the line. Pressing it shows the person's name and role below it, with a *Sign out* menu item.

* On a phone, the owner's update hint is a single icon, styled as the hint is now (accent border and accent colour).

## The Shape

- **Theme.** The icon shows the current choice, as the word does now: `sun` for `light`, `moon` for `dark` and `circle-half` for `system`. The accessible name stays `Theme: <choice>. Switch theme`. The pre-paint choice, the storage and the cycle do not change.

- **The person button.** It uses the chrome's transparent icon-button style. It is named `Signed in as <name>. Account` and carries `aria-haspopup` and `aria-expanded`. A screen reader therefore still announces the person before they act, even if the menu is never opened.

- **The person menu.** It opens as a list under the button, aligned to the right edge. It follows the agent menu's pattern (`BO_0228_011`), opening downward instead of upward. It shows the name, the role in the words the header uses now (`may establish` or `proposes`), and *Sign out*, which does what the button does now. A press outside, Escape or a second press on the button closes it.

- **Update on a phone.** Phosphor `arrow-circle-up` sits inside the hint's accent border. Its accessible name stays as now: `Update available: <version>. Open the Update tab`. The desktop keeps the words.

- **One line.**

- On a phone the line no longer wraps.

- No control in the line is taller than the wordmark, so the wordmark sets the height.

- The order is: wordmark, tabs (desktop only), save state, process indicator, layout controls (desktop only), licence warning, update hint, settings, theme, person.

- **Less space on a phone.**

- The line's gap and the icon buttons' padding shrink, so that the owner's full set fits on the line at 360 CSS px wide, inside the reserved sides. The full set includes the save state, the update hint and the licence warning.

- **Save state on a phone.** It is an icon on the line, named by its word: `cloud-arrow-up` for `Saving`, `cloud-check` for `Saved` and `cloud-warning` for `Unsaved`. A view that reports no save state shows none, as now.

- **The handles.** Each handle's middle sits at the line's middle, at its edge as now, and its size does not change.

- **Icons.** `sun`, `moon`, `circle-half`, `arrow-circle-up`, `cloud-arrow-up`, `cloud-check`, `cloud-warning`, `gear` and `sidebar-simple` join the table in `src/components/shell/icons.tsx`, with the path data unaltered from `@phosphor-icons/core@2.1.1`. `user` and `warning` are already in the table. The right drawer's control shows `sidebar-simple` mirrored by a transform, so its path data stays unaltered too.

- **Fixed line.** The fixed Desktop Layout line that lists what the header holds gains the person control. This request is the user's input for that change.

- **Transfer targets.**

- `workspace/layout.md`: the Desktop Layout header line, the chrome idiom (settings and the layout controls as icons), the update hint, the licence warning and Mobile Layout.

- `workspace/themes.md`: the toggle.

- `workspace/frame.md`: the phone's two header rows.

- `workspace/tabs.md`: settings sitting "beside the theme toggle", and the save state as an icon on a phone.

- `identity/api-authentication.md`: the header naming the person.

## Decided

* **Save state on a phone:** an icon on the line. The desktop keeps the words beside the tab strip. User decision, 2026-09-10.

* **Licence warning:** on both form factors, a Phosphor `warning` icon button in the error colour, named by the licensor's text. A press shows the text below it, the way the person menu opens, and it closes the same ways. It stays as long as the licence does, as now. User decision, 2026-09-10.

* **Person icon:** `user` for everyone, whatever the person's class. The name and the role are in the menu and in the button's accessible name. User decision, 2026-09-10.

* **Settings and layout controls:** they become Phosphor icons in this change: `gear` for settings, `sidebar-simple` for the left drawer's control and the same icon mirrored for the right. Their accessible names do not change. User decision, 2026-09-10.

## Verification

- **Qwik's render harness,** through the shell's own JSX:

- Press the theme toggle through its three choices, and the icon changes each time.

- Press the person button, and the name, the role and *Sign out* show.

- The menu closes on a press outside, on Escape and on a second press. The licence warning's text opens on a press and closes the same ways.

- **The served build, on a desktop and on a phone at 360 CSS px,** signed in as the owner with an update available:

- The header's line is the wordmark's height with every control shown, and it does not wrap.

- On the phone, the tab strip is the only row below the line.

- The handles sit centered on the line and open their sheets.

- *Sign out* lands on the sign-in page.

## Transfer

Transferred on 2026-09-10 as `CA_0041_001`–`CA_0041_009` into the shell's docs, staged as `node:chg-46210a9c1c28a434`. `_001` is in `docs/system/workspace/themes.md`, `_006` is in `docs/system/workspace/tabs.md`, and the rest are in `docs/system/workspace/layout.md`, beside two new fixed lines for the header: it is one line as tall as the wordmark on both form factors, and on a phone it is no taller than that line plus the tab strip, with the handles centered on the line. `_001`–`_006` come in any order, except that `_004` follows `_003`, whose menu it reuses. `_007` and `_008` come after all of them, and `_009` after promotion. One technical choice was made at the transfer: the person menu is its own component, so the render harness can mount it.
