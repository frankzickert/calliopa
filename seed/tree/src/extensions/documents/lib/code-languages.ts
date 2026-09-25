/**
 * The languages the language field offers (`BO_0296_019`): the names the
 * highlighter knows, listed here as words so a view can offer them without
 * reaching the engine — `lib/highlight.test.ts` pins that the two agree. A
 * word not on the list is still typed freely; the block then draws plain.
 */
export const CODE_LANGUAGES: readonly string[] = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "go",
  "graphql",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "less",
  "lua",
  "makefile",
  "markdown",
  "objectivec",
  "perl",
  "php",
  "php-template",
  "plaintext",
  "python",
  "python-repl",
  "r",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vbnet",
  "wasm",
  "xml",
  "yaml",
];
