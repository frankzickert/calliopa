/**
 * A format and its variations as the choice beside *Send* lists them
 * (`calliopa-bootstrap`'s `BO_0336_023`). Server-free, so the view reading it
 * draws nothing of the server into the browser bundle.
 */
export interface FormatChoices {
  readonly format: { readonly id: string; readonly title: string } | null;
  readonly variations: readonly { readonly id: string; readonly title: string }[];
}
