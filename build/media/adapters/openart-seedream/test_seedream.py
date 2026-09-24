import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import seedream


def image_bytes(size=(1536, 2730), color="red"):
    stream = io.BytesIO()
    Image.new("RGB", size, color).save(stream, "PNG")
    return stream.getvalue()


FORM = {
    "jsonSchema": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "maxLength": 12000},
            "visualReferences": {"type": "array", "maxItems": 10},
            "aspectRatio": {"type": "string", "enum": ["1:1", "9:16", "16:9"], "default": "1:1"},
            "resolution": {"type": "string", "enum": ["2K", "4K"], "default": "2K"},
            "seed": {"type": "integer"},
        },
    }
}


class FakeCLI:
    def __init__(self, *, credits=(100, 90), wait=None, logged_in=True, form=FORM):
        self.credits = list(credits)
        self.wait_result = wait if wait is not None else {
            "status": "completed",
            "resources": [{"url": "https://cdn.openart.ai/out/1.png", "thumbnailUrl": "https://cdn.openart.ai/t.png"}],
        }
        self.logged_in = logged_in
        self.form_result = form
        self.calls = []

    def _gate(self):
        if not self.logged_in:
            raise seedream.NotLoggedIn("error: not logged in — run `openart login`")

    def account(self):
        self.calls.append(("account",))
        self._gate()
        return {"email": "x", "credits": self.credits.pop(0) if len(self.credits) > 1 else self.credits[0]}

    def form(self, model, mode):
        self.calls.append(("form", model, mode))
        self._gate()
        return self.form_result

    def cost(self, model, mode):
        self.calls.append(("cost", model, mode))
        return {"items": [{"model": model, "totalCredits": 10}]}

    def upload(self, path):
        self.calls.append(("upload", path))
        return {"id": f"id-{Path(path).stem}", "url": f"https://cdn.openart.ai/openart-uploads/{Path(path).name}"}

    def wait(self, history_id, timeout_seconds):
        self.calls.append(("wait", history_id))
        if isinstance(self.wait_result, Exception):
            raise self.wait_result
        return self.wait_result

    def version(self):
        return "0.1.1"


class FakeAPI:
    def __init__(self, outcome):
        self.outcome = outcome
        self.bodies = []

    def generate(self, body, timeout_seconds=120.0):
        self.bodies.append(body)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


URLS = {"the_shop": {"id": "i1", "url": "u1"}, "codey": {"id": "i2", "url": "u2"}, "codey_face": {"id": "i3", "url": "u3"}}


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.dir = Path(self.temporary.name)
        for name in ("shop.png", "codey.png", "codey_face.png"):
            (self.dir / name).write_bytes(image_bytes((32, 32)))

    def tearDown(self):
        self.temporary.cleanup()

    def request(self, prompt="@the_shop with @codey and @codey_face", **overrides):
        values = dict(
            prompt=prompt,
            output=self.dir / "out.png",
            format="portrait-720p",
            references=(
                seedream.ReferenceImage.parse(f"@the_shop={self.dir / 'shop.png'}"),
                seedream.ReferenceImage.parse(f"@codey={self.dir / 'codey.png'}"),
                seedream.ReferenceImage.parse(f"@codey_face={self.dir / 'codey_face.png'}"),
            ),
        )
        values.update(overrides)
        return seedream.ImageRequest(**values)


class PromptTests(unittest.TestCase):
    def test_aliases_expand_to_ordered_images_without_prefix_collisions(self):
        refs = (
            seedream.ReferenceImage("codey", "/a.png"),
            seedream.ReferenceImage("codey_face", "/b.png"),
            seedream.ReferenceImage("shop-a", "/c.png"),
        )
        result = seedream.expanded_prompt("@codey, @codey_face, @shop-a.", refs)
        self.assertIn("- Image 1: @codey\n- Image 2: @codey_face\n- Image 3: @shop-a", result)
        self.assertIn("Image 1 (@codey), Image 2 (@codey_face), Image 3 (@shop-a).", result)

    def test_foreign_url_is_refused(self):
        with self.assertRaises(seedream.InvalidRequest):
            seedream.ReferenceImage.parse("@x=https://example.com/x.png")
        ref = seedream.ReferenceImage.parse("@x=https://cdn.openart.ai/x.png")
        self.assertTrue(ref.is_url)


