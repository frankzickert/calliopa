import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

import seedance


class FakeTransport:
    def __init__(self, polls=None, submit=None, video=b"video"):
        self.submit_result = submit or {"id": "job_1", "status": "pending"}
        self.polls = list(polls or [{"id": "job_1", "status": "completed", "generation_id": "gen_1"}])
        self.video = video
        self.payload = None
        self.downloaded = None

    def submit(self, payload, timeout):
        self.payload = payload
        if isinstance(self.submit_result, Exception):
            raise self.submit_result
        return self.submit_result

    def poll(self, job_id, timeout):
        value = self.polls.pop(0)
        if isinstance(value, Exception):
            raise value
        return value

    def download(self, job_id, timeout):
        self.downloaded = job_id
        return self.video


class FakePublisher:
    def __init__(self):
        self.published = []
        self.deleted = []

    def publish(self, reference):
        asset = seedance.PublishedAsset(
            f"https://signed.test/{Path(reference.source).name}",
            f"s3://test-bucket/refs/{Path(reference.source).name}",
            reference.source,
        )
        self.published.append(asset)
        return asset

    def delete(self, asset):
        self.deleted.append(asset)


def reference_file(directory, name, content=b"data"):
    path = Path(directory) / name
    path.write_bytes(content)
    return path


