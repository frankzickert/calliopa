"""Every formatter in the image, against real source. No mocks.

Each language the table names is formatted from a badly laid out sample and
then again from the answer, which must come back byte-identical: a formatter
that is not idempotent would rewrite a block on every settle for ever. The
cases that must never rewrite anything — a fragment, an unknown word, an empty
source, one over the cap, a formatter that hangs — are here too, because they
are the common case in a document and the promise this service makes.
BO_0296_001
"""

import unittest

from lib.caps import Caps
from lib.formatters import TABLE, format_source, formatter_for, languages

CAPS = Caps()

#: One badly laid out sample per formatter, with what must survive it.
SAMPLES = {
    "python": "def solve(a,b):\n  if a>b: return a-b\n  return b-a\n",
    "javascript": "const x={a:1,   b:2}\nfunction f( ){return   x}\n",
    "typescript": "const x:number=1;function f(  a:string ):string{return a}\n",
    "css": "a{color:red;background:blue}\n",
    "json": '{"b":1,   "a":[1,2,3]}\n',
    "yaml": "a:    1\nb:\n  - 1\n  -   2\n",
    "markdown": "#  A title\n\n*  one\n*  two\n",
    "html": "<div><p>one</p><p>two</p></div>\n",
    "go": "package main\nfunc main(){x:=1\n_=x}\n",
    "sh": "if [ 1 = 1 ]; then\necho yes\nfi\n",
}


class FormatterTest(unittest.TestCase):
    def test_given_a_sample_of_each_language_then_it_is_rewritten_and_stays_rewritten(self):
        for language, source in SAMPLES.items():
            with self.subTest(language=language):
                first = format_source(source, language, CAPS.timeout_s, CAPS.source_max_bytes)
                self.assertTrue(first.formatted, f"{language}: {first.reason}")
                self.assertNotEqual(first.source, source)
                again = format_source(first.source, language, CAPS.timeout_s, CAPS.source_max_bytes)
                self.assertFalse(again.formatted, f"{language} is not idempotent: {again.source!r}")
                self.assertEqual(again.source, first.source)

    def test_given_a_fragment_that_does_not_parse_then_it_is_kept_exactly(self):
        fragment = "if (a > b) {\n    return a\n"
        answer = format_source(fragment, "javascript", CAPS.timeout_s, CAPS.source_max_bytes)
        self.assertFalse(answer.formatted)
        self.assertEqual(answer.source, fragment)
        self.assertIn("refused", answer.reason)

    def test_given_an_unknown_language_then_nothing_is_run(self):
        source = "SELECT  *   FROM users\n"
        for word in ("sql", "", None, "Klingon"):
            with self.subTest(word=word):
                answer = format_source(source, word, CAPS.timeout_s, CAPS.source_max_bytes)
                self.assertFalse(answer.formatted)
                self.assertEqual(answer.source, source)

    def test_given_a_language_in_any_case_then_it_is_found(self):
        self.assertIsNotNone(formatter_for("Python"))
        self.assertIsNotNone(formatter_for("  PY  "))
        self.assertIsNone(formatter_for("pythonic"))

    def test_given_an_empty_source_then_nothing_is_run(self):
        answer = format_source("", "python", CAPS.timeout_s, CAPS.source_max_bytes)
        self.assertFalse(answer.formatted)
        self.assertEqual(answer.source, "")

    def test_given_a_source_over_the_cap_then_it_is_kept_exactly(self):
        source = "x=1\n" * 100
        answer = format_source(source, "python", CAPS.timeout_s, source_max_bytes=16)
        self.assertFalse(answer.formatted)
        self.assertEqual(answer.source, source)
        self.assertIn("above", answer.reason)

    def test_given_a_formatter_that_will_not_finish_then_the_time_cap_keeps_the_source(self):
        source = "x = 1\n"
        answer = format_source(source, "python", timeout_s=0.001, source_max_bytes=CAPS.source_max_bytes)
        self.assertFalse(answer.formatted)
        self.assertEqual(answer.source, source)
        self.assertIn("did not finish", answer.reason)

    def test_given_already_formatted_source_then_nothing_is_rewritten(self):
        tidy = "def solve(a, b):\n    return a - b\n"
        answer = format_source(tidy, "python", CAPS.timeout_s, CAPS.source_max_bytes)
        self.assertFalse(answer.formatted)
        self.assertEqual(answer.source, tidy)
        self.assertEqual(answer.reason, "already formatted")

    def test_given_the_table_then_every_language_it_names_has_a_sample_or_an_alias(self):
        # Every formatter in the image is exercised above; this holds the table
        # to it, so a language added without a sample fails here rather than in
        # a document.
        covered = {formatter_for(name).name for name in SAMPLES}
        self.assertEqual(covered, {formatter.name for formatter in TABLE.values()})
        self.assertIn("python", languages())


if __name__ == "__main__":
    unittest.main()
