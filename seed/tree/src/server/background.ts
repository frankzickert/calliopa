/**
 * Work the server starts and does not wait for — following a run after its
 * route has answered — goes through here. A failure ends that work, logged
 * with what it was doing and what it was about, and never the server: on
 * 2026-10-04 a rejected follow reached no handler and every person on the
 * instance lost the shell. The promise answered settles when the work does
 * and never rejects. CA_0080_003
 */
export function inBackground(task: string, subject: string, work: () => Promise<unknown>): Promise<void> {
  let running: Promise<unknown>;
  try {
    running = work();
  } catch (error) {
    reportFailure(task, subject, error);
    return Promise.resolve();
  }
  return running.then(
    () => undefined,
    (error: unknown) => reportFailure(task, subject, error),
  );
}

/** One line naming the work, its subject and why it stopped. */
export function reportFailure(task: string, subject: string, error: unknown): void {
  console.error(`background ${task} (${subject}) failed: ${describeError(error)}`);
}

/** An error's message, with its cause's, as undici's carry the real reason there. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof Error ? `${error.message}: ${cause.message}` : error.message;
}

/**
 * The serve entry's net under the helper: a rejection nobody handled is
 * logged and the server keeps serving, instead of Node ending the process.
 * CA_0080_003
 */
export function keepServingOnUnhandledRejection(target: NodeJS.Process = process): void {
  target.on("unhandledRejection", (reason) => {
    console.error(`unhandled rejection, still serving: ${describeError(reason)}`);
  });
}
