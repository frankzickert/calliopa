import type { ProfileSummary } from "~/extensions/documents/lib/profile";

/**
 * The words `profiles` shares between its server half and its views
 * (`calliopa-bootstrap`'s `BO_0311`). Client-safe: nothing here reaches the
 * graph or the kernel.
 */

/** The built-in role every profile takes (`doc-block-roles`' built-ins). */
export const PROFILE_ROLE = "builtin:profile";

/** The option the chip sets on a command, which the kernel reads. */
export const PROFILE_OPTION = "profile";

/** A profile as the chip offers it: grouped first when it carries a role the
 * block or its document takes. */
export interface ProfileChoice extends ProfileSummary {
  readonly matches: boolean;
}

/** What the chip is handed for a block. */
export interface ProfileChoices {
  readonly reachable: boolean;
  /** The document the chip stands in is itself a profile. */
  readonly isProfile: boolean;
  readonly profiles: readonly ProfileChoice[];
  /** The profile the person last sent with in this document, or null. */
  readonly last: string | null;
}

/** A code block of a profile as a tool, with the state of its grant. */
export interface ToolState {
  readonly block: string;
  readonly name: string;
  readonly description: string;
  /** Granted as it stands, changed since the grant, or never granted. */
  readonly state: "granted" | "changed" | "never";
}

/** The kernel's answer on a profile's grant. */
export interface GrantView {
  readonly profile: string;
  readonly granted: boolean;
  readonly runtime: string | null;
  readonly tools: readonly ToolState[];
  readonly grantedBy?: string;
  readonly grantedAt?: number;
  readonly secrets?: readonly string[];
}

/** A named secret as the owner sees it: never its value. */
export interface SecretView {
  readonly name: string;
  readonly set: boolean;
  readonly suffix: string;
}

/** A grant as the owner's Settings section lists it, with the profile's title. */
export interface GrantRow {
  readonly profile: string;
  readonly title: string;
  readonly grantedBy: string;
  readonly grantedAt: number;
  readonly secrets: readonly string[];
}

/** What the owner's Settings section is handed. */
export interface ProfileGrants {
  readonly grants: readonly GrantRow[];
  readonly secrets: readonly SecretView[];
}

/** What the grant control and the headlines are handed for a document. */
export type ProfileTools =
  | { readonly profile: false }
  | { readonly profile: true; readonly owner: boolean; readonly grant: GrantView | null; readonly secrets: readonly SecretView[] };

/** The chip's options in their order: *No profile*, then the profiles
 * carrying a role the block or its document takes, then the rest, each by
 * title. */
export function orderedChoices(profiles: readonly ProfileChoice[]): readonly ProfileChoice[] {
  const byTitle = (left: ProfileChoice, right: ProfileChoice) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1);
  return [...profiles.filter((profile) => profile.matches).sort(byTitle), ...profiles.filter((profile) => !profile.matches).sort(byTitle)];
}

/** What a tool's state reads as on its code block. */
export const TOOL_STATE_WORDS: Readonly<Record<ToolState["state"], string>> = {
  granted: "granted",
  changed: "changed since the grant",
  never: "offline",
};
