// One capture: open the address in a fresh browser context behind its own
// proxy, wait for the page to settle within the cap, and hand back the record
// with the PDF and the screenshot. `docs/system/page-capture-service.md`,
// The Service. BO_0277_002
import { refusal } from "./address.mjs";
import { startProxy } from "./proxy.mjs";

// The caps, each a technical choice written with its reason in the system doc:
// a page has the load cap to settle, the render cap to print, and a file above
// the byte cap is dropped rather than answered. After `load` the text settles
// once it has been still for `quietMs`, waited for at most `settleMs`, always
// inside the load cap (BO_0354_001).
export const DEFAULT_CAPS = Object.freeze({
  loadMs: 30_000,
  settleMs: 10_000,
  quietMs: 1_000,
  renderMs: 30_000,
  maxBytes: 25 * 1024 * 1024,
  maxTextChars: 2_000_000,
});

class Refused extends Error {
  constructor(reason) {
    super(reason);
    this.refused = true;
  }
}

class Unreachable extends Error {
  constructor(reason) {
    super(reason);
    this.unreachable = true;
  }
}

function withTimeout(promise, ms, what) {
  let timer;
  const cap = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([promise, cap]).finally(() => clearTimeout(timer));
}

// A cap handed in as undefined — an environment variable that is not set —
// keeps the default rather than replacing it with nothing. Found on the first
// standalone run, where every file was dropped for not finishing "within
// undefined ms".
export function limitsOf(caps = {}) {
  const given = Object.fromEntries(Object.entries(caps).filter(([, value]) => value !== undefined && value !== null));
  return { ...DEFAULT_CAPS, ...given };
}

// A bot challenge stands in front of the page rather than being it: known at
// once by the interstitial's title, or, once the page has settled, by a
// request to a challenge platform from a page that shows next to no text —
// ordinary pages load the platform's script too. Waiting it out reads
// nothing, so the capture stops at it. BO_0354_002
const CHALLENGE_TITLES = [
  /^just a moment\.{0,3}$/iu,
  /^establishing a secure connection/iu,
  /^attention required!?/iu,
  /^checking your browser/iu,
];
const CHALLENGE_REQUEST = /\/cdn-cgi\/challenge-platform\//u;
const CHALLENGE_TEXT_CHARS = 1_000;

export function challengeTitle(title) {
  const trimmed = (title ?? "").trim();
  return CHALLENGE_TITLES.some((pattern) => pattern.test(trimmed));
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function createCapturer({ browser, resolve, dial, caps = {} } = {}) {
  const limits = limitsOf(caps);

  async function capture(target) {
    const decision = await refusal(target, { resolve });
    if (!decision.ok) throw new Refused(decision.reason);

    const started = Date.now();
    const proxy = await startProxy({ resolve, dial });
    const context = await browser.newContext({
      proxy: { server: proxy.server, bypass: "<-loopback>" },
      acceptDownloads: false,
      viewport: { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage();
      page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
      page.setDefaultTimeout(limits.loadMs);

      let challenge = "";
      let challengeRequested = false;
      page.on("request", (request) => {
        if (CHALLENGE_REQUEST.test(request.url())) challengeRequested = true;
      });
      try {
        await page.goto(String(target), { waitUntil: "commit", timeout: limits.loadMs });
      } catch (error) {
        const refused = proxy.refusals[0];
        if (refused) throw new Refused(refused.reason);
        if (/download/i.test(error.message)) throw new Refused("the address is a download, which is not followed");
        throw new Unreachable(error.message.split("\n")[0]);
      }
      const deadline = started + limits.loadMs;
      const left = () => Math.max(1, deadline - Date.now());
      const challenged = async () => {
        if (challenge) return challenge;
        const title = await page.title().catch(() => "");
        if (challengeTitle(title)) challenge = `the page is a bot challenge (${title.trim()})`;
        return challenge;
      };

      // Settling is the text's, not the network's: a page that keeps a
      // request open has settled once its text is still. BO_0354_001
      let settled = false;
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: left() });
        if (!(await challenged())) {
          await page.waitForLoadState("load", { timeout: left() });
          const until = Math.min(deadline, Date.now() + limits.settleMs);
          let last = null;
          let stillSince = Date.now();
          while (!(await challenged())) {
            const now = await page.evaluate(() => (document.body ? document.body.innerText : "")).catch(() => "");
            if (now !== last) {
              last = now;
              stillSince = Date.now();
            } else if (Date.now() - stillSince >= limits.quietMs) {
              settled = true;
              break;
            }
            if (Date.now() >= until) break;
            await pause(Math.min(200, Math.max(1, until - Date.now())));
          }
        }
      } catch {
        settled = false;
      }
      if (!(await challenged()) && challengeRequested) {
        const shown = await page.evaluate(() => (document.body ? document.body.innerText : "")).catch(() => "");
        if (shown.trim().length < CHALLENGE_TEXT_CHARS) challenge = "the page asked a challenge platform to check the browser and shows next to nothing";
      }
      if (challenge) settled = false;
      // A refused navigation fails at the proxy and is caught above; this
      // guards the one shape that could slip through, a page whose own address
      // was refused after it committed.
      const refusedPage = proxy.refusals.find((r) => r.target === page.url());
      if (refusedPage) throw new Refused(refusedPage.reason);

      const title = await page.title().catch(() => "");
      const finalUrl = page.url();
      let text = await page
        .evaluate(() => (document.body ? document.body.innerText : ""))
        .catch(() => "");
      let textTruncated = false;
      if (text.length > limits.maxTextChars) {
        text = text.slice(0, limits.maxTextChars);
        textTruncated = true;
      }

      const files = {};
      const render = async (name, make) => {
        try {
          const bytes = await withTimeout(make(), limits.renderMs, `the ${name}`);
          if (bytes.length > limits.maxBytes) {
            files[name] = { dropped: `larger than the cap of ${limits.maxBytes} bytes (${bytes.length})` };
          } else {
            files[name] = { bytes };
          }
        } catch (error) {
          files[name] = { dropped: error.message.split("\n")[0] };
        }
      };
      // A challenge is not the page, so it is not kept as one. BO_0354_002
      if (!challenge) {
        await render("pdf", () => page.pdf({ format: "A4", printBackground: true }));
        await render("screenshot", () => page.screenshot({ fullPage: true, type: "png" }));
      }

      return {
        url: String(target),
        finalUrl,
        title,
        text,
        textTruncated,
        settled,
        ...(challenge ? { challenged: challenge } : {}),
        elapsed: Date.now() - started,
        blocked: proxy.refusals.map((r) => ({ target: r.target, reason: r.reason })),
        files,
      };
    } finally {
      await context.close().catch(() => {});
      await proxy.close();
    }
  }

  return { capture, limits };
}
