import type { Run, TextRole } from "../runs";
import type { LiveLine, ParsedDocument } from "./parse";
import type { Change, Network, Topic } from "./network";

/**
 * A network node as a document the shell can show.
 *
 * The blocks are the block editor's reading vocabulary — text with a role and
 * runs, dividers — so the owner document reads like every other document. A
 * run's `link` beginning with `calliopa:` names another node of the network;
 * the view opens it as a tab rather than following it. BO_0201_007
 */

export interface OwnerTextBlock {
  readonly kind: "text";
  readonly role: TextRole;
  readonly runs: readonly Run[];
}

export interface OwnerDividerBlock {
  readonly kind: "divider";
}

export type OwnerBlock = OwnerTextBlock | OwnerDividerBlock;

export interface OwnerFact {
  readonly label: string;
  readonly value: string;
}

export interface OwnerDocument {
  /** `ext:<id>` for the extension, `ext:<id>/<path>` for a topic or change. */
  readonly nodeId: string;
  readonly title: string;
  readonly blocks: readonly OwnerBlock[];
  readonly facts: readonly OwnerFact[];
}

/** What the graph says about the extension itself. */
export interface ExtensionFacts {
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly elevated: boolean;
  readonly establishedBy: string;
  readonly establishedAt: number;
  readonly servedPin: number | null;
  readonly newestRevision: number;
  readonly dependsOn: readonly string[];
  readonly dependedOnBy: readonly string[];
  /** The goal of the extension's skill, when it carries one. */
  readonly skillGoal: string | null;
}

export const nodeIdOf = (extension: string, path?: string): string =>
  path === undefined ? `ext:${extension}` : `ext:${extension}/${path}`;

export const linkTo = (extension: string, path?: string): string =>
  `calliopa:${nodeIdOf(extension, path)}`;

const text = (role: TextRole, ...runs: Run[]): OwnerTextBlock => ({ kind: "text", role, runs });
const plain = (value: string): Run => ({ text: value });
const badge = (value: string): Run => ({ text: value, marks: ["code"] });
const divider: OwnerDividerBlock = { kind: "divider" };

/** Text with each task identifier turned into a link to the node that resolves it. */
function withTaskLinks(
  value: string,
  extension: string,
  network: Network,
): Run[] {
  const runs: Run[] = [];
  const pattern = /\b[A-Z]{2}_\d{4}_\d{3}\b/gu;
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) runs.push(plain(value.slice(last, index)));
    const id = match[0];
    const task = network.tasks.get(id);
    const target = task?.lines[0]?.path ?? task?.changes[0];
    runs.push(
      target === undefined
        ? { text: id, marks: ["code"] }
        : { text: id, marks: ["code"], link: linkTo(extension, target) },
    );
    last = index + id.length;
  }
  if (last < value.length) runs.push(plain(value.slice(last)));
  return runs.length === 0 ? [plain("")] : runs;
}

function lineBlock(line: LiveLine, extension: string, network: Network): OwnerTextBlock {
  const state = line.question ? "question" : line.state;
  return text(
    "paragraph",
    badge(line.marker),
    plain(" "),
    badge(state),
    plain(" "),
    ...withTaskLinks(line.text, extension, network),
  );
}

function proseBlocks(document: ParsedDocument, extension: string, network: Network): OwnerBlock[] {
  return document.blocks.map((block) => {
    if (block.kind === "heading") {
      const role: TextRole = block.level <= 2 ? "h2" : "h3";
      return text(role, plain(block.text));
    }
    if (block.kind === "line") return lineBlock(block.line, extension, network);
    return block.code
      ? text("paragraph", { text: block.text, marks: ["code"] })
      : text("paragraph", ...withTaskLinks(block.text, extension, network));
  });
}

