import json
import tempfile
import unittest
from pathlib import Path

import seedance


PLATES: tempfile.TemporaryDirectory | None = None


def setUpModule():
    # Reference files must exist on disk: the CLI uploads them itself, so the
    # request is only valid when the plates are really there.
    global PLATES
    PLATES = tempfile.TemporaryDirectory()


def tearDownModule():
    PLATES.cleanup()


def plate(name, suffix=".png"):
    path = Path(PLATES.name) / f"{name}{suffix}"
    path.write_bytes(b"plate")
    return str(path)


def reference(alias, kind="image", suffix=".png"):
    return seedance.base.Reference(alias, plate(alias, suffix), kind)


class FakeCLI:
    def __init__(self, create=None, get=None, create_code=0, get_code=0, stderr=""):
        self.create = create if create is not None else {"id": "job_1", "status": "queued"}
        self.get = get if get is not None else {
            "id": "job_1",
            "status": "completed",
            "results": [{"raw_url": "https://cdn.higgsfield.test/job_1.mp4"}],
        }
        self.create_code = create_code
        self.get_code = get_code
        self.stderr = stderr
        self.calls = []

    def __call__(self, argv, timeout):
        self.calls.append(argv)
        if argv[1:3] == ["generate", "create"]:
            return self.create_code, json.dumps(self.create), self.stderr
        return self.get_code, json.dumps(self.get), self.stderr


def transport(cli, video=b"mp4"):
    return seedance.HiggsfieldTransport("higgsfield", runner=cli, fetcher=lambda url, timeout: video)


def request(references, **overrides):
    fields = {
        "prompt": "Use @panel as the shot. Keep @hero identical throughout.",
        "duration": 8,
        "output": Path("out.mp4"),
        "references": references,
    }
    fields.update(overrides)
    return seedance.HiggsfieldRequest(**fields)


class TheTwoAxes(unittest.TestCase):
    """A ratio and a resolution, which the vendor has always taken. BO_0279_002

    `model get` reports six aspect ratios for this model and two resolutions; the `FORMATS`
    presets name two ratios, so four were unreachable. The preset stays as the shorthand it is.
    """

    def test_the_format_still_decides_when_nothing_else_does(self):
        payload = seedance.build_payload(request((reference("panel"),), start_alias="panel"))
        self.assertEqual(payload["resolution"], "720p")
        self.assertEqual(payload["aspect_ratio"], "9:16")

    def test_an_asked_for_pair_overrides_the_format(self):
        payload = seedance.build_payload(request(
            (reference("panel"),), start_alias="panel", aspect_ratio="16:9", resolution="480p"))
        self.assertEqual(payload["aspect_ratio"], "16:9")
        self.assertEqual(payload["resolution"], "480p")

    def test_a_ratio_no_preset_offers_reaches_the_vendor(self):
        """The whole point: 4:3 is one of the six the vendor takes and none of the four the
        presets named."""
        argv = seedance.build_argv(seedance.build_payload(request(
            (reference("panel"),), start_alias="panel", aspect_ratio="4:3")))
        self.assertEqual(argv[argv.index("--aspect_ratio") + 1], "4:3")
        # The resolution still comes from the format, because only one axis was asked for.
        self.assertEqual(argv[argv.index("--resolution") + 1], "720p")

    def test_the_mini_still_refuses_1080p_however_it_is_asked_for(self):
        """The guard followed the preset's resolution; asked directly it must still bite."""
        with self.assertRaises(seedance.base.InvalidRequest):
            request((reference("panel"),), start_alias="panel", resolution="1080p").validate()


class PayloadTests(unittest.TestCase):
    def test_a_start_frame_leaves_the_reference_array(self):
        payload = seedance.build_payload(
            request((reference("panel"), reference("hero")), start_alias="panel")
        )
        self.assertTrue(payload["start_image"].endswith("panel.png"))
        self.assertEqual(len(payload["image_references"]), 1)
        self.assertTrue(payload["image_references"][0].endswith("hero.png"))
        self.assertNotIn("end_image", payload)

    def test_argv_carries_the_frame_and_the_references_apart(self):
        argv = seedance.build_argv(seedance.build_payload(
            request((reference("panel"), reference("hero"), reference("face")), start_alias="panel")
        ))
        self.assertEqual(argv[:5], ["higgsfield", "generate", "create", "seedance_2_0_mini", "--json"])
        self.assertEqual(argv.count("--start-image"), 1)
        self.assertEqual(argv.count("--image-references"), 2)
        self.assertTrue(argv[argv.index("--start-image") + 1].endswith("panel.png"))
        self.assertEqual(argv[argv.index("--duration") + 1], "8")

    def test_reference_only_requests_send_no_frame(self):
        argv = seedance.build_argv(seedance.build_payload(request((reference("panel"), reference("hero")))))
        self.assertNotIn("--start-image", argv)
        self.assertNotIn("--end-image", argv)
        self.assertEqual(argv.count("--image-references"), 2)

    def test_video_and_audio_references_reach_their_own_flags(self):
        references = (reference("panel"), reference("bed", "audio", ".wav"), reference("plate", "video", ".mp4"))
        payload = seedance.build_payload(
            request(references, prompt="Use @panel, @bed and @plate.", start_alias="panel")
        )
        argv = seedance.build_argv(payload)
        self.assertEqual(argv.count("--audio-references"), 1)
        self.assertEqual(argv.count("--video-references"), 1)

    def test_optional_params_reach_the_command_line(self):
        argv = seedance.build_argv(seedance.build_payload(
            request((reference("panel"), reference("hero")), generate_audio=False,
                    genre="noir", bitrate_mode="high")
        ))
        self.assertEqual(argv[argv.index("--generate_audio") + 1], "false")
        self.assertEqual(argv[argv.index("--genre") + 1], "noir")
        self.assertEqual(argv[argv.index("--bitrate_mode") + 1], "high")


