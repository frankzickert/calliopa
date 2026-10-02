import { FORMAT_STRUCTURE, INSTRUCTION_STRUCTURE, VARIATION_STRUCTURE, type FieldValue, type TakenStructure } from "~/extensions/structures/lib/structures";
import { structuresOf } from "~/extensions/structures/server/structures";

import type { FormatChoices } from "../lib/variations";

/**
 * What a generation is made with (`calliopa-bootstrap`'s `BO_0336_022`): the
 * format the run's instruction names in *Instruction*'s `format` field — a document
 * carrying *Format* — with the variation chosen beside *Send* put over it,
 * each value it leaves empty being the format's. All read at the run's pin.
 * The kernel hands the instruction and the variation by id and reads neither
 * (`ui-kernel.md` `BO_0336_001`), as it hands `make_manuscript`'s roles.
 */

export interface GenerationFormat {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly provider: string;
  readonly model: string;
  readonly ratio: string;
  readonly quality: string;
  /** The variation chosen beside Send, when one was. */
  readonly variation?: string;
}

export type FormatRead = { readonly ok: true; readonly format: GenerationFormat } | { readonly ok: false; readonly refusal: string };

const GENERATION_KEYS = ["provider", "model", "ratio", "quality"] as const;

const words = (value: FieldValue | undefined): string => (typeof value === "string" ? value.trim() : "");

const valuesOf = (roles: readonly TakenStructure[], roleId: string): Readonly<Record<string, FieldValue>> | null =>
  roles.find((role) => role.id === roleId && role.proposed !== "structure")?.values ?? null;

/** The format the instruction names, at the pin, or why a generation cannot use it. */
export async function readFormat(run: { readonly pin: number; readonly instruction?: string; readonly variation?: string }): Promise<FormatRead> {
  const scope = run.pin > 0 ? { dataRevision: run.pin } : {};
  const instructionId = (run.instruction ?? "").trim();
  if (instructionId === "") {
    return { ok: false, refusal: "Choose an instruction whose Format names how the picture or video is made, then send again." };
  }
  const instruction = await structuresOf(instructionId, scope);
  if (instruction.outcome !== "success") return { ok: false, refusal: "The instruction could not be read." };
  const formatId = words(valuesOf(instruction.result.structures, INSTRUCTION_STRUCTURE)?.["format"]);
  if (formatId === "") {
    return { ok: false, refusal: "This instruction names no format: choose a format on the instruction, in its Format field, then send again." };
  }
  const title = instruction.result.referenceTitles?.[formatId] ?? "The instruction's format";
  const format = await structuresOf(formatId, scope);
  if (format.outcome !== "success") return { ok: false, refusal: `${title} could not be read.` };
  const held = valuesOf(format.result.structures, FORMAT_STRUCTURE);
  if (held === null) return { ok: false, refusal: `${title} no longer carries Format: choose another format on the instruction.` };

  const values: Record<string, string> = Object.fromEntries(GENERATION_KEYS.map((key) => [key, words(held[key])]));
  const variationId = (run.variation ?? "").trim();
  if (variationId !== "") {
    const block = format.result.blocks.find((one) => one.blockId === variationId);
    const varied = block === undefined ? null : valuesOf(block.structures, VARIATION_STRUCTURE);
    if (varied === null) return { ok: false, refusal: `The variation chosen is not one of ${title}'s: choose again beside Send.` };
    for (const key of GENERATION_KEYS) {
      const own = words(varied[key]);
      if (own !== "") values[key] = own;
    }
  }
  return {
    ok: true,
    format: {
      id: formatId,
      title,
      type: words(held["type"]),
      provider: values["provider"] ?? "",
      model: values["model"] ?? "",
      ratio: values["ratio"] ?? "",
      quality: values["quality"] ?? "",
      ...(variationId === "" ? {} : { variation: variationId }),
    },
  };
}


/**
 * What the choice beside *Send* offers for an instruction (`BO_0336_023`): the
 * format it names, then each block of that format carrying *Variation*, in
 * reading order, by its words. Nothing when the instruction names no format.
 */
export async function choicesFor(instructionId: string, wordsOf: (documentId: string, blockId: string) => Promise<string>): Promise<FormatChoices> {
  const none: FormatChoices = { format: null, variations: [] };
  if (instructionId.trim() === "") return none;
  const instruction = await structuresOf(instructionId);
  if (instruction.outcome !== "success") return none;
  const formatId = words(valuesOf(instruction.result.structures, INSTRUCTION_STRUCTURE)?.["format"]);
  if (formatId === "") return none;
  const format = await structuresOf(formatId);
  if (format.outcome !== "success" || valuesOf(format.result.structures, FORMAT_STRUCTURE) === null) return none;
  const title = instruction.result.referenceTitles?.[formatId] ?? "Format";
  const carrying = format.result.blocks.filter((block) => valuesOf(block.structures, VARIATION_STRUCTURE) !== null);
  const variations = await Promise.all(
    carrying.map(async (block, index) => {
      const said = (await wordsOf(formatId, block.blockId)).trim();
      return { id: block.blockId, title: said === "" ? `Variation ${index + 1}` : said.slice(0, 60) };
    }),
  );
  return { format: { id: formatId, title }, variations };
}
