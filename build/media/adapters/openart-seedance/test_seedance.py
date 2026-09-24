import json
import os
import tempfile
import unittest
from pathlib import Path

import seedance


base = seedance.base
openart = seedance.openart

COMMON = {
    "prompt": {"default": "", "type": "string", "maxLength": 30000},
    "videoCount": {"default": 1, "type": "integer", "minimum": 1, "maximum": 8},
    "duration": {"default": 5, "type": "integer", "minimum": 4, "maximum": 15},
    "aspectRatio": {"default": "16:9", "type": "string",
                    "enum": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive", "auto"]},
    "resolution": {"default": "720p", "type": "string", "enum": ["480p", "720p"]},
    "generateAudio": {"default": True, "type": "boolean"},
    "seed": {"default": -1, "type": "number"},
}
FRAME = {"type": "object", "properties": {"type": {"type": "string", "const": "image"}, "id": {"type": "string"},
         "url": {"type": "string"}, "label": {"type": "string"}}}
# The forms `openart model form byte-plus-seedance-2-mini <mode> --json` returned on 2026-09-11.
FORMS = {
    "image2video": {"model": seedance.MODEL, "mode": "image2video", "media": "video", "jsonSchema": {
        "type": "object", "additionalProperties": False, "required": ["startFrame"],
        "properties": {**COMMON, "startFrame": FRAME, "endFrame": {"anyOf": [FRAME, {"type": "null"}]}}}},
    "element2video": {"model": seedance.MODEL, "mode": "element2video", "media": "video", "jsonSchema": {
        "type": "object", "additionalProperties": False, "required": ["visualReferences"],
        "properties": {**COMMON, "autoEnhancePrompt": {"type": "boolean"},
                       "visualReferences": {"type": "array", "minItems": 1}}}},
}
DONE = {
    "history": {"id": "h1", "status": "completed"},
    "resources": [{"id": "r1", "url": "https://cdn.openart.ai/openart-ai/production/out.mp4",
                   "thumbnailUrl": "https://cdn.openart.ai/thumb.webp", "resourceType": "video"}],
}


class FakeCLI:
    binary = "openart"

    def __init__(self, *, polls=None, credits=(1000, 680), logged_in=True, forms=FORMS):
        self.polls = list(polls if polls is not None else [DONE])
        self.credits = list(credits)
        self.logged_in = logged_in
        self.forms = forms
        self.calls = []

    def _gate(self):
        if not self.logged_in:
            raise openart.NotLoggedIn("error: not logged in — run `openart login`")

    def account(self):
        self.calls.append(("account",))
        self._gate()
        return {"plan": "Pro", "credits": self.credits.pop(0) if len(self.credits) > 1 else self.credits[0]}

    def form(self, model, mode):
        self.calls.append(("form", model, mode))
        self._gate()
        return self.forms[mode]

    def cost(self, model, mode):
        self.calls.append(("cost", model, mode))
        return {"items": [{"model": model, "mode": mode, "totalCredits": 200,
                           "config": {"duration": 5, "aspectRatio": "16:9", "resolution": "720p"}}]}

    def upload(self, path):
        self.calls.append(("upload", path))
        return {"id": f"id-{Path(path).stem}", "url": f"https://cdn.openart.ai/openart-uploads/{Path(path).name}"}

    def run_json(self, *args, timeout=120.0):
        self.calls.append(args)
        outcome = self.polls.pop(0) if len(self.polls) > 1 else self.polls[0]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    def version(self):
        return "0.1.1"


class FakeAPI:
    def __init__(self, outcome=None):
        self.outcome = outcome if outcome is not None else {"historyId": "h1"}
        self.bodies = []

    def generate(self, body, timeout_seconds=120.0):
        self.bodies.append(body)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.dir = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def ref(self, alias, kind="image", suffix=".png"):
        path = self.dir / f"{alias}{suffix}"
        path.write_bytes(b"plate")
        return base.Reference(alias, str(path), kind)

    def frames(self, **overrides):
        fields = dict(prompt="@panel comes alive and settles on @last.", duration=8,
                      output=self.dir / "take.mp4", references=(self.ref("panel"), self.ref("last")),
                      start_alias="panel", end_alias="last")
        fields.update(overrides)
        return seedance.OpenArtRequest(**fields)

    def elements(self, **overrides):
        fields = dict(prompt="@milo at the grinder, @milo_face for the face, the room from @cafe.", duration=8,
                      output=self.dir / "take.mp4",
                      references=(self.ref("milo"), self.ref("milo_face"), self.ref("cafe")))
        fields.update(overrides)
        return seedance.OpenArtRequest(**fields)

    def generate(self, request, cli=None, api=None, video=b"mp4 bytes"):
        self.cli = cli or FakeCLI()
        self.api = api or FakeAPI()
        transport = seedance.OpenArtTransport(self.cli, lambda: self.api, lambda url, timeout: video)
        generator = seedance.OpenArtGenerator(transport, seedance.OpenArtUploader(self.cli),
                                              sleeper=lambda seconds: None)
        return generator.generate(request)


class BodyTests(Fixture):
    def test_frames_go_as_image2video_start_and_end(self):
        body = seedance.placeholder_body(self.frames())
        self.assertEqual(body["mode"], "image2video")
        params = body["params"]
        self.assertEqual(params["startFrame"]["label"], "panel")
        self.assertEqual(params["endFrame"]["label"], "last")
        self.assertNotIn("visualReferences", params)
        self.assertNotIn("autoEnhancePrompt", params)
        self.assertEqual((params["aspectRatio"], params["resolution"], params["duration"]), ("9:16", "720p", 8))
        self.assertEqual(params["videoCount"], 1)
        seedance.check_against_form(params, FORMS["image2video"], "image2video")

    def test_references_go_as_element2video_in_order(self):
        body = seedance.placeholder_body(self.elements())
        self.assertEqual(body["mode"], "element2video")
        params = body["params"]
        self.assertEqual([item["label"] for item in params["visualReferences"]], ["milo", "milo_face", "cafe"])
        self.assertIs(params["autoEnhancePrompt"], False)
        self.assertNotIn("startFrame", params)
        self.assertIn("@milo = image reference 1", params["prompt"])
        seedance.check_against_form(params, FORMS["element2video"], "element2video")

    def test_video_and_audio_elements_carry_their_type(self):
        request = self.elements(prompt="@milo speaks with @voice, moving like @move.",
                                references=(self.ref("milo"), self.ref("move", "video", ".mp4"),
                                            self.ref("voice", "audio", ".wav")))
        types = [item["type"] for item in seedance.placeholder_body(request)["params"]["visualReferences"]]
        self.assertEqual(types, ["image", "video", "audio"])

    def test_landscape_480p_and_seed(self):
        params = seedance.placeholder_body(self.elements(format="landscape-480p", seed=7))["params"]
        self.assertEqual((params["aspectRatio"], params["resolution"], params["seed"]), ("16:9", "480p", 7))


class ValidationTests(Fixture):
    def test_start_frame_with_references_is_refused(self):
        request = self.frames(prompt="@panel with @hero.", references=(self.ref("panel"), self.ref("hero")),
                              end_alias=None)
        with self.assertRaisesRegex(base.InvalidRequest, "separate modes"):
            request.validate()

    def test_end_frame_alone_is_refused(self):
        request = self.frames(prompt="ends on @last.", references=(self.ref("last"),), start_alias=None)
        with self.assertRaisesRegex(base.InvalidRequest, "start frame"):
            request.validate()

    def test_duration_is_four_to_fifteen(self):
        self.elements(duration=15).validate()
        with self.assertRaises(base.InvalidRequest):
            self.elements(duration=16).validate()

    def test_genre_and_1080p_are_refused(self):
        with self.assertRaises(base.InvalidRequest):
            self.elements(genre="drama").validate()
        with self.assertRaises(base.InvalidRequest):
            self.elements(format="portrait-1080p").validate()

    def test_urls_and_unknown_suffixes_are_refused(self):
        url = base.Reference("milo", "https://cdn.openart.ai/x.png", "image")
        with self.assertRaisesRegex(base.InvalidRequest, "local files"):
            self.elements(prompt="@milo", references=(url,)).validate()
        with self.assertRaisesRegex(base.InvalidRequest, "OpenArt uploads only"):
            self.elements(prompt="@milo", references=(self.ref("milo", "image", ".gif"),)).validate()

    def test_every_attachment_must_be_named(self):
        with self.assertRaises(base.InvalidRequest):
            self.elements(prompt="@milo at the grinder.").validate()

    def test_form_refuses_unknown_keys_ranges_and_enums(self):
        params = seedance.placeholder_body(self.elements())["params"]
        with self.assertRaisesRegex(base.InvalidRequest, "genre is not in"):
            seedance.check_against_form({**params, "genre": "drama"}, FORMS["element2video"], "element2video")
        with self.assertRaisesRegex(base.InvalidRequest, "outside"):
            seedance.check_against_form({**params, "duration": 20}, FORMS["element2video"], "element2video")
        with self.assertRaisesRegex(base.InvalidRequest, "not accepted"):
            seedance.check_against_form({**params, "resolution": "1080p"}, FORMS["element2video"], "element2video")
        with self.assertRaisesRegex(base.InvalidRequest, "requires"):
            seedance.check_against_form({"prompt": "x"}, FORMS["element2video"], "element2video")


class RequestJSONTests(Fixture):
    def test_a_higgsfield_request_runs_unchanged(self):
        panel = self.ref("panel")
        request = seedance.request_from_dict({
            "prompt": "Use @panel as the shot.", "duration": 8, "model": "seedance_2_0_mini",
            "references": [{"alias": "panel", "path": panel.source, "type": "image", "role": "start"}],
            "format": "portrait-720p", "output": str(self.dir / "t.mp4"),
        })
        self.assertIsInstance(request, seedance.OpenArtRequest)
        self.assertEqual(request.model, seedance.MODEL)
        self.assertEqual(request.start_alias, "panel")
        request.validate()

    def test_another_model_is_refused(self):
        with self.assertRaises(base.InvalidRequest):
            seedance.request_from_dict({"prompt": "x", "duration": 8, "model": "seedance_2_5"})

    def test_flags_parse_like_the_higgsfield_service(self):
        panel = self.ref("panel")
        args = seedance._parser().parse_args([
            "--prompt", "@panel moves.", "--duration", "6", "--start-image", f"@panel={panel.source}",
            "--seed", "3", "--output", str(self.dir / "o.mp4"),
        ])
        request = seedance._cli_request(args)
        self.assertEqual((request.start_alias, request.seed, request.format, request.mode),
                         ("panel", 3, "portrait-720p", "image2video"))


class RunTests(Fixture):
    def test_uploads_posts_once_polls_and_saves(self):
        pending = {"history": {"id": "h1", "status": "processing"}, "resources": []}
        result = self.generate(self.elements(), cli=FakeCLI(polls=[pending, DONE]))
        self.assertTrue(result.ok, result.to_dict())
        self.assertEqual(len(self.api.bodies), 1)
        refs = self.api.bodies[0]["params"]["visualReferences"]
        self.assertEqual(refs[0], {"type": "image", "id": "id-milo", "label": "milo",
                                   "url": "https://cdn.openart.ai/openart-uploads/milo.png"})
        self.assertEqual(result.job["id"], "h1")
        self.assertEqual(result.job["usage"], {"credits_before": 1000, "credits_after": 680, "credits_spent": 320})
        self.assertEqual((result.video["width"], result.video["height"]), (720, 1280))
        saved = Path(result.video["path"])
        self.assertEqual(saved.read_bytes(), b"mp4 bytes")
        self.assertEqual(os.stat(saved).st_mode & 0o777, 0o644)
        self.assertEqual(len([c for c in self.cli.calls if c[:2] == ("creation", "get")]), 2)

    def test_bad_value_fails_before_any_upload(self):
        forms = {**FORMS, "element2video": {"jsonSchema": {"properties": {"prompt": {"type": "string"}}}}}
        result = self.generate(self.elements(), cli=FakeCLI(forms=forms))
        self.assertEqual(result.error.kind, "invalid_request")
        self.assertFalse([c for c in self.cli.calls if c[0] == "upload"])
        self.assertEqual(self.api.bodies, [])

    def test_logged_out_spends_nothing(self):
        result = self.generate(self.elements(), cli=FakeCLI(logged_in=False))
        self.assertFalse(result.ok)
        self.assertEqual(result.error.kind, "not_logged_in")
        self.assertFalse(result.retry.allowed)
        self.assertEqual(self.api.bodies, [])

    def test_connection_drop_on_submit_is_never_resent(self):
        result = self.generate(self.elements(), api=FakeAPI(openart.TransportError("reset")))
        self.assertEqual(len(self.api.bodies), 1)
        self.assertFalse(result.retry.allowed)
        self.assertIn("duplicate", result.retry.reason)

    def test_503_on_submit_is_left_to_the_caller(self):
        result = self.generate(self.elements(), api=FakeAPI(openart.TransportError("busy", status=503, retry_after_seconds=5)))
        self.assertEqual(len(self.api.bodies), 1)
        self.assertTrue(result.retry.allowed)
        self.assertEqual(result.retry.after_seconds, 5)

    def test_402_is_permanent(self):
        result = self.generate(self.elements(), api=FakeAPI(openart.TransportError("no credits", status=402)))
        self.assertEqual(result.error.kind, "insufficient_credits")
        self.assertFalse(result.retry.allowed)

    def test_failed_generation_reports_its_reason(self):
        failed = {"history": {"id": "h1", "status": "failed", "errorReason": "moderation"}}
        result = self.generate(self.elements(), cli=FakeCLI(polls=[failed]))
        self.assertEqual(result.error.kind, "job_failed")
        self.assertIn("moderation", result.error.message)
        self.assertIn("usage", result.job)

    def test_poll_timeout_hands_back_the_history_id(self):
        pending = {"history": {"id": "h1", "status": "processing"}}
        result = self.generate(self.elements(max_poll_seconds=0.001), cli=FakeCLI(polls=[pending]))
        self.assertFalse(result.ok)
        self.assertTrue(result.retry.allowed)
        self.assertEqual(result.job["id"], "h1")

    def test_resume_posts_nothing_and_uploads_nothing(self):
        request = seedance.OpenArtRequest(prompt="", duration=4, output=self.dir / "r.mp4", references=(),
                                          job_id="H7JqXXHaw0pTnGp9MWat")
        result = self.generate(request)
        self.assertTrue(result.ok, result.to_dict())
        self.assertEqual(self.api.bodies, [])
        self.assertFalse([c for c in self.cli.calls if c[0] in {"upload", "form"}])


class DryRunTests(Fixture):
    def test_checks_the_form_and_quotes_without_uploading(self):
        cli = FakeCLI()
        result = seedance.dry_run(self.frames(), cli)
        self.assertTrue(result["ok"])
        self.assertEqual(result["request"]["body"]["mode"], "image2video")
        self.assertEqual(result["request"]["quote"]["total_credits"], 200)
        self.assertFalse([c for c in cli.calls if c[0] == "upload"])

    def test_works_logged_out(self):
        result = seedance.dry_run(self.elements(), FakeCLI(logged_in=False))
        self.assertTrue(result["ok"])
        self.assertIsNone(result["request"]["quote"])
        self.assertTrue(result["request"]["notes"])


class ResponseTests(unittest.TestCase):
    def test_video_url_skips_thumbnails_and_uploads(self):
        finished = {"params": {"visualReferences": [{"url": "https://cdn.openart.ai/openart-uploads/ref.mp4"}]},
                    **DONE}
        self.assertEqual(seedance.video_url_of(finished), "https://cdn.openart.ai/openart-ai/production/out.mp4")

    def test_cli_failures_translate(self):
        self.assertEqual(seedance.translated(openart.CLIError("x", timed_out=True)).code, "cli_timeout")
        self.assertEqual(seedance.translated(openart.CLIError("dial tcp: lookup openart.ai")).code, "connection_error")
        self.assertEqual(seedance.translated(openart.CLIError("generation not found")).code, "job_not_found")
        self.assertEqual(seedance.translated(openart.NotLoggedIn("x")).code, "not_logged_in")


if __name__ == "__main__":
    unittest.main()
