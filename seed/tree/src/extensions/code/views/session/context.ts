import { createContextId } from "@builder.io/qwik";

import type { RuntimeRecord, SessionRecord } from "../../lib/types";

/** What the document is connected to, read once by the provider and shared
 * with every send control on the document's code blocks. */
export interface SessionState {
  documentId: string;
  loaded: boolean;
  /** No code surface on this instance: the kernel serves none. */
  reachable: boolean;
  runtime: string | null;
  runtimeName: string;
  runtimeState: string;
  session: SessionRecord | null;
  /** The execution the document's session is running, or "". */
  running: string;
  runtimes: readonly RuntimeRecord[];
  refusal: string;
}

export const SessionContext = createContextId<SessionState>("code.session");