class ReferenceTests(unittest.TestCase):
    def test_aliases_become_native_per_type_references(self):
        refs = (
            seedance.Reference("motion", "/tmp/motion.mp4", "video"),
            seedance.Reference("look", "/tmp/look.png", "image"),
            seedance.Reference("face", "/tmp/face.png", "image"),
        )
        expanded = seedance.expanded_prompt("Use @motion, @look, and @face.", refs)
        self.assertIn("@motion = @Video 1", expanded)
        self.assertIn("@look = @Image 1", expanded)
        self.assertIn("@face = @Image 2", expanded)
        self.assertIn("Use @Video 1, @Image 1, and @Image 2", expanded)

    def test_every_attachment_must_be_used(self):
        refs = (seedance.Reference("look", "https://x.test/look.png", "image"),)
        request = seedance.VideoRequest("No reference", 4, Path("x.mp4"), refs)
        result = seedance.SeedanceGenerator(FakeTransport()).generate(request)
        self.assertFalse(result.ok)
        self.assertFalse(result.retry.allowed)
        self.assertIn("every attachment", result.error.message)

    def test_unknown_alias_is_rejected(self):
        refs = (seedance.Reference("look", "https://x.test/look.png", "image"),)
        request = seedance.VideoRequest("Use @other", 4, Path("x.mp4"), refs)
        result = seedance.SeedanceGenerator(FakeTransport()).generate(request)
        self.assertIn("unattached", result.error.message)

    def test_out_of_range_native_reference_is_rejected(self):
        refs = (seedance.Reference("look", "https://x.test/look.png", "image"),)
        request = seedance.VideoRequest("Use @look and @Image 2", 4, Path("x.mp4"), refs)
        result = seedance.SeedanceGenerator(FakeTransport()).generate(request)
        self.assertIn("@Image 2", result.error.message)

    def test_native_reference_satisfies_attachment_requirement(self):
        refs = (
            seedance.Reference("motion", "https://x.test/motion.mp4", "video"),
            seedance.Reference("look", "https://x.test/look.png", "image"),
        )
        request = seedance.VideoRequest(
            "Use @Video 1 for motion and @Image 1 for appearance.",
            4,
            Path("x.mp4"),
            refs,
        )
        request.validate()

    def test_local_files_are_published_as_https_urls(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = reference_file(temporary, "motion.mp4", b"abc")
            ref = seedance.Reference.parse(f"@motion={path}")
            request = seedance.VideoRequest("Use @motion", 4, Path("x.mp4"), (ref,))
            request.validate()
            publisher = FakePublisher()
            published = []
            payload = seedance.build_payload(request, publisher, published)
            url = payload["input_references"][0]["video_url"]["url"]
            self.assertEqual(url, "https://signed.test/motion.mp4")
            self.assertEqual(published, publisher.published)

    def test_local_files_without_publisher_fail_before_submission(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = reference_file(temporary, "motion.mp4", b"abc")
            ref = seedance.Reference.parse(f"@motion={path}")
            result = seedance.SeedanceGenerator(FakeTransport()).generate(
                seedance.VideoRequest("Use @motion", 4, Path("x.mp4"), (ref,))
            )
            self.assertFalse(result.ok)
            self.assertEqual(result.attempts, 0)
            self.assertIn("S3_BUCKET", result.error.message)


class RequestTests(unittest.TestCase):
    def test_extracts_fenced_prompt_from_clip_section(self):
        with tempfile.TemporaryDirectory() as temporary:
            clip = Path(temporary) / "CLIP.md"
            clip.write_text(
                "# 7. Panel\n```text\nwrong\n```\n\n"
                "# 8. Panel + previs → clip\nnotes\n```text\nUse @Video 1.\n```\n"
                "\n# 9. State\nend\n",
                encoding="utf-8",
            )
            self.assertEqual(seedance.read_prompt_file(clip, "8"), "Use @Video 1.")

    def test_defaults_are_portrait_720p_and_audio(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "clip.mp4"
            ref = seedance.Reference("look", "https://x.test/look.png", "image")
            transport = FakeTransport(video=b"mp4-content")
            request = seedance.VideoRequest("Animate @look", 12, output, (ref,))
            result = seedance.SeedanceGenerator(transport, sleeper=lambda _: None).generate(request)
            self.assertTrue(result.ok)
            self.assertEqual(transport.payload["model"], "bytedance/seedance-2.0-mini")
            self.assertEqual(transport.payload["resolution"], "720p")
            self.assertEqual(transport.payload["aspect_ratio"], "9:16")
            self.assertTrue(transport.payload["generate_audio"])
            self.assertEqual(transport.payload["duration"], 12)
            self.assertEqual(output.read_bytes(), b"mp4-content")

    def test_duration_is_required_range(self):
        ref = seedance.Reference("look", "https://x.test/look.png", "image")
        for duration in (3, 16):
            result = seedance.SeedanceGenerator(FakeTransport()).generate(
                seedance.VideoRequest("Use @look", duration, Path("x.mp4"), (ref,)))
            self.assertFalse(result.ok)
            self.assertIn("4 to 15", result.error.message)

    def test_json_api_supports_typed_references(self):
        request = seedance.request_from_dict({
            "prompt": "Use @motion and @look", "duration": 8,
            "references": [
                {"alias": "motion", "url": "https://x.test/a.mp4", "type": "video"},
                {"alias": "look", "url": "https://x.test/a.png", "type": "image"},
            ],
        })
        self.assertEqual(request.format, "portrait-720p")
        self.assertEqual([x.media_type for x in request.references], ["video", "image"])

    def test_dotenv_key_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as temporary:
            dotenv = Path(temporary) / ".env"
            dotenv.write_text("OPENROUTER_API_KEY=from-file\n", encoding="utf-8")
            self.assertEqual(seedance.api_key(dotenv, {}), "from-file")
            self.assertEqual(seedance.api_key(dotenv, {"OPENROUTER_API_KEY": "exported"}), "exported")

    def test_aws_credentials_are_loaded_from_dotenv_with_legacy_aliases(self):
        with tempfile.TemporaryDirectory() as temporary:
            dotenv = Path(temporary) / ".env"
            dotenv.write_text(
                "AWS_ACCESS_KEY=legacy-id\nAWS_ACCESS_SECRET=legacy-secret\n",
                encoding="utf-8",
            )
            environment = seedance.aws_cli_environment(dotenv, {"PATH": "/bin"})
            self.assertEqual(environment["AWS_ACCESS_KEY_ID"], "legacy-id")
            self.assertEqual(environment["AWS_SECRET_ACCESS_KEY"], "legacy-secret")

    def test_standard_aws_credentials_override_legacy_aliases(self):
        with tempfile.TemporaryDirectory() as temporary:
            dotenv = Path(temporary) / ".env"
            dotenv.write_text(
                "AWS_ACCESS_KEY_ID=standard-id\nAWS_ACCESS_KEY=legacy-id\n"
                "AWS_SECRET_ACCESS_KEY=standard-secret\nAWS_ACCESS_SECRET=legacy-secret\n",
                encoding="utf-8",
            )
            environment = seedance.aws_cli_environment(dotenv, {})
            self.assertEqual(environment["AWS_ACCESS_KEY_ID"], "standard-id")
            self.assertEqual(environment["AWS_SECRET_ACCESS_KEY"], "standard-secret")


class JobTests(unittest.TestCase):
    def test_temporary_references_are_deleted_after_completion(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = reference_file(temporary, "look.png")
            output = Path(temporary) / "out.mp4"
            ref = seedance.Reference.parse(f"@look={source}", "image")
            publisher = FakePublisher()
            result = seedance.SeedanceGenerator(FakeTransport(), publisher).generate(
                seedance.VideoRequest("Use @look", 4, output, (ref,))
            )
            self.assertTrue(result.ok)
            self.assertEqual(publisher.deleted, publisher.published)

    def test_poll_retries_are_throttled_and_return_resume_delay(self):
        now = [100.0]
        def sleep(seconds): now[0] += seconds
        transient = [seedance.TransportError("busy", status=503) for _ in range(3)]
        ref = seedance.Reference("look", "https://x.test/look.png", "image")
        request = seedance.VideoRequest(
            "Use @look", 4, Path("x.mp4"), (ref,),
            max_retries_per_10_seconds=2, poll_interval_seconds=1,
        )
        result = seedance.SeedanceGenerator(
            FakeTransport(polls=transient), clock=lambda: now[0], sleeper=sleep
        ).generate(request)
        self.assertTrue(result.retry.allowed)
        self.assertGreaterEqual(result.retry.after_seconds, 8.5)
        self.assertIn("throttle", result.retry.reason)
        self.assertEqual(result.job["id"], "job_1")

    def test_failed_job_is_never_retried(self):
        ref = seedance.Reference("look", "https://x.test/look.png", "image")
        transport = FakeTransport(polls=[{"id": "job_1", "status": "failed", "error": "blocked"}])
        result = seedance.SeedanceGenerator(transport).generate(
            seedance.VideoRequest("Use @look", 4, Path("x.mp4"), (ref,)))
        self.assertFalse(result.retry.allowed)
        self.assertEqual(result.job["status"], "failed")

    def test_poll_timeout_returns_resumable_job(self):
        now = [0.0]
        def sleep(seconds): now[0] += seconds
        ref = seedance.Reference("look", "https://x.test/look.png", "image")
        transport = FakeTransport(polls=[{"id": "job_1", "status": "pending"}] * 3)
        request = seedance.VideoRequest("Use @look", 4, Path("x.mp4"), (ref,),
            poll_interval_seconds=2, max_poll_seconds=3)
        result = seedance.SeedanceGenerator(transport, clock=lambda: now[0], sleeper=sleep).generate(request)
        self.assertTrue(result.retry.allowed)
        self.assertEqual(result.job["id"], "job_1")
        self.assertIn("resume", result.retry.reason)

    def test_resume_does_not_submit_again(self):
        transport = FakeTransport()
        request = seedance.VideoRequest("", 4, Path("/tmp/resumed.mp4"), (), job_id="job_existing")
        with tempfile.TemporaryDirectory() as temporary:
            request = seedance.VideoRequest("", 4, Path(temporary) / "out.mp4", (), job_id="job_existing")
            result = seedance.SeedanceGenerator(transport).generate(request)
        self.assertTrue(result.ok)
        self.assertIsNone(transport.payload)
        self.assertEqual(transport.downloaded, "job_existing")

    def test_ambiguous_submit_connection_error_forbids_duplicate(self):
        ref = seedance.Reference("look", "https://x.test/look.png", "image")
        transport = FakeTransport(submit=seedance.TransportError("connection lost"))
        result = seedance.SeedanceGenerator(transport).generate(
            seedance.VideoRequest("Use @look", 4, Path("x.mp4"), (ref,)))
        self.assertFalse(result.retry.allowed)
        self.assertIn("duplicate paid job", result.retry.reason)


class HTTPTests(unittest.TestCase):
    def test_transport_routes_submit_poll_and_download(self):
        responses = [
            json.dumps({"id": "job_1", "status": "pending"}).encode(),
            json.dumps({"id": "job_1", "status": "completed"}).encode(),
            b"video",
        ]
        requests = []
        class Response:
            headers = {}
            def __init__(self, body): self.body = body
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self): return self.body
        def urlopen(request, timeout):
            requests.append(request)
            return Response(responses.pop(0))
        transport = seedance.OpenRouterTransport("test-key")
        with patch("seedance.urllib.request.urlopen", side_effect=urlopen):
            transport.submit({"model": seedance.MODEL}, 10)
            transport.poll("job_1", 10)
            transport.download("job_1", 10)
        self.assertTrue(requests[0].full_url.endswith("/videos"))
        self.assertTrue(requests[1].full_url.endswith("/videos/job_1"))
        self.assertTrue(requests[2].full_url.endswith("/videos/job_1/content?index=0"))

    def test_http_402_is_permanent(self):
        error = urllib.error.HTTPError("x", 402, "Payment", {}, io.BytesIO(b'{"error":{"message":"credits"}}'))
        with patch("seedance.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(seedance.TransportError) as raised:
                seedance.OpenRouterTransport("key").submit({}, 10)
        retryable, kind, _ = seedance.classify(raised.exception)
        self.assertFalse(retryable)
        self.assertEqual(kind, "payment_required")

    def test_numeric_error_code_never_crashes_classifier(self):
        retryable, kind, reason = seedance.classify(
            seedance.TransportError("invalid URL", status=400, code=400)
        )
        self.assertFalse(retryable)
        self.assertEqual(kind, "400")
        self.assertIn("not retryable", reason)

    def test_numeric_http_error_code_is_normalized_to_string(self):
        error = urllib.error.HTTPError(
            "x", 400, "Bad Request", {},
            io.BytesIO(b'{"error":{"message":"invalid URL","code":400}}'),
        )
        with patch("seedance.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(seedance.TransportError) as raised:
                seedance.OpenRouterTransport("key").submit({}, 10)
        self.assertEqual(raised.exception.code, "400")


if __name__ == "__main__":
    unittest.main()
