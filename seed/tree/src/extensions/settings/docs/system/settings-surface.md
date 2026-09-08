# Settings Surface

## The Settings Surface

* Settings is reached from a control in the shell header, which opens settings in a tab.
* The tab is sectioned, `Connections` is the first section, `Channels` is the second, and `People` is the third.

- The header is already the row for chrome belonging to the instance rather than to any document: the theme toggle, the layout controls, and the process indicator. A settings control is the same kind of thing and takes the same idiom — a transparent icon button that gains a surface on hover.
- Settings opens as a tab so it inherits everything a tab already does, rather than becoming a second kind of place with its own rules. The tab kind, its synthetic target, and the reveal that follows from it are in [Workspace Shell](../../../../../docs/system/workspace/tabs.md).
- Human sign-in is the kernel's (`ui-kernel.md`, `BO_0208_005`), and in prod its public port shows an anonymous browser nothing but sign-in (`BO_0214_009`); the settings tab is reached signed in, like the rest of the shell.
- `People` (since `BO_0209`, 2026-09-08) is who holds authority in this instance, read from the kernel's account routes as the signed-in person on every visit and cached nowhere: each principal's name, kind, class, state, whether it is the owner, when its credential was last used and when its session was last active. The owner's controls — suspend, resume or reactivate, retire, and the move between the class that may establish truth and the class that proposes only — and the form adding a person with an initial password handed over out of band are calls the core refuses on its own terms; a refusal is shown in the section in the core's words with its code, `unlicensed` for a second authority-holding human without a licence and `forbidden` for anyone but the owner. Above the list the section states the active count and the licence: one of one seats and no licence, or the count alone with the licensee and the expiry. Every signed-in person changes their own password with the current one, which signs their other sessions out. Nothing in the section decides anything; a fork that redraws it changes nothing about who may write.
- Themes, layout, and anything else that might later belong in settings are not moved into the tab here. Sections are the extension point, and a section arrives with the change that needs it.
- A connection row reads as one thing: its party, its state, whether a key is set with its last characters, and one error at a time. A row shows the error from its last test or the error from the request the reader just made, never both.
- The settings view reports no save state and contributes no dock action. A key is saved by a press, not by typing, so there is nothing for the header to say about it.

- `src/components/views/settings.tsx` is the view. It renders the sectioned tab and the `Connections` section, and a row shows the party, what it needs a key for, its state, the last characters when a key is set, and its last error. The component is never handed a secret, so there is nothing in it that could render one (`CA_0021_006`).
- Every request re-reads the row the server answered rather than patching one in the browser, so the surface cannot disagree with what the next read would say. One request is in flight at a time and its row's controls are disabled while it runs (`CA_0021_006`).
- `tests/browser/settings.spec.ts` proves saving a key showing that it is set and its last characters and never the key, a reload showing the same, `Test` with a key the service refuses moving the row to `failing` with the message that came back, `Clear` returning the row to `unconfigured`, and the axe scan clean (`CA_0021_006`).
- The key flow runs on desktop only, while both form factors prove the tab it lives in. Connections are instance-wide, so there is no per-scenario connection the way there is a per-scenario workspace, and two form factors driving the one row at once would be a race rather than a proof. What differs between them is the surface, not what saving a key does, and the store itself is proven against real Postgres (`CA_0021_006`).


