import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

/**
 * Typesetting mathematics, once, for both sites that draw it (`BO_0290_013`).
 *
 * The server renders every equation into the response it sends, and the
 * browser renders the one being edited from a lazy import of this same module.
 * One module because two renderers that could disagree is the bug where an
 * equation looks one way while it is read and another while it is written.
 *
 * **SVG, not CHTML**, and that is the whole answer to the requirement that
 * equations never move the text around them: SVG glyphs are drawn as paths, so
 * nothing waits on a web font and nothing resizes when one lands. Together with
 * rendering on the server it means the markup that arrives already is the
 * equation.
 */

/**
 * Every TeX package the engine carries, each registered by importing its
 * configuration — a name alone is not enough, and MathJax answers an
 * unregistered one with `Package 'x' not found. Omitted.` rather than by
 * failing, so a missing import would silently narrow what an author may write.
 *
 * Four of the forty-two are deliberately absent:
 *
 * - `require` and `autoload` load a package on demand **from a CDN**, which
 *   would let a render reach outside the instance, silently and only for the
 *   equations that happen to need a package (user decision, 2026-09-23; the
 *   finding is `BO_0163`'s, and it still holds in MathJax 4).
 * - `noerrors` and `noundefined` paper over bad TeX — the first renders the
 *   source instead of an error, the second renders an undefined macro as red
 *   text. The block owns the failure presentation, and nothing is ever
 *   repaired on the author's behalf.
 */
import "@mathjax/src/js/input/tex/action/ActionConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/bbm/BbmConfiguration.js";
import "@mathjax/src/js/input/tex/bboldx/BboldxConfiguration.js";
import "@mathjax/src/js/input/tex/bbox/BboxConfiguration.js";
import "@mathjax/src/js/input/tex/begingroup/BegingroupConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js";
import "@mathjax/src/js/input/tex/colorv2/ColorV2Configuration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/dsfont/DsfontConfiguration.js";
import "@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/js/input/tex/fontsizev3/FontSizeV3Configuration.js";
import "@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/js/input/tex/html/HtmlConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/js/input/tex/setoptions/SetOptionsConfiguration.js";
import "@mathjax/src/js/input/tex/tagformat/TagFormatConfiguration.js";
import "@mathjax/src/js/input/tex/texhtml/TexHtmlConfiguration.js";
import "@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js";
import "@mathjax/src/js/input/tex/units/UnitsConfiguration.js";
import "@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js";
import "@mathjax/src/js/input/tex/verb/VerbConfiguration.js";

const PACKAGES = [
  "action",
  "ams",
  "amscd",
  "base",
  "bbm",
  "bboldx",
  "bbox",
  "begingroup",
  "boldsymbol",
  "braket",
  "bussproofs",
  "cancel",
  "cases",
  "centernot",
  "color",
  "colortbl",
  "colorv2",
  "configmacros",
  "dsfont",
  "empheq",
  "enclose",
  "extpfeil",
  "fontsizev3",
  "gensymb",
  "html",
  "mathtools",
  "mhchem",
  "newcommand",
  "physics",
  "setoptions",
  "tagformat",
  "texhtml",
  "textcomp",
  "textmacros",
  "unicode",
  "units",
  "upgreek",
  "verb",
] as const;

/** What a typesetting attempt answers: markup to draw, or a sentence saying
 * why not. One shape, so every caller handles failure the same way. */
export type Typesetting =
  | { readonly svg: string }
  | { readonly failure: string };

interface Engine {
  readonly convert: (tex: string, display: boolean) => string;
}

let engine: Engine | null = null;

/** Built once and kept: constructing the document and its jax per equation
 * would typeset a page of mathematics many times slower for nothing. */
function engineOf(): Engine {
  if (engine !== null) return engine;
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = mathjax.document("", {
    InputJax: new TeX({ packages: [...PACKAGES] }),
    // `local` keeps each equation's glyphs inside its own SVG, so a block
    // drawn on its own — in a proposal, in a card — carries everything it
    // needs to be read.
    OutputJax: new SVG({ fontCache: "local" }),
  });
  engine = {
    convert: (tex, display) =>
      adaptor.outerHTML(document.convert(tex, { display })),
  };
  return engine;
}

/**
 * The memo is what makes typesetting on every read affordable: a document
 * repeating an equation typesets it once, and a re-read of an unchanged
 * document typesets nothing at all. It is bounded because the server process
 * is long-lived and the set of equations it may see is not.
 */
const MEMO_LIMIT = 500;
const memo = new Map<string, Typesetting>();

const remember = (key: string, outcome: Typesetting): Typesetting => {
  if (memo.size >= MEMO_LIMIT) {
    const oldest = memo.keys().next();
    if (!oldest.done) memo.delete(oldest.value);
  }
  memo.set(key, outcome);
  return outcome;
};

/**
 * Typesets TeX, as a display equation or set in the line.
 *
 * **MathJax reports unreadable TeX inside its output rather than by throwing**
 * — as an `merror` node — so a renderer that only caught exceptions would draw
 * an error graphic and call it success. The outcome is checked for the node.
 * The finding is `BO_0163`'s, paid for on the retired shell, and it was
 * confirmed against MathJax 4 before this module was written.
 */
export function typeset(tex: string, display: boolean): Typesetting {
  const source = tex.trim();
  if (source === "") {
    return { failure: "This equation has no source." };
  }
  const key = `${display ? "d" : "i"}:${source}`;
  const remembered = memo.get(key);
  if (remembered !== undefined) return remembered;
  let markup: string;
  try {
    markup = engineOf().convert(source, display);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return remember(key, { failure: `This equation could not be set: ${reason}` });
  }
  if (markup.includes("merror") || markup.includes("data-mjx-error")) {
    return remember(key, {
      failure: "This equation could not be set: the TeX could not be read.",
    });
  }
  return remember(key, { svg: markup });
}

/** Whether an outcome carries markup, so a caller reads it as one question. */
export const isTypeset = (
  outcome: Typesetting,
): outcome is { readonly svg: string } => "svg" in outcome;
