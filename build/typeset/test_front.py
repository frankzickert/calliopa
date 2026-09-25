#!/usr/bin/env python3
"""Tests for the typesetting service's front.

The request's reading and the log's reading are checked anywhere. The
typesetting itself is checked against the real engine — Pandoc, TeX Live,
latexmk — so those cases run inside the image, where the engine is, and are
skipped outside it. Nothing is stood in for: a manuscript either comes out of
the engine or the test fails. BO_0293_001
"""

from __future__ import annotations

import base64
import importlib.util
import json
import os
import pwd
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("_calliopa_typeset_front", HERE / "front.py")
front = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
sys.modules[spec.name] = front
spec.loader.exec_module(front)  # type: ignore[union-attr]

BEARER = "the-typeset-bearer"
VENUES = front.load_venues(HERE / "venues")
ENGINE_PRESENT = shutil.which("pandoc") is not None and shutil.which("latexmk") is not None


def unprivileged() -> str | None:
    try:
        pwd.getpwnam("typeset")
        return "typeset"
    except KeyError:
        return None


def png_pixel() -> str:
    """A one-pixel PNG, built here with its real chunks and checksums, so the
    engine includes a real picture."""
    import struct
    import zlib

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixels = zlib.compress(b"\x00\xff\x80\x00")
    return base64.b64encode(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")).decode()


PIXEL = png_pixel()


def pdf_text(pdf: bytes) -> str:
    """The words pdflatex wrote into the PDF's content streams, decoded loosely:
    enough to see an unresolved reference's `??`, not a reader."""
    import re as _re
    import zlib

    out: list[str] = []
    for match in _re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, _re.S):
        data = match.group(1)
        try:
            data = zlib.decompress(data)
        except zlib.error:
            pass
        # A page's content stream sets its text between BT and ET; a font's
        # stream, which holds no such operators, is not words.
        if b"BT" not in data or b"ET" not in data:
            continue
        # A font's binary stream can hold those two bytes by chance and then
        # any pair of characters, `??` included; a content stream pdflatex
        # writes is printable ASCII throughout.
        if any(byte > 126 or (byte < 32 and byte not in (9, 10, 13)) for byte in data):
            continue
        out.extend(piece.decode("latin-1") for piece in _re.findall(rb"\((.*?)(?<!\\)\)", data, _re.S))
    return "".join(out)


def text(words: str) -> list[dict]:
    """Pandoc inlines for plain words."""
    inlines: list[dict] = []
    for index, word in enumerate(words.split(" ")):
        if index:
            inlines.append({"t": "Space"})
        inlines.append({"t": "Str", "c": word})
    return inlines


def meta_string(value: str) -> dict:
    return {"t": "MetaInlines", "c": text(value)}


