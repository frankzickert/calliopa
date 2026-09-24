import { randomUUID } from "node:crypto";

import { withBranch } from "~/server/ccgw/branch-scope";
import { readSession } from "~/server/session";
import { insertBlock } from "~/extensions/documents/server/documents";

/**
 * Proposing a generation (`BO_0273_017`).
 *
 * A press stages a picture that is not made yet: an `image` or `video` block
 * with **no reference**, which is the whole of the pending state, inserted
 * after the block whose words are the prompt. It is staged into a group of its
 * own, so the reader answers it as they answer any proposal — and rejecting it
 * costs nothing, because nothing has been paid for yet.
 *
 * The block is `documents`' type and `documents` writes it; this extension
 * declares the dependency that allows the import. What travels with it is
 * `source`, the record of what is to make it, which the document model stores
 * and never interprets.
 *
 * **Nothing bills here.** Staging is free; the press that spends comes after,
 * against the block this leaves standing.
 */

export interface ProposeRequest {
  readonly documentId: string;
  /** The block whose words are the prompt, and what the picture follows. */
  readonly afterBlockId: string;
  readonly service: string;
  readonly model: string;
  readonly kind: string;
  readonly prompt: string;
}

export interface Proposed {
  readonly ok: boolean;
  readonly group?: string;
  readonly blockId?: string;
  readonly refusal?: string;
}

/** The group one generation's proposal stands in. */
export const generationGroup = (): string => `node:media-${randomUUID()}`;

export async function proposeGeneration(input: ProposeRequest): Promise<Proposed> {
  const person = await readSession();
  if (person === null || person.class !== "human") {
    return { ok: false, refusal: "Only a signed-in person can propose a generation." };
  }
  if (input.service.trim() === "" || input.model.trim() === "") {
    return { ok: false, refusal: "Choose a model first." };
  }
  const prompt = input.prompt.trim();
  if (prompt === "") {
    return { ok: false, refusal: "This block has no words to make a picture from." };
  }

  const kind = input.kind === "video" ? "video" : "image";
  const group = generationGroup();
  // Inside the branch scope, so the insert is staged into this group rather
  // than established: a proposal the reader answers, not a block that appeared.
  const written = await withBranch(group, () =>
    insertBlock({
      documentId: input.documentId,
      block: {
        kind,
        alt: prompt,
        source: {
          extension: "media",
          service: input.service,
          model: input.model,
          prompt,
          proposedAt: new Date().toISOString(),
        },
      },
      placement: { after: input.afterBlockId },
    }),
  );
  if (written.outcome !== "success") {
    return { ok: false, refusal: "The picture could not be proposed into this document." };
  }
  return { ok: true, group, blockId: written.result.blockId };
}
