import type {
  GraphOutcome,
  RevisionConflict,
  ValidationFailure,
} from "./contract";

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

/** The caller is known and its class does not reach this operation. */
export function refused<T>(detail: string): GraphOutcome<T> {
  return { outcome: "refused", detail };
}

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