def manuscript(extra_blocks: list[dict] | None = None) -> dict:
    """A small paper: a head, two sections, a numbered figure, a table, a
    numbered equation referred to from a sentence, and three citations."""
    blocks = [
        {"t": "Header", "c": [1, ["introduction", [], []], text("Introduction")]},
        {
            "t": "Para",
            "c": text("Prior work")
            + [{"t": "Space"}, {"t": "Cite", "c": [[{"citationId": "smith2020", "citationPrefix": [], "citationSuffix": [], "citationMode": {"t": "NormalCitation"}, "citationNoteNum": 0, "citationHash": 0}], [{"t": "Str", "c": "[@smith2020]"}]]}]
            + [{"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}]
            + [{"t": "Cite", "c": [[{"citationId": "doe2021", "citationPrefix": [], "citationSuffix": [], "citationMode": {"t": "NormalCitation"}, "citationNoteNum": 0, "citationHash": 0}, {"citationId": "roe2019", "citationPrefix": [], "citationSuffix": [], "citationMode": {"t": "NormalCitation"}, "citationNoteNum": 0, "citationHash": 0}], [{"t": "Str", "c": "[@doe2021;@roe2019]"}]]}]
            + [{"t": "Str", "c": "."}],
        },
        {"t": "RawBlock", "c": ["latex", "\\begin{equation}\\label{eq:euler}e^{i\\pi} + 1 = 0\\end{equation}"]},
        {"t": "Para", "c": text("As equation") + [{"t": "Space"}, {"t": "RawInline", "c": ["latex", "(\\ref{eq:euler})"]}, {"t": "Space"}] + text("shows, and Figure") + [{"t": "Space"}, {"t": "RawInline", "c": ["latex", "\\ref{fig:pixel}"]}, {"t": "Str", "c": "."}]},
        {"t": "RawBlock", "c": ["latex", "\\begin{figure}[t]\\centering\\includegraphics[width=0.3\\linewidth]{pixel.png}\\caption{A single pixel.}\\label{fig:pixel}\\end{figure}"]},
        {"t": "RawBlock", "c": ["latex", "\\begin{table}[t]\\centering\\caption{Readings.}\\label{tab:readings}\\begin{tabular}{rr}\\toprule x & y\\\\\\midrule 1 & 2\\\\\\bottomrule\\end{tabular}\\end{table}"]},
        {"t": "Header", "c": [1, ["method", [], []], text("Method")]},
        {"t": "Para", "c": text("We measured it.")},
    ] + (extra_blocks or [])
    return {
        "pandoc-api-version": front.PANDOC_API_VERSION,
        "meta": {
            "title": meta_string("A Manuscript Out Of The Record"),
            "author": {"t": "MetaList", "c": [
                {"t": "MetaMap", "c": {"name": meta_string("Ada Lovelace"), "affiliation": meta_string("Analytical Engines Ltd")}},
                {"t": "MetaMap", "c": {"name": meta_string("Charles Babbage"), "affiliation": meta_string("Difference Works")}},
            ]},
            "abstract": {"t": "MetaBlocks", "c": [{"t": "Para", "c": text("We show that a record can emit a paper.")}]},
            "keywords": {"t": "MetaList", "c": [meta_string("provenance"), meta_string("typesetting")]},
        },
        "blocks": blocks,
    }


REFERENCES = [
    {"id": "smith2020", "type": "article-journal", "title": "On records", "author": [{"family": "Smith", "given": "Anna"}], "container-title": "Journal of Records", "issued": {"date-parts": [[2020]]}, "volume": "3", "page": "1-10"},
    {"id": "doe2021", "type": "book", "title": "Manuscripts", "author": [{"family": "Doe", "given": "John"}], "publisher": "Press", "issued": {"date-parts": [[2021]]}},
    {"id": "roe2019", "type": "paper-conference", "title": "Typesetting at scale", "author": [{"family": "Roe", "given": "Jane"}], "container-title": "Proceedings of Something", "issued": {"date-parts": [[2019]]}},
]


class RequestReading(unittest.TestCase):
    def test_the_image_carries_the_generic_article_and_ieee(self) -> None:
        self.assertEqual(sorted(VENUES), ["generic", "ieee"])
        self.assertEqual(VENUES["ieee"]["bibliographyStyle"], "IEEEtran")

    def test_a_request_is_read_with_its_venue_its_ast_its_references_and_its_figures(self) -> None:
        body = json.dumps({"venue": "ieee", "ast": {"blocks": [], "meta": {}}, "references": REFERENCES, "files": {"pixel.png": PIXEL}}).encode()
        request = front.read_request(body, VENUES)
        self.assertEqual(request["venueId"], "ieee")
        self.assertEqual(request["ast"]["pandoc-api-version"], front.PANDOC_API_VERSION)
        self.assertEqual(request["files"]["pixel.png"][:4], b"\x89PNG")

    def test_misfits_are_refused_in_words(self) -> None:
        cases = {
            "not json": (b"{", "a manuscript request is JSON"),
            "an unknown venue": (json.dumps({"venue": "nature", "ast": {"blocks": []}}).encode(), "no venue 'nature'"),
            "no ast": (json.dumps({"venue": "generic"}).encode(), "ast is a Pandoc JSON document"),
            "a reference without its id": (json.dumps({"ast": {"blocks": []}, "references": [{"title": "x"}]}).encode(), "each with its id"),
            "a figure in a directory": (json.dumps({"ast": {"blocks": []}, "files": {"../secret.png": PIXEL}}).encode(), "named by its file alone"),
            "a dot file": (json.dumps({"ast": {"blocks": []}, "files": {".latexmkrc": PIXEL}}).encode(), "named by its file alone"),
            "the manuscript's own name": (json.dumps({"ast": {"blocks": []}, "files": {"references.bib": PIXEL}}).encode(), "named by its file alone"),
            "a file that is no figure": (json.dumps({"ast": {"blocks": []}, "files": {"evil.tex": PIXEL}}).encode(), "is not a figure"),
            "bytes that are not base64": (json.dumps({"ast": {"blocks": []}, "files": {"a.png": "!!"}}).encode(), "is not base64"),
        }
        for name, (body, words) in cases.items():
            with self.subTest(name):
                with self.assertRaises(front.Refused) as refused:
                    front.read_request(body, VENUES)
                self.assertIn(words, refused.exception.message)
                self.assertEqual(refused.exception.status, 400)

    def test_the_log_is_read_as_errors_with_their_line_and_warnings_once(self) -> None:
        log = "\n".join([
            "LaTeX Warning: Citation `x' undefined on input line 3.",
            "! Undefined control sequence.",
            "l.12 \\foo",
            "LaTeX Warning: Citation `x' undefined on input line 3.",
        ])
        self.assertEqual(front.warnings_of(log), ["LaTeX Warning: Citation `x' undefined on input line 3.", "! Undefined control sequence. l.12 \\foo"])
        self.assertEqual(front.warnings_of("./manuscript.tex:37: LaTeX Error: \\begin{equation} ended by \\end{notequation}."), ["./manuscript.tex:37: LaTeX Error: \\begin{equation} ended by \\end{notequation}."])


class Served(unittest.TestCase):
    """The front over HTTP, against the real engine where it is installed."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = front.serve(BEARER, VENUES, 0, front.Engine(25.0, unprivileged()))
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def ask(self, method: str, path: str, payload: dict | None = None, bearer: str | None = BEARER):
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=data, method=method)
        if bearer is not None:
            request.add_header("Authorization", f"Bearer {bearer}")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=120) as answer:  # noqa: S310 - the loopback address
                return answer.status, json.loads(answer.read())
        except urllib.error.HTTPError as refused:
            return refused.code, json.loads(refused.read())

    def test_a_wrong_bearer_is_refused_before_anything_is_read(self) -> None:
        status, answer = self.ask("POST", "/v1/manuscripts", {"ast": {"blocks": []}}, bearer="wrong")
        self.assertEqual(status, 401)
        self.assertIn("bearer", answer["error"])

    def test_another_route_and_another_method_are_refused_in_words(self) -> None:
        self.assertEqual(self.ask("POST", "/v1/other", {})[0], 404)
        self.assertEqual(self.ask("DELETE", "/v1/manuscripts")[0], 405)

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_health_names_the_engine_and_the_venues(self) -> None:
        status, answer = self.ask("GET", "/health", bearer=None)
        self.assertEqual(status, 200)
        self.assertEqual(answer["venues"], [{"id": "generic", "name": "Generic article"}, {"id": "ieee", "name": "IEEE"}])

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_generic_manuscript_is_typeset_with_its_head_figure_table_equation_and_references(self) -> None:
        status, answer = self.ask("POST", "/v1/manuscripts", {"venue": "generic", "ast": manuscript(), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
        self.assertEqual(status, 200, answer)
        self.assertEqual(answer["outcome"], "ok", answer["log"])
        self.assertTrue(base64.b64decode(answer["pdf"]).startswith(b"%PDF"))
        tex = answer["tex"]
        for expected in ["\\documentclass[11pt]{article}", "Ada Lovelace", "\\begin{abstract}", "provenance, typesetting", "\\citep{smith2020}", "\\citep{doe2021, roe2019}", "\\label{fig:pixel}", "\\bibliographystyle{unsrtnat}", "\\bibliography{references}"]:
            self.assertIn(expected, tex)
        for key in ["smith2020", "doe2021", "roe2019"]:
            self.assertIn(key, answer["bib"])

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_an_ieee_manuscript_is_typeset_in_ieeetran_with_its_style(self) -> None:
        status, answer = self.ask("POST", "/v1/manuscripts", {"venue": "ieee", "ast": manuscript(), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
        self.assertEqual(status, 200, answer)
        self.assertEqual(answer["outcome"], "ok", answer["log"])
        self.assertIn("\\documentclass[conference]{IEEEtran}", answer["tex"])
        self.assertIn("\\IEEEauthorblockN{Ada Lovelace}", answer["tex"])
        self.assertIn("\\bibliographystyle{IEEEtran}", answer["tex"])
        self.assertTrue(base64.b64decode(answer["pdf"]).startswith(b"%PDF"))

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_referred_to_paragraph_is_a_numbered_remark_under_both_venues(self) -> None:
        """A paragraph another sentence refers to is set apart as Remark 1 by the
        environment the templates define, and a section is referred to by the
        label Pandoc gives its header (BO_0300_013)."""
        extra = [
            {"t": "Para", "c": text("As") + [{"t": "Space"}, {"t": "RawInline", "c": ["latex", "Section~\\ref{introduction}"]}, {"t": "Space"}] + text("and") + [{"t": "Space"}, {"t": "RawInline", "c": ["latex", "Remark~\\ref{par:claim}"]}, {"t": "Space"}] + text("say.")},
            {"t": "RawBlock", "c": ["latex", "\\begin{remark}\\label{par:claim}"]},
            {"t": "Para", "c": text("A paragraph another sentence refers to.")},
            {"t": "RawBlock", "c": ["latex", "\\end{remark}"]},
        ]
        for venue in ("generic", "ieee"):
            status, answer = self.ask("POST", "/v1/manuscripts", {"venue": venue, "ast": manuscript(extra), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
            self.assertEqual(status, 200, answer)
            self.assertEqual(answer["outcome"], "ok", (venue, answer["log"]))
            self.assertIn("\\newtheorem{remark}{Remark}", answer["tex"])
            self.assertIn("\\begin{remark}\\label{par:claim}", answer["tex"])
            words = pdf_text(base64.b64decode(answer["pdf"]))
            self.assertIn("Remark1", words, venue)
            self.assertNotIn("??", words, venue)

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_numbered_listing_is_a_captioned_float_under_both_venues(self) -> None:
        """A code block its author numbers is set in the listing float the
        templates define, holding Pandoc's own coloured, line-numbered block,
        captioned and labelled, and a sentence refers to it as Listing 1
        (BO_0303_006)."""
        extra = [
            {"t": "Para", "c": text("As") + [{"t": "Space"}, {"t": "RawInline", "c": ["latex", "Listing~\\ref{lst:code}"]}, {"t": "Space"}] + text("shows.")},
            {"t": "RawBlock", "c": ["latex", "\\begin{listing}[htbp]"]},
            {"t": "CodeBlock", "c": [["", ["python", "numberLines"], [["startFrom", "40"]]], "def f(x):\n    return x + 1  # a comment"]},
            {"t": "RawBlock", "c": ["latex", "\\caption{The function.}\\label{lst:code}\\end{listing}"]},
        ]
        for venue in ("generic", "ieee"):
            status, answer = self.ask("POST", "/v1/manuscripts", {"venue": venue, "ast": manuscript(extra), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
            self.assertEqual(status, 200, answer)
            self.assertEqual(answer["outcome"], "ok", (venue, answer["log"]))
            self.assertIn("\\newfloat{listing}{htbp}{lol}", answer["tex"])
            self.assertIn("\\begin{listing}[htbp]", answer["tex"])
            self.assertIn("numbers=left", answer["tex"])
            self.assertIn("firstnumber=40", answer["tex"])
            words = pdf_text(base64.b64decode(answer["pdf"]))
            self.assertIn("AsListing1shows.", words, venue)
            self.assertIn("Listing1:Thefunction.", words, venue)
            self.assertNotIn("??", words, venue)

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_code_block_is_set_in_colour_with_shell_escape_still_off(self) -> None:
        """Pandoc colours code itself; the venues' templates carry the macros.

        No Pygments and no `minted`, so the run is the same `-no-shell-escape`
        run every other manuscript gets. BO_0296_008
        """
        code = [{"t": "CodeBlock", "c": [["", ["python"], []], "def solve(a, b):\n    # keep the sign\n    if a > b:\n        return a - b\n    return b - a\n"]}]
        for venue in ("generic", "ieee"):
            with self.subTest(venue=venue):
                status, answer = self.ask("POST", "/v1/manuscripts", {"venue": venue, "ast": manuscript(code), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
                self.assertEqual(status, 200, answer)
                self.assertEqual(answer["outcome"], "ok", answer["log"])
                tex = answer["tex"]
                # The macros the template carries, and the tokens Pandoc wrote.
                self.assertIn("DefineVerbatimEnvironment{Highlighting}", tex)
                for token in ("\\KeywordTok", "\\CommentTok", "\\ControlFlowTok"):
                    self.assertIn(token, tex)
                self.assertTrue(base64.b64decode(answer["pdf"]).startswith(b"%PDF"))

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_tex_cannot_read_a_file_outside_its_directory(self) -> None:
        reading = [{"t": "RawBlock", "c": ["latex", "\\input{/etc/passwd}"]}]
        status, answer = self.ask("POST", "/v1/manuscripts", {"venue": "generic", "ast": manuscript(reading), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
        self.assertEqual(status, 200)
        self.assertNotEqual(answer["outcome"], "ok")
        self.assertTrue(any("passwd" in line for line in answer["log"]), answer["log"])
        if "pdf" in answer:
            self.assertNotIn(b"root:x", base64.b64decode(answer["pdf"]))

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_manuscript_that_cannot_be_typeset_still_answers_its_source(self) -> None:
        broken = [{"t": "RawBlock", "c": ["latex", "\\begin{equation} x \\end{notequation}"]}]
        status, answer = self.ask("POST", "/v1/manuscripts", {"venue": "generic", "ast": manuscript(broken), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
        self.assertEqual(status, 200)
        self.assertIn(answer["outcome"], ["errors", "failed"])
        self.assertIn("\\end{notequation}", answer["tex"])
        self.assertTrue(any("notequation" in line for line in answer["log"]), answer["log"])

    @unittest.skipUnless(ENGINE_PRESENT, "the engine is on the image, not here")
    def test_a_typesetting_past_its_cap_is_stopped_and_answers_its_source(self) -> None:
        slow = front.serve(BEARER, VENUES, 0, front.Engine(0.5, unprivileged()))
        threading.Thread(target=slow.serve_forever, daemon=True).start()
        try:
            port, self.port = self.port, slow.server_address[1]
            status, answer = self.ask("POST", "/v1/manuscripts", {"venue": "generic", "ast": manuscript(), "references": REFERENCES, "files": {"pixel.png": PIXEL}})
        finally:
            self.port = port
            slow.shutdown()
            slow.server_close()
        self.assertEqual(status, 200)
        self.assertEqual(answer["outcome"], "timed out")
        self.assertIn("was stopped", " ".join(answer["log"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
