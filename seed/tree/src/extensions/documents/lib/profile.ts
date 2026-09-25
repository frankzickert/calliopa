/**
 * Profiles (`calliopa-bootstrap`'s `BO_0298`, [Block Document Model](../docs/system/documents/block-document-model.md#profiles)):
 * a profile is a document carrying `record: profile`, reusable instructions a
 * person keeps for agents; a document names the one attached to it in its
 * `profile` property, which the kernel reads at a run's start. The words are
 * this extension's because the properties are declared on its `document`
 * type; the category, the selector and the routes are the `profiles`
 * extension's. Client-safe: nothing here reaches the graph.
 */

/** The `record` value that tells a profile apart. Knowledge, never a fence. */
export const PROFILE_RECORD = "profile";

/** A profile as the category lists it and the selector offers it. */
export interface ProfileSummary {
  readonly id: string;
  readonly title: string;
}

/** A document's selection: the profile attached, or none — and, when the
 * document names one the graph no longer holds as a profile, that id. */
export interface ProfileSelection {
  readonly profile: ProfileSummary | null;
  readonly gone: string | null;
}