class ValidationTests(Fixture):
    def test_unattached_alias_is_invalid(self):
        with self.assertRaises(seedream.InvalidRequest):
            self.request(prompt="@missing").validate()

    def test_aspect_param_cannot_be_overridden(self):
        with self.assertRaises(seedream.InvalidRequest):
            self.request(params=(("aspectRatio", "1:1"),)).validate()

    def test_unknown_param_fails_against_the_form(self):
        props = seedream.form_properties(FORM)
        with self.assertRaises(seedream.InvalidRequest):
            seedream.build_params(self.request(params=(("quality", "hd"),)), props, URLS)

    def test_enum_and_type_are_checked(self):
        props = seedream.form_properties(FORM)
        with self.assertRaises(seedream.InvalidRequest):
            seedream.build_params(self.request(params=(("resolution", "8K"),)), props, URLS)
        params = seedream.build_params(
            self.request(params=(("resolution", "4K"), ("seed", "7"))), props, URLS
        )
        self.assertEqual(params["aspectRatio"], "9:16")
        self.assertEqual(params["resolution"], "4K")
        self.assertEqual(params["seed"], 7)
        self.assertEqual(params["visualReferences"][1], {"label": "codey", "type": "image", "id": "i2", "url": "u2"})

    def test_aspect_key_follows_the_form(self):
        form = {"jsonSchema": {"properties": {"aspect_ratio": {"enum": ["9:16"]}}}}
        params = seedream.build_params(
            self.request(), seedream.form_properties(form), URLS
        )
        self.assertEqual(params["aspect_ratio"], "9:16")

    def test_form_without_aspect_fails_before_spending(self):
        form = {"jsonSchema": {"properties": {"prompt": {"type": "string"}}}}
        with self.assertRaises(seedream.InvalidRequest):
            seedream.build_params(self.request(), seedream.form_properties(form), URLS)

    def test_reference_cap(self):
        form = {"jsonSchema": {"properties": {"aspectRatio": {}, "visualReferences": {"maxItems": 2}}}}
        with self.assertRaises(seedream.InvalidRequest):
            seedream.build_params(self.request(), seedream.form_properties(form), URLS)


class RunTests(Fixture):
    def test_generate_uploads_submits_once_waits_and_delivers_exact_size(self):
        cli = FakeCLI()
        api = FakeAPI({"historyId": "h123"})
        with patch("seedream.download", return_value=image_bytes()):
            result = seedream.SeedreamRun(cli, lambda: api).generate(self.request())
        self.assertTrue(result.ok, result.to_dict())
        self.assertEqual(len(api.bodies), 1)
        body = api.bodies[0]
        self.assertEqual(body["model"], "byte-plus-seedream-5-pro")
        self.assertEqual(body["mode"], "image2image")
        self.assertEqual(body["params"]["aspectRatio"], "9:16")
        self.assertEqual(
            [r["url"] for r in body["params"]["visualReferences"]],
            ["https://cdn.openart.ai/openart-uploads/shop.png",
             "https://cdn.openart.ai/openart-uploads/codey.png",
             "https://cdn.openart.ai/openart-uploads/codey_face.png"],
        )
        self.assertEqual(body["params"]["visualReferences"][0]["id"], "id-shop")
        self.assertEqual(result.history_id, "h123")
        self.assertEqual(result.credits, {"before": 100, "after": 90, "spent": 10})
        self.assertEqual(result.image["source_url"], "https://cdn.openart.ai/out/1.png")
        with Image.open(self.dir / "out.png") as saved:
            self.assertEqual(saved.size, (720, 1280))
        self.assertEqual((result.image["native_width"], result.image["native_height"]), (1536, 2730))

    def test_bad_param_fails_before_any_upload(self):
        cli = FakeCLI()
        api = FakeAPI({"historyId": "h"})
        with self.assertRaises(seedream.InvalidRequest):
            seedream.SeedreamRun(cli, lambda: api).generate(self.request(params=(("resolution", "8K"),)))
        self.assertFalse([c for c in cli.calls if c[0] == "upload"])
        self.assertEqual(api.bodies, [])

    def test_transient_submit_error_is_not_resent(self):
        api = FakeAPI(seedream.TransportError("busy", status=503, retry_after_seconds=5))
        result = seedream.SeedreamRun(FakeCLI(credits=(100, 100)), lambda: api).generate(self.request())
        self.assertFalse(result.ok)
        self.assertEqual(len(api.bodies), 1)
        self.assertTrue(result.retry.allowed)
        self.assertEqual(result.retry.after_seconds, 5)
        self.assertEqual(result.credits["spent"], 0)

    def test_connection_drop_on_submit_is_ambiguous(self):
        api = FakeAPI(seedream.TransportError("reset"))
        result = seedream.SeedreamRun(FakeCLI(), lambda: api).generate(self.request())
        self.assertFalse(result.retry.allowed)
        self.assertEqual(result.error.kind, "ambiguous_submission")

    def test_wait_timeout_hands_back_resume(self):
        cli = FakeCLI(wait=seedream.CLIError("timed out", timed_out=True))
        result = seedream.SeedreamRun(cli, lambda: FakeAPI({"data": {"historyId": "h9"}})).generate(self.request())
        self.assertFalse(result.ok)
        self.assertEqual(result.error.kind, "still_running")
        self.assertIn("--resume h9", result.resume)

    def test_failed_generation_reports_reason(self):
        cli = FakeCLI(wait={"status": "FAILED", "errorReason": "moderation"})
        result = seedream.SeedreamRun(cli, lambda: FakeAPI({"historyId": "h"})).generate(self.request())
        self.assertEqual(result.error.kind, "generation_failed")
        self.assertIn("moderation", result.error.message)

    def test_resume_sends_nothing(self):
        cli = FakeCLI()
        api = FakeAPI({"historyId": "never"})
        request = seedream.ImageRequest(prompt="", output=self.dir / "r.png", format="landscape")
        with patch("seedream.download", return_value=image_bytes((2730, 1536))):
            result = seedream.SeedreamRun(cli, lambda: api).resume(request, "h5")
        self.assertTrue(result.ok)
        self.assertEqual(api.bodies, [])
        self.assertEqual((result.image["width"], result.image["height"]), (2730, 1536))

    def test_dry_run_uploads_nothing_and_works_logged_out(self):
        cli = FakeCLI(logged_in=False)
        result = seedream.SeedreamRun(cli, lambda: FakeAPI({})).dry_run(self.request())
        self.assertTrue(result.ok)
        self.assertFalse([c for c in cli.calls if c[0] == "upload"])
        refs = result.request["params"]["visualReferences"]
        self.assertTrue(refs[0]["url"].startswith("(uploaded from "))
        self.assertTrue(result.notes)


