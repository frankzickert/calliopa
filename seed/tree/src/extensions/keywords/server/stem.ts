import factory from "snowball-stemmers";

import type { Stemmer } from "../lib/match";

/**
 * The English stem (`BO_0301_013`): the Snowball English stemmer, fetched by
 * `pnpm` as `snowball-stemmers` (ISC) rather than a rule list typed here. It
 * is the third rule, reached only where the title and the aliases in every
 * inflection reach nothing — which is why *computer* and *computing*, which
 * share the stem *comput*, stay two keywords under the first rule. Server
 * only: the browser never matches, it draws what the read answered.
 */
const english = factory.newStemmer("english");

export const stemEnglish: Stemmer = (word) => english.stem(word);