class LegendTests(unittest.TestCase):
    def test_every_attachment_is_named_by_alias_role_and_file(self):
        legend = seedance.expanded_prompt(
            request((reference("panel"), reference("hero"), reference("face")), start_alias="panel")
        )
        self.assertIn("@panel = the FIRST FRAME", legend)
        self.assertIn("panel.png", legend)
        self.assertIn("@hero = image reference 1", legend)
        self.assertIn("@face = image reference 2", legend)
        # The author's prompt survives verbatim underneath the legend.
        self.assertIn("Use @panel as the shot. Keep @hero identical throughout.", legend)

    def test_the_legend_never_rewrites_aliases_into_native_slots(self):
        legend = seedance.expanded_prompt(request((reference("panel"), reference("hero"))))
        self.assertNotIn("@Image 1", legend)


class ValidationTests(unittest.TestCase):
    def test_a_frame_alias_must_be_attached(self):
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "no attached reference"):
            request((reference("hero"),), prompt="Use @hero.", start_alias="panel").validate()

    def test_one_image_cannot_be_both_frames(self):
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "both the first and the last"):
            request((reference("panel"), reference("hero")),
                    start_alias="panel", end_alias="panel").validate()

    def test_frames_count_toward_the_nine_image_budget(self):
        references = tuple(reference(f"r{i}") for i in range(10))
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "at most 9 images"):
            request(references, prompt=" ".join(f"@r{i}" for i in range(10)),
                    start_alias="r0").validate()

    def test_rejects_seed_and_remote_urls(self):
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "no seed parameter"):
            request((reference("panel"), reference("hero")), seed=7).validate()
        remote = (seedance.base.Reference("panel", "https://x.test/panel.png", "image"),)
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "uploads local files itself"):
            request(remote, prompt="Use @panel.").validate()

    def test_audio_alone_is_rejected(self):
        with self.assertRaisesRegex(seedance.base.InvalidRequest, "audio reference needs"):
            request((reference("bed", "audio", ".wav"),), prompt="Use @bed.").validate()

    def test_accepts_the_480p_presets(self):
        request((reference("panel"), reference("hero")), format="portrait-480p").validate()


class ResponseShapeTests(unittest.TestCase):
    def test_job_id_survives_the_shapes_the_cli_might_use(self):
        self.assertEqual(seedance.job_id_of({"id": "a"}), "a")
        self.assertEqual(seedance.job_id_of([{"job_id": "b"}]), "b")
        self.assertEqual(seedance.job_id_of(["c"]), "c")
        self.assertEqual(seedance.job_id_of({"jobs": [{"id": "d"}]}), "d")
        self.assertIsNone(seedance.job_id_of({"status": "queued"}))

    def test_status_normalizes_vendor_vocabulary(self):
        self.assertEqual(seedance.status_of({"status": "succeeded"}), ("completed", "succeeded"))
        self.assertEqual(seedance.status_of({"state": "queued"}), ("in_progress", "queued"))
        self.assertEqual(seedance.status_of({"status": "nsfw"}), ("failed", "nsfw"))

    def test_the_real_job_shape_observed_on_2026_08_17(self):
        # Field names taken from an actual completed job on this account.
        job = {
            "id": "b63cc497-6883-4bd8-87a6-df3af40088d2",
            "status": "completed",
            "result_url": "https://cdn.test/user/hf_20260817_b63cc497.mp4",
            "min_result_url": None,
            "thumbnail_url": "https://cdn.test/user/hf_20260817_b63cc497_thumbnail.webp",
            "params": {"medias": [{"data": {"url": "https://cdn.test/in/49cd7376_resize.jpg"},
                                   "role": "image"}]},
        }
        self.assertEqual(seedance.job_id_of(job), "b63cc497-6883-4bd8-87a6-df3af40088d2")
        self.assertEqual(seedance.status_of(job), ("completed", "completed"))
        self.assertEqual(seedance.video_url_of(job), "https://cdn.test/user/hf_20260817_b63cc497.mp4")

    def test_a_watermarked_min_render_loses_to_the_full_one(self):
        job = {
            "status": "completed",
            "min_result_url": "https://cdn.test/a_min.mp4",
            "result_url": "https://cdn.test/a.mp4",
        }
        self.assertEqual(seedance.video_url_of(job), "https://cdn.test/a.mp4")

    def test_video_url_prefers_the_raw_render_over_a_preview(self):
        job = {"results": [{
            "preview_url": "https://cdn.test/a-preview.mp4",
            "raw_url": "https://cdn.test/a.mp4",
            "cover": "https://cdn.test/a.png",
        }]}
        self.assertEqual(seedance.video_url_of(job), "https://cdn.test/a.mp4")
        self.assertIsNone(seedance.video_url_of({"results": [{"cover": "https://cdn.test/a.png"}]}))


