import { kernelState } from "~/server/kernel/client";

import { DEFAULT_STYLE, isStyleId, type StyleId } from "../lib/styles";

/**
 * The instance's default citation style (`BO_0291_020`): kept in the
 * kernel's settings record under this extension's id, read by anyone signed
 * in and written by the owner alone — the kernel refuses anyone else. IEEE
 * until the owner chooses. A document may override it (`BO_0291_037`).
 */
const RECORD = "bibliography";

interface Settings {
  readonly id: string;
  readonly style?: string;
}

export async function instanceStyle(): Promise<StyleId> {
  try {
    const record = await kernelState.read<Settings>("settings", RECORD);
    return isStyleId(record?.style) ? record.style : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export async function setInstanceStyle(style: StyleId): Promise<StyleId> {
  const record = (await kernelState.read<Settings>("settings", RECORD)) ?? { id: RECORD };
  await kernelState.write("settings", { ...record, id: RECORD, style });
  return style;
}
