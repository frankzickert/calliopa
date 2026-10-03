import { Lock } from "#host";

/**
 * The app lock, held where the page is (`docs/system/foundation/device.md`,
 * `calliopa-bootstrap`'s BO_0319_048): while the owner has it on, the page is
 * covered when the app opens and whenever it comes back from the background,
 * and uncovered once the device's biometrics or passcode confirm the person.
 * The cover holds nothing of the shell's; the shell under it keeps running. A
 * device with nothing enrolled any more cannot ask, and opens: the lock is the
 * device's own, and without it there is nothing to hold the app with.
 */

const REASON = "Unlock Calliopa";
const COVER = "calliopa-lock";

let asking = false;
/** Who waits for the page to be uncovered. */
let waiting: (() => void)[] = [];

function uncover(): void {
  document.getElementById(COVER)?.remove();
  const resolved = waiting;
  waiting = [];
  for (const resolve of resolved) resolve();
}

function cover(): void {
  if (document.getElementById(COVER) !== null) return;
  const element = document.createElement("div");
  element.id = COVER;
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  element.setAttribute("aria-label", "Calliopa is locked");
  element.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;gap:16px;background:Canvas;color:CanvasText;font:16px/1.5 system-ui";
  const words = document.createElement("p");
  words.textContent = "Calliopa is locked.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Unlock";
  button.style.cssText = "font:inherit;padding:8px 20px";
  button.addEventListener("click", () => void ask());
  element.append(words, button);
  (document.body ?? document.documentElement).append(element);
}

/** Asks the device once; uncovers the page when it confirms the person. */
async function ask(): Promise<void> {
  if (asking) return;
  asking = true;
  try {
    const { authenticated } = await Lock.authenticate({ reason: REASON });
    if (authenticated) uncover();
  } catch {
    // Nothing enrolled to ask with: the device holds nothing, so neither does
    // the app.
    uncover();
  } finally {
    asking = false;
  }
}

/** Covers the page, asks, and resolves once the person is confirmed; the cover's button asks again. */
export function unlock(): Promise<void> {
  cover();
  const unlocked = new Promise<void>((resolve) => waiting.push(resolve));
  void ask();
  return unlocked;
}

/**
 * While the lock is on, covers the page the moment the app goes to the
 * background — so the app switcher's picture holds nothing of it — and asks
 * when it comes back. The device's own prompt can hide the page for a
 * moment; that is not a departure. Registered after the shell is written,
 * since writing a document erases its listeners.
 */
export function lockOnReturn(on: () => Promise<boolean>): void {
  document.addEventListener("visibilitychange", () => {
    if (asking) return;
    if (document.visibilityState === "hidden") {
      void on().then((locked) => {
        if (locked) cover();
      });
      return;
    }
    if (document.getElementById(COVER) !== null) void ask();
  });
}