class TransportTests(unittest.TestCase):
    def test_submit_poll_and_download_walk_the_cli(self):
        cli = FakeCLI()
        carrier = transport(cli)
        job = carrier.submit(seedance.build_payload(
            request((reference("panel"), reference("hero")), start_alias="panel")), 10)
        self.assertEqual(job["id"], "job_1")
        polled = carrier.poll("job_1", 10)
        self.assertEqual(polled["status"], "completed")
        self.assertEqual(polled["video_url"], "https://cdn.higgsfield.test/job_1.mp4")
        self.assertEqual(carrier.download("job_1", 10), b"mp4")
        self.assertEqual(cli.calls[1], ["higgsfield", "generate", "get", "job_1", "--json"])

    def test_free_plan_rejection_is_permanent_and_named(self):
        cli = FakeCLI(create_code=3, stderr='Error: {"error_type":"job_minimum_basic_plan_required"}')
        with self.assertRaises(seedance.base.TransportError) as caught:
            transport(cli).submit(seedance.build_payload(request((reference("panel"), reference("hero")))), 10)
        self.assertEqual(caught.exception.code, "plan_required")
        self.assertFalse(seedance.classify(caught.exception)[0])

    def test_expired_session_and_bad_params_are_classified_apart(self):
        session = seedance.HiggsfieldTransport._error(1, "", "Error: Session expired", "submission")
        self.assertEqual(session.code, "unauthenticated")
        params = seedance.HiggsfieldTransport._error(1, "", "Error: Unknown params: frame_images", "submission")
        self.assertEqual(params.code, "invalid_request")
        self.assertFalse(seedance.classify(params)[0])

    def test_connection_failures_stay_retryable(self):
        dropped = seedance.HiggsfieldTransport._error(
            1, "", "Error: higgsfield: request failed (no response received)", "poll")
        self.assertEqual(dropped.code, "connection_error")
        self.assertTrue(seedance.classify(dropped)[0])

    def test_completed_job_without_a_url_reports_the_raw_shape(self):
        cli = FakeCLI(get={"id": "job_1", "status": "completed", "results": []})
        with self.assertRaisesRegex(seedance.base.TransportError, "no video URL was found"):
            transport(cli).poll("job_1", 10)


class GenerationTests(unittest.TestCase):
    def test_generation_writes_the_clip_and_reports_the_mode(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "clip.mp4"
            cli = FakeCLI()
            result = seedance.HiggsfieldGenerator(transport(cli), sleeper=lambda _: None).generate(
                request((reference("panel"), reference("hero")), output=output, start_alias="panel")
            )
            self.assertTrue(result.ok, result.to_dict())
            self.assertEqual(output.read_bytes(), b"mp4")
            self.assertEqual(result.request["generation_mode"], "image-to-video")
            self.assertEqual(result.request["start_frame"], "@panel")
            self.assertEqual(result.request["reference_aliases"], ["@hero"])

    def test_reference_only_generation_reports_reference_to_video(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "clip.mp4"
            result = seedance.HiggsfieldGenerator(transport(FakeCLI()), sleeper=lambda _: None).generate(
                request((reference("panel"), reference("hero")), output=output)
            )
            self.assertEqual(result.request["generation_mode"], "reference-to-video")
            self.assertNotIn("start_frame", result.request)


class DryRunTests(unittest.TestCase):
    def test_dry_run_prints_the_command_and_spends_nothing(self):
        payload = seedance.dry_run(
            request((reference("panel"), reference("hero")), start_alias="panel"), "higgsfield"
        )
        self.assertTrue(payload["ok"])
        self.assertIn("--start-image", payload["request"]["argv"])


if __name__ == "__main__":
    unittest.main()