function purposeBlocks(network: Network, facts: ExtensionFacts): OwnerBlock[] {
  const index = network.topics.find((topic) => topic.path === "docs/system/system.md");
  if (index !== undefined) {
    const purpose = index.document.blocks.filter(
      (block) =>
        block.kind !== "heading" &&
        (block.kind === "prose" ? block.section : block.line.section) === "Purpose",
    );
    if (purpose.length > 0) {
      return purpose.map((block) =>
        block.kind === "line"
          ? text("paragraph", ...withTaskLinks(block.line.text, facts.id, network))
          : text("paragraph", plain(block.kind === "prose" ? block.text : "")),
      );
    }
  }
  if (network.readme !== null) {
    const prose = network.readme.blocks.filter((block) => block.kind === "prose" && !block.code);
    if (prose.length > 0) {
      return prose.slice(0, 3).map((block) => text("paragraph", plain(block.kind === "prose" ? block.text : "")));
    }
  }
  if (facts.skillGoal !== null) {
    return [
      text("paragraph", plain(facts.skillGoal)),
      text("quote", plain("Stated by the extension's skill: what an agent does under it, not yet what it is for.")),
    ];
  }
  return [
    text(
      "quote",
      plain("This extension carries no purpose yet: no docs/system/system.md, no README.md, no skill. Its owner has not said what it is for."),
    ),
  ];
}

export function renderExtension(network: Network, facts: ExtensionFacts): OwnerDocument {
  const blocks: OwnerBlock[] = [text("h1", plain(facts.id))];
  blocks.push(text("h2", plain("Purpose")), ...purposeBlocks(network, facts));

  blocks.push(text("h2", plain("Topics")));
  if (network.topics.length === 0) {
    blocks.push(text("paragraph", plain("No system documents yet.")));
  }
  let area: string | null = null;
  for (const topic of network.topics) {
    if (topic.area !== area) {
      area = topic.area;
      if (area !== "") blocks.push(text("h3", plain(area)));
    }
    blocks.push(
      text(
        "paragraph",
        { text: topic.title, marks: ["bold"], link: linkTo(facts.id, topic.path) },
        plain(
          `  ${topic.fixedCount} fixed · ${topic.openCount} open · ${topic.claimedCount} claimed`,
        ),
      ),
    );
  }

  blocks.push(text("h2", plain("Changes")));
  if (network.changes.length === 0) {
    blocks.push(text("paragraph", plain("No change documents yet.")));
  }
  for (const change of network.changes) {
    blocks.push(
      text(
        "paragraph",
        badge(change.status),
        plain(" "),
        { text: change.id !== "" ? `${change.id} ` : "", marks: ["code"] },
        { text: change.title, marks: ["bold"], link: linkTo(facts.id, change.path) },
      ),
    );
    if (change.intent !== "") blocks.push(text("quote", ...withTaskLinks(change.intent, facts.id, network)));
  }

  blocks.push(text("h2", plain("Questions")));
  if (network.questions.length === 0) {
    blocks.push(text("paragraph", plain("Nothing awaits the owner.")));
  }
  for (const question of network.questions) {
    blocks.push(
      text(
        "paragraph",
        { text: question.path.split("/").pop() ?? question.path, marks: ["code"], link: linkTo(facts.id, question.path) },
        plain(" "),
        ...withTaskLinks(question.text, facts.id, network),
      ),
    );
  }

  blocks.push(text("h2", plain("History")));
  if (network.history.length === 0) {
    blocks.push(text("paragraph", plain("The graph records no proposal for this extension.")));
  }
  for (const entry of network.history) {
    blocks.push(
      text(
        "paragraph",
        badge(String(entry.dataRevision)),
        plain(" "),
        badge(entry.status),
        plain(` ${entry.author} — `),
        ...withTaskLinks(entry.rationale, facts.id, network),
      ),
    );
  }

  return {
    nodeId: nodeIdOf(facts.id),
    title: facts.id,
    blocks,
    facts: extensionFacts(facts),
  };
}

export function extensionFacts(facts: ExtensionFacts): OwnerFact[] {
  const served =
    facts.servedPin === null
      ? "no release pin"
      : facts.servedPin >= facts.newestRevision
        ? `pin ${facts.servedPin}, current`
        : `pin ${facts.servedPin}, newer truth at ${facts.newestRevision}`;
  return [
    { label: "Version", value: facts.version },
    { label: "Category", value: facts.category },
    { label: "Elevated", value: facts.elevated ? "yes" : "no" },
    { label: "Established", value: `${facts.establishedBy} at ${facts.establishedAt}` },
    { label: "Served", value: served },
    { label: "Depends on", value: facts.dependsOn.length === 0 ? "nothing" : facts.dependsOn.join(", ") },
    { label: "Depended on by", value: facts.dependedOnBy.length === 0 ? "nothing" : facts.dependedOnBy.join(", ") },
  ];
}

