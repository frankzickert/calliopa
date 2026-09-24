"""Offline tests: the CLI is faked, nothing is uploaded, nothing is spent."""

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import higgsfield_image as hi

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


class FakeCLI:
    def __init__(self, create=None, gets=None, cost=None, create_code=0, stderr=""):
        self.create = create if create is not None else {"id": "job_12345678", "status": "queued"}
        # The shape of a real completed job (`higgsfield generate get <id> --json`, 2026-09-17).
        self.gets = list(gets) if gets is not None else [{
            "id": "job_12345678", "job_type": "gpt_image_2", "status": "completed",
            "params": {"medias": [{"role": "image", "data": {
                "type": "media_input", "url": "https://cdn.higgsfield.test/input_plate.png"}}]},
            "min_result_url": "https://cdn.higgsfield.test/out_min.webp",
            "result_url": "https://cdn.higgsfield.test/out.png",
        }]
        self.cost = cost if cost is not None else {"credits": 4.5}
        self.create_code = create_code
        self.stderr = stderr
        self.calls = []

    def __call__(self, argv, timeout):
        self.calls.append(argv)
        verb = argv[2]
        if verb == "create":
            return self.create_code, json.dumps(self.create), self.stderr
        if verb == "cost":
            return 0, json.dumps(self.cost), ""
        return 0, json.dumps(self.gets.pop(0) if len(self.gets) > 1 else self.gets[0]), ""

    def verbs(self):
        return [argv[2] for argv in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.plate = self.dir / "codey_turnaround.png"
        self.plate.write_bytes(PNG)

    def run_tool(self, argv, cli=None, content=PNG):
        cli = cli or FakeCLI()
        transport = hi.hf.HiggsfieldTransport("higgsfield", runner=cli, fetcher=lambda url, t: content)
        out = io.StringIO()
        with redirect_stdout(out):
            code = hi.main(argv, transport=transport, sleeper=lambda s: None)
        return code, json.loads(out.getvalue()), cli

    def argv(self, *extra, output="panel_v01.png"):
        return ["--prompt", "Codey stands frame left, exactly as @codey.",
                "--reference", f"@codey={self.plate}",
                "--output", str(self.dir / output), *extra]


class RequestTests(Base):
    def test_dry_run_sends_nothing_but_the_free_quote(self):
        code, payload, cli = self.run_tool(self.argv("--dry-run"))
        self.assertEqual(code, 0)
        self.assertEqual(cli.verbs(), ["cost"])
        argv = payload["request"]["argv"]
        self.assertEqual(argv[:4], ["higgsfield", "generate", "create", "gpt_image_2"])
        self.assertIn("--image-references", argv)
        # An axis nobody chose is absent, and the vendor applies its own default. These
        # carried `9:16` at `2k` and `high` — `world/WORLD.md`'s delivery format — which
        # decided what every unchosen request got. BO_0279_003
        self.assertNotIn("--aspect_ratio", argv)
        self.assertNotIn("--resolution", argv)
        self.assertNotIn("--quality", argv)
        self.assertEqual(payload["request"]["cost_quote"], {"credits": 4.5})
        self.assertFalse((self.dir / "panel_v01.png").exists())

    def test_a_chosen_axis_is_sent_exactly_as_chosen(self):
        """What is chosen goes; what is not chosen does not. BO_0279_003"""
        code, payload, _ = self.run_tool(self.argv(
            "--aspect-ratio", "16:9", "--resolution", "4k", "--dry-run", "--no-quote"))
        self.assertEqual(code, 0, payload)
        argv = payload["request"]["argv"]
        self.assertEqual(argv[argv.index("--aspect_ratio") + 1], "16:9")
        self.assertEqual(argv[argv.index("--resolution") + 1], "4k")
        self.assertNotIn("--quality", argv)

    def test_a_chosen_axis_the_model_does_not_take_is_still_refused(self):
        """Not checking an absent axis must not stop a given one being checked."""
        code, payload, _ = self.run_tool(self.argv(
            "--aspect-ratio", "13:7", "--dry-run", "--no-quote"))
        self.assertEqual(code, 2)
        self.assertIn("aspect_ratio", payload["error"]["message"])

    def test_prompt_names_every_attachment(self):
        code, payload, _ = self.run_tool(self.argv("--dry-run", "--no-quote"))
        self.assertTrue(payload["request"]["expanded_prompt"].startswith(
            "The attached images, in the order they are attached:\n- @codey = attached image 1"))

    def test_unnamed_attachment_is_refused(self):
        argv = ["--prompt", "A robot.", "--reference", f"@codey={self.plate}",
                "--output", str(self.dir / "p_v01.png"), "--dry-run"]
        code, payload, cli = self.run_tool(argv)
        self.assertEqual(code, 2)
        self.assertIn("never named", payload["error"]["message"])
        self.assertEqual(cli.calls, [])

    def test_alias_without_reference_is_refused(self):
        argv = ["--prompt", "As @codey beside @jade.", "--reference", f"@codey={self.plate}",
                "--output", str(self.dir / "p_v01.png"), "--dry-run"]
        code, payload, _ = self.run_tool(argv)
        self.assertEqual(code, 2)
        self.assertIn("@jade", payload["error"]["message"])

    def test_unversioned_output_is_refused(self):
        code, payload, cli = self.run_tool(self.argv("--dry-run", output="panel.png"))
        self.assertEqual(code, 2)
        self.assertEqual(cli.calls, [])

    def test_existing_version_is_never_overwritten(self):
        (self.dir / "panel_v01.png").write_bytes(PNG)
        code, payload, cli = self.run_tool(self.argv())
        self.assertEqual(code, 2)
        self.assertEqual(cli.calls, [])

    def test_seedream_takes_no_quality(self):
        code, payload, _ = self.run_tool(self.argv("--model", "seedream_v5_pro", "--dry-run", "--no-quote"))
        self.assertEqual(code, 0)
        self.assertNotIn("--quality", payload["request"]["argv"])
        code, payload, _ = self.run_tool(
            self.argv("--model", "seedream_v5_pro", "--quality", "high", "--dry-run"))
        self.assertEqual(code, 2)

    def test_resolution_is_checked_per_model(self):
        code, _, _ = self.run_tool(self.argv("--model", "seedream_v5_pro", "--resolution", "4k", "--dry-run"))
        self.assertEqual(code, 2)

    def test_gpt_image_2_5_sends_variant_and_takes_the_higher_qualities(self):
        code, payload, _ = self.run_tool(self.argv("--model", "gpt_image_2_5", "--quality", "xhigh",
                                                   "--aspect-ratio", "16:27", "--dry-run", "--no-quote"))
        self.assertEqual(code, 0, payload)
        argv = payload["request"]["argv"]
        self.assertEqual(argv[3], "gpt_image_2_5")
        self.assertEqual(argv[argv.index("--quality") + 1], "xhigh")
        # A variant nobody chose is the vendor's to pick, not this adapter's. BO_0279_003
        self.assertNotIn("--variant", argv)
        self.assertIsNone(payload["request"]["variant"])
        code, payload, _ = self.run_tool(
            self.argv("--model", "gpt_image_2_5", "--variant", "sunburst", "--dry-run", "--no-quote"))
        self.assertIn("sunburst", payload["request"]["argv"])

    def test_variant_and_higher_qualities_are_gpt_image_2_5_only(self):
        for extra in (("--variant", "flare"), ("--quality", "max")):
            code, _, cli = self.run_tool(self.argv(*extra, "--dry-run"))
            self.assertEqual(code, 2, extra)
            self.assertEqual(cli.calls, [])
        code, _, _ = self.run_tool(self.argv("--model", "gpt_image_2_5", "--variant", "nova", "--dry-run"))
        self.assertEqual(code, 2)

    def test_prompt_section_from_a_markdown_file(self):
        doc = self.dir / "SHOT.md"
        doc.write_text("# Shot\n\n## 3. Panel\n\n```text\nCodey as @codey.\n```\n", encoding="utf-8")
        argv = ["--prompt-file", str(doc), "--prompt-section", "3", "--reference", f"@codey={self.plate}",
                "--output", str(self.dir / "p_v01.png"), "--dry-run", "--no-quote"]
        code, payload, _ = self.run_tool(argv)
        self.assertEqual(code, 0)
        self.assertTrue(payload["request"]["expanded_prompt"].endswith("Codey as @codey."))


class SubmitTests(Base):
    def test_submits_once_polls_and_saves_everything(self):
        cli = FakeCLI(gets=[{"id": "job_12345678", "status": "in_progress"}, FakeCLI().gets[0]])
        code, payload, cli = self.run_tool(self.argv(), cli=cli)
        self.assertEqual(code, 0, payload)
        self.assertEqual(cli.verbs(), ["create", "get", "get"])
        self.assertEqual(payload["image"]["url"], "https://cdn.higgsfield.test/out.png")
        self.assertEqual((self.dir / "panel_v01.png").read_bytes(), PNG)
        log = json.loads((self.dir / "panel_v01.response.json").read_text())
        self.assertEqual(log["submission"]["id"], "job_12345678")
        self.assertEqual(log["job"]["status"], "completed")
        self.assertIn("@codey", (self.dir / "panel_v01.prompt.txt").read_text())

    def test_an_input_plate_is_never_taken_for_the_result(self):
        job = {"status": "completed", "params": {"medias": [{"data": {"url": "https://h.test/in.png"}}]},
               "results": [{"raw_url": "https://h.test/out.png"}]}
        self.assertEqual(hi.image_urls_of(job), ["https://h.test/out.png"])

    def test_jpeg_bytes_keep_their_real_extension(self):
        code, payload, _ = self.run_tool(self.argv(), content=JPG)
        self.assertEqual(code, 0)
        self.assertTrue(payload["image"]["path"].endswith("panel_v01.jpg"))

    def test_a_failed_submission_is_never_retried(self):
        cli = FakeCLI(create_code=1, stderr="Error: no response received (connection reset)")
        code, payload, cli = self.run_tool(self.argv(), cli=cli)
        self.assertEqual(cli.verbs(), ["create"])
        self.assertFalse(payload["ok"])
        self.assertTrue((self.dir / "panel_v01.response.json").exists())

    def test_server_side_failure_is_permanent(self):
        cli = FakeCLI(gets=[{"id": "job_12345678", "status": "failed"}])
        code, payload, _ = self.run_tool(self.argv(), cli=cli)
        self.assertEqual(code, 1)
        self.assertEqual(payload["error"]["kind"], "job_failed")

    def test_plan_required_is_reported(self):
        cli = FakeCLI(create_code=1, stderr='Error: {"error_type": "job_minimum_basic_plan_required"}')
        code, payload, _ = self.run_tool(self.argv(), cli=cli)
        self.assertEqual(code, 1)
        self.assertEqual(payload["error"]["kind"], "plan_required")

    def test_job_id_collects_without_creating(self):
        argv = ["--job-id", "job_12345678", "--output", str(self.dir / "panel_v01.png")]
        code, payload, cli = self.run_tool(argv)
        self.assertEqual(code, 0)
        self.assertNotIn("create", cli.verbs())

    def test_recollect_does_not_clobber(self):
        (self.dir / "panel_v01.png").write_bytes(b"\x89PNG\r\n\x1a\nFIRST")
        argv = ["--job-id", "job_12345678", "--output", str(self.dir / "panel_v01.png")]
        code, payload, _ = self.run_tool(argv)
        self.assertEqual(code, 0)
        self.assertEqual((self.dir / "panel_v01.png").read_bytes(), b"\x89PNG\r\n\x1a\nFIRST")
        self.assertTrue(payload["image"]["path"].endswith("panel_v01_job-job_1234.png"))


if __name__ == "__main__":
    unittest.main()
