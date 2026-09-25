import { stripEscapes } from "~/extensions/documents/lib/traceback";

/**
 * What the send control shows of an execution as it streams (`BO_0289_023`):
 * each event the kernel forwards becomes one line beneath the button — a
 * stream's text, a display's or a result's plain text, a cut in words — and
 * an error becomes its traceback, escapes stripped, marked as an error so the
 * control draws it in the traceback's colours as the output block will once
 * the proposal is read (`BO_0296_019`). Events that show nothing answer null.
 */
export interface LiveLine {
  readonly kind: "text" | "error";
  readonly text: string;
}

export function liveLine(event: Record<string, unknown>): LiveLine | null {
  switch (event["event"]) {
    case "stream":
      return { kind: "text", text: String(event["text"] ?? "") };
    case "error": {
      const traceback = Array.isArray(event["traceback"]) ? (event["traceback"] as unknown[]).filter((line): line is string => typeof line === "string") : [];
      const said = traceback.length > 0 ? traceback.map(stripEscapes).join("\n") : `${String(event["name"] ?? "")}: ${String(event["value"] ?? "")}`;
      return { kind: "error", text: `${said.replace(/\n$/u, "")}\n` };
    }
    case "display":
    case "result": {
      const data = (event["data"] ?? {}) as Record<string, unknown>;
      const plain = data["text/plain"];
      return { kind: "text", text: typeof plain === "string" ? `${plain}\n` : "a picture\n" };
    }
    case "cut":
      return { kind: "text", text: `[cut: ${String(event["reason"] ?? "")}]\n` };
    default:
      return null;
  }
}
