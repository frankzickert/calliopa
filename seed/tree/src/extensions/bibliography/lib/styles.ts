/**
 * The citation styles a release ships (`BO_0291_020`, `BO_0291_029`): IEEE,
 * the default on a fresh install, and two author-date styles. The ids are
 * the CSL project's file names; the files are the `csl-styles` package's, fetched at build.
 * Shared by the server, which renders with them, and the surfaces, which
 * name them.
 */
export const STYLES = [
  { id: "ieee", name: "IEEE", numeric: true },
  { id: "apa", name: "APA (7th edition)", numeric: false },
  { id: "chicago-author-date", name: "Chicago author-date", numeric: false },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

export const DEFAULT_STYLE: StyleId = "ieee";

export const isStyleId = (value: unknown): value is StyleId => STYLES.some((style) => style.id === value);

export const styleName = (id: StyleId): string => STYLES.find((style) => style.id === id)?.name ?? id;

/**
 * The style a document's citations are set in (`BO_0291_037`): the first of
 * the asked style, the document's own choice and the instance's default that
 * names a shipped style, so a choice no longer shipped falls back rather than
 * failing the read.
 */
export const styleFor = (asked: unknown, documentStyle: unknown, instanceDefault: StyleId): StyleId =>
  isStyleId(asked) ? asked : isStyleId(documentStyle) ? documentStyle : instanceDefault;

/** What the citation resolver says of the styles beside its labels: the one
 * applied, the instance's default and every shipped style by name. */
export const stylesAnswer = (applied: StyleId, instanceDefault: StyleId) => ({
  applied,
  instanceDefault,
  offered: STYLES.map((style) => ({ id: style.id, name: style.name })),
});
