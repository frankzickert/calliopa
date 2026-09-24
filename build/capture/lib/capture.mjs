// One capture: open the address in a fresh browser context behind its own
// proxy, wait for the page to settle within the cap, and hand back the record
// with the PDF and the screenshot. `docs/system/page-capture-service.md`,
// The Service. BO_0277_002
import { refusal } from "./address.mjs";
import { startProxy } from "./proxy.mjs";

// The caps, each a technical choice written with its reason in the system doc:
// a page has the load cap to settle, the render cap to print, and a file above
// the byte cap is dropped rather than answered.
export const DEFAULT_CAPS = Object.freeze({
  loadMs: 30_000,
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

      let settled = true;
      try {
        await page.goto(String(target), { waitUntil: "commit", timeout: limits.loadMs });
      } catch (error) {
        const refused = proxy.refusals[0];
        if (refused) throw new Refused(refused.reason);
        if (/download/i.test(error.message)) throw new Refused("the address is a download, which is not followed");
        throw new Unreachable(error.message.split("\n")[0]);
      }
      const remaining = Math.max(1, limits.loadMs - (Date.now() - started));
      try {
        await page.waitForLoadState("networkidle", { timeout: remaining });
      } catch {
        settled = false;
      }
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
      await render("pdf", () => page.pdf({ format: "A4", printBackground: true }));
      await render("screenshot", () => page.screenshot({ fullPage: true, type: "png" }));

      return {
        url: String(target),
        finalUrl,
        title,
        text,
        textTruncated,
        settled,
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
