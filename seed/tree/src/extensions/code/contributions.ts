import { contributions as declare } from "~/contract";

import { SendControl } from "./views/block/send-control";
import { SessionProvider } from "./views/session/provider";
import { RuntimesSection } from "./views/section/runtimes";

/**
 * A document runs code (`BO_0289_019`): this extension owns every surface of
 * it — the Runtimes section where the owner makes and manages runtimes and
 * everyone sees them, the document's connection in its bar, and the send
 * beneath a code block — and nothing else. The `sourcecode` and `output` block
 * types are `documents`', so a code block and its output stay readable when
 * this extension is switched off; the runtimes and the sessions are the
 * stack's code service, reached through the kernel.
 */
export const contributions = declare({
  icon: { title: "Code", name: "terminal-window" },
  sections: [
    { name: "runtimes", title: "Runtimes", empty: "No runtimes yet", component: RuntimesSection },
  ],
  decorations: {
    document: {
      provider: SessionProvider,
      places: { run: SendControl },
    },
  },
});