class ResponseTests(unittest.TestCase):
    def test_result_urls_skip_thumbnails_and_dedupe(self):
        obj = {"resources": [{"url": "https://a/1.png", "thumbnailUrl": "https://a/t.png"},
                             {"url": "https://a/1.png"}]}
        self.assertEqual(seedream.result_urls(obj), ["https://a/1.png"])

    def test_result_urls_never_return_a_reference(self):
        obj = {"params": {"visualReferences": [{"url": "https://cdn.openart.ai/openart-uploads/ref.png"}]},
               "url": "https://cdn.openart.ai/openart-ai/production/out.png"}
        self.assertEqual(seedream.result_urls(obj), ["https://cdn.openart.ai/openart-ai/production/out.png"])
        with_resources = {"url": "https://x/history.png", "resources": [{"url": "https://x/1.png"}, {"url": "https://x/2.png"}]}
        self.assertEqual(seedream.result_urls(with_resources), ["https://x/1.png", "https://x/2.png"])

    def test_history_id_prefers_history_id(self):
        self.assertEqual(seedream.find_key({"id": "x", "generation": {"historyId": "h"}}, ("historyId", "id")), "h")

    def test_access_token_checks_origin(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "c.json"
            path.write_text(json.dumps({"accessToken": "t", "origin": "https://testing.openart.ai"}))
            with self.assertRaises(seedream.NotLoggedIn):
                seedream.access_token(path)
            path.write_text(json.dumps({"accessToken": "t", "origin": "https://openart.ai"}))
            self.assertEqual(seedream.access_token(path), "t")


if __name__ == "__main__":
    unittest.main()


class AnUnchosenShape(unittest.TestCase):
    """No format chosen means no shape asked for, and the vendor applies its own. BO_0279_003

    `landscape-1080p` was the default and decided every unchosen request: 16:9, upscaled to
    1920x1080. That is a delivery convention, not something the request asked for.
    """

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.dir = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def request(self, **overrides):
        values = dict(prompt="a laurel", output=self.dir / "out.png", references=())
        values.update(overrides)
        return seedream.ImageRequest(**values)

    def props(self):
        return {"prompt": {"type": "string"},
                "aspectRatio": {"type": "string", "enum": ["1:1", "4:3", "16:9", "9:16"]},
                "resolution": {"type": "string", "enum": ["1K", "2K"]}}

    def test_no_format_asks_for_no_aspect_ratio(self):
        params = seedream.build_params(self.request(), self.props(), {})
        self.assertNotIn("aspectRatio", params)

    def test_no_format_keeps_the_pixels_the_vendor_returned(self):
        self.assertIsNone(seedream.preset_of(self.request()).width)
        self.assertIsNone(seedream.preset_of(self.request()).height)

    def test_a_chosen_format_still_asks_for_its_shape(self):
        params = seedream.build_params(self.request(format="portrait-720p"), self.props(), {})
        self.assertEqual(params["aspectRatio"], "9:16")
        self.assertEqual(seedream.preset_of(self.request(format="portrait-720p")).width, 720)

    def test_a_chosen_param_is_what_reaches_the_vendor(self):
        """The service sends OpenArt's axes as `--param`, under the vendor's own key."""
        params = seedream.build_params(
            self.request(params=(("aspectRatio", "16:9"),)), self.props(), {})
        self.assertEqual(params["aspectRatio"], "16:9")

    def test_a_request_with_no_format_validates(self):
        """The validation path the unit tests bypassed: `format=None` read as an unknown
        format and every unchosen OpenArt request was refused before anything was sent. Found
        by quoting on the instance, never by a test of `build_params`. BO_0279_003"""
        self.request().validate()

    def test_an_unknown_format_is_still_refused(self):
        with self.assertRaises(seedream.InvalidRequest):
            self.request(format="cinema-4k").validate()

    def test_an_aspect_param_is_allowed_when_no_format_was_chosen(self):
        """How a chosen ratio reaches OpenArt: the vendor's own key through `--param`. The
        guard refused every one of them while a format was always chosen. BO_0279_003"""
        self.request(params=(("aspectRatio", "16:9"),)).validate()

    def test_an_aspect_param_still_collides_with_a_chosen_format(self):
        with self.assertRaises(seedream.InvalidRequest):
            self.request(format="portrait-720p", params=(("aspectRatio", "16:9"),)).validate()
