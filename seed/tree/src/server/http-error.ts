export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The refuser's own code, when it named one — the kernel's `unlicensed`,
     * `forbidden` — so a surface can show a refusal as what it is. BO_0209_004 */
    readonly code?: string,
  ) {
    super(message);
  }
}
