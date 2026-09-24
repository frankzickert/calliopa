/** The part of citeproc-js this extension calls (`BO_0291_029`); the package ships no types. */
declare module "citeproc" {
  interface Sys {
    retrieveLocale(lang: string): string;
    retrieveItem(id: string): Record<string, unknown>;
  }
  interface CitationItem {
    readonly id: string;
    readonly locator?: string;
    readonly label?: string;
    readonly suffix?: string;
  }
  class Engine {
    constructor(sys: Sys, style: string, lang?: string, forceLang?: boolean);
    updateItems(ids: readonly string[]): void;
    makeCitationCluster(items: readonly CitationItem[]): string;
    makeBibliography(): false | [{ readonly entry_ids: readonly (readonly string[])[] }, readonly string[]];
  }
  const CSL: { Engine: typeof Engine };
  export default CSL;
}