export function renderTopic(topic: Topic, extension: string, network: Network, facts: ExtensionFacts): OwnerDocument {
  const blocks: OwnerBlock[] = [
    text("h1", plain(topic.title)),
    text("paragraph", { text: extension, marks: ["code"], link: linkTo(extension) }, plain(` · ${topic.path}`)),
  ];
  // Each section: its prose, then fixed lines and open work, then mutable truth.
  const sections = new Map<string, ParsedDocument["blocks"][number][]>();
  const order: string[] = [];
  for (const block of topic.document.blocks) {
    if (block.kind === "heading") {
      if (block.level === 1) continue;
      if (!sections.has(block.text)) {
        sections.set(block.text, []);
        order.push(block.text);
      }
      continue;
    }
    const key = block.kind === "prose" ? block.section : block.line.section;
    if (!sections.has(key)) {
      sections.set(key, []);
      order.push(key);
    }
    sections.get(key)?.push(block);
  }
  for (const name of order) {
    const content = sections.get(name) ?? [];
    if (name !== "") blocks.push(text("h2", plain(name)));
    const prose = content.filter((block) => block.kind === "prose");
    const lines = content.filter((block) => block.kind === "line");
    const first = lines.filter((block) => block.kind === "line" && (block.line.marker === "fixed" || block.line.state !== "truth"));
    const rest = lines.filter((block) => !first.includes(block));
    for (const block of [...prose, ...first, ...rest]) {
      if (block.kind === "line") blocks.push(lineBlock(block.line, extension, network));
      else if (block.kind === "prose")
        blocks.push(
          block.code
            ? text("paragraph", { text: block.text, marks: ["code"] })
            : text("paragraph", ...withTaskLinks(block.text, extension, network)),
        );
    }
    if (first.length > 0 && rest.length > 0) blocks.push(divider);
  }
  return {
    nodeId: nodeIdOf(extension, topic.path),
    title: topic.title,
    blocks,
    facts: [
      { label: "Extension", value: extension },
      { label: "Fixed lines", value: String(topic.fixedCount) },
      { label: "Open work", value: String(topic.openCount) },
      { label: "Claimed", value: String(topic.claimedCount) },
      ...extensionFacts(facts).slice(4, 5),
    ],
  };
}

export function renderChange(change: Change, extension: string, network: Network, facts: ExtensionFacts): OwnerDocument {
  const blocks: OwnerBlock[] = [
    text("h1", plain(change.title)),
    text(
      "paragraph",
      badge(change.status),
      plain(" "),
      { text: extension, marks: ["code"], link: linkTo(extension) },
      plain(` · ${change.path}`),
    ),
    ...proseBlocks(change.document, extension, network),
  ];
  if (change.tasks.length > 0) {
    blocks.push(text("h2", plain("Tasks")));
    for (const id of change.tasks) {
      const task = network.tasks.get(id);
      const states = task?.lines.map((line) => line.state) ?? [];
      const state = states.length === 0 ? "not in any topic" : states.every((value) => value === "truth") ? "true" : states.join(", ");
      blocks.push(text("paragraph", ...withTaskLinks(id, extension, network), plain(` — ${state}`)));
    }
  }
  return {
    nodeId: nodeIdOf(extension, change.path),
    title: change.title,
    blocks,
    facts: [
      { label: "Extension", value: extension },
      { label: "Status", value: change.status },
      { label: "Tasks", value: String(change.tasks.length) },
      ...extensionFacts(facts).slice(4, 5),
    ],
  };
}

/** Resolves a node id to its document, or null when the network has no such node. */
export function renderNode(
  nodePath: string | undefined,
  network: Network,
  facts: ExtensionFacts,
): OwnerDocument | null {
  if (nodePath === undefined) return renderExtension(network, facts);
  const topic = network.topics.find((candidate) => candidate.path === nodePath);
  if (topic !== undefined) return renderTopic(topic, facts.id, network, facts);
  const change = network.changes.find((candidate) => candidate.path === nodePath);
  if (change !== undefined) return renderChange(change, facts.id, network, facts);
  return null;
}
