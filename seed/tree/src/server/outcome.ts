/**
 * The outcome every server-side operation answers with, and its transport
 * meaning.
 *
 * This used to live inside the shell's own graph gateway. Under `BO_0207` the
 * gateway retires and the operations answer through CCGW and the kernel
 * bridge instead, so the outcome vocabulary moves out here where documents,
 * production and publishing can all name it without naming a store.
 */

/** A list that cannot be empty. */
export type NonEmpty<T> = readonly [T, ...T[]];

export interface ValidationFailure {
  /** Index of the offending operation, or null when the request itself is wrong. */
  readonly operation: number | null;
  readonly rule: string;
  readonly detail: string;
}

export interface RevisionConflict {
  readonly nodeId: string;
  readonly expectedRevisionId: string;
  readonly currentRevisionId: string | null;
}

/** Every operation answers with exactly one of these. */
export type GraphOutcome<T> =
  | { readonly outcome: "success"; readonly result: T }
  | { readonly outcome: "noResult"; readonly detail: string }
  | { readonly outcome: "conflict"; readonly conflicts: NonEmpty<RevisionConflict> }
  | {
      readonly outcome: "validationFailure";
      readonly failures: NonEmpty<ValidationFailure>;
    }
  | { readonly outcome: "authenticationFailure" }
  /**
   * The caller proved who it is and what it asked for is not its to do —
   * under `BO_0207` this is also the kernel's answer when a decision needs
   * the confirmation ceremony the bridge kept for it.
   */
  | { readonly outcome: "refused"; readonly detail: string }
  | { readonly outcome: "storageError"; readonly detail: string };

export interface OutcomeResponse<T> {
  readonly status: number;
  readonly body: GraphOutcome<T>;
}

/**
 * The transport meaning of each outcome. The body carries the outcome itself,
 * so a consumer that reads only the status still knows what happened.
 */
const STATUS = {
  success: 200,
  noResult: 404,
  conflict: 409,
  validationFailure: 400,
  authenticationFailure: 401,
  refused: 403,
  storageError: 500,
} as const;

export const respond = <T>(outcome: GraphOutcome<T>): OutcomeResponse<T> => ({
  status: STATUS[outcome.outcome],
  body: outcome,
});

/** A refusal built where a request is read, before any operation runs. */
export function refusal<T>(rule: string, detail: string): GraphOutcome<T> {
  return {
    outcome: "validationFailure",
    failures: [{ operation: null, rule, detail }],
  };
}

/**
 * Turns collected failures into an outcome, or null when there were none.
 * Building the non-empty list here is what keeps every caller from asserting
 * that its array has something in it.
 */
export function validationOutcome<T>(
  failures: readonly ValidationFailure[],
): GraphOutcome<T> | null {
  const [first, ...rest] = failures;
  return first === undefined
    ? null
    : { outcome: "validationFailure", failures: [first, ...rest] };
}

export function conflictOutcome<T>(
  conflicts: readonly RevisionConflict[],
): GraphOutcome<T> | null {
  const [first, ...rest] = conflicts;
  return first === undefined
    ? null
    : { outcome: "conflict", conflicts: [first, ...rest] };
}
