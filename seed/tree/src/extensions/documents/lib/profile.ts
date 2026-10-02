/**
 * Profiles (`calliopa-bootstrap`'s `BO_0298` and `BO_0311`, [Block Document Model](../docs/system/documents/block-document-model.md#profiles)):
 * a profile is a document carrying `record: profile`, reusable instructions a
 * person keeps for agents and chooses per command in the chip, which the
 * kernel reads at a run's start. The words are this extension's because the
 * record slot is declared on its `document` type; the chip, the grant control
 * and the routes are the `profiles` extension's. Client-safe: nothing here
 * reaches the graph.
 */

/** The `record` value that tells a profile apart. Knowledge, never a fence. */
export const PROFILE_RECORD = "profile";

/** What a profile generates, saved with it during setup (`calliopa-bootstrap`'s
 * `BO_0320` and `BO_0312`): an instructions profile, or an image or a video
 * profile with the backend `media.generate` uses — the property keeps its
 * first name, `imageBackend`, for both. */
export type ProfileGeneration = {
  readonly profileType: "instructions" | "image" | "video";
  readonly imageBackend: "higgsfield" | "openart" | "codex" | null;
};

/** A profile as the chip offers it and the Roles category lists it. */
export interface ProfileSummary {
  readonly id: string;
  readonly title: string;
}
