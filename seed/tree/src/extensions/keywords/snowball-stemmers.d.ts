/** The part of the Snowball port this extension calls (`BO_0301_013`); the package ships no types. */
declare module "snowball-stemmers" {
  interface Stemmer {
    stem(word: string): string;
  }
  const factory: {
    newStemmer(algorithm: string): Stemmer;
    algorithms(): string[];
  };
  export default factory;
}
