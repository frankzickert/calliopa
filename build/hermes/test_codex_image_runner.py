"""Offline contract tests for the private Codex image runner."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import codex_image_runner as runner


class CodexImageRunnerTest(unittest.TestCase):
    def test_prompt_explicitly_invokes_imagegen_skill_and_keeps_user_prompt(self):
        prompt = runner.image_prompt("blue bird on a branch")

        self.assertTrue(prompt.startswith("$imagegen "))
        self.assertIn("blue bird on a branch", prompt)
        self.assertIn("exactly one PNG image", prompt)

    def test_generate_collects_new_png_from_codex_home(self):
        with tempfile.TemporaryDirectory() as directory:
            generated = Path(directory) / "generated_images"
            runner.GENERATED = generated

            def fake_codex(*args, **kwargs):
                self.assertIn("$imagegen", kwargs["input"])
                self.assertIn("--enable", args[0])
                self.assertIn("image_generation", args[0])
                self.assertIn("workspace-write", args[0])
                self.assertIn(str(generated), args[0])
                self.assertIn("--add-dir", args[0])
                generated.mkdir(parents=True, exist_ok=True)
                (generated / "created.png").write_bytes(b"\x89PNG\r\n\x1a\nimage")

            with patch.object(runner.subprocess, "run", side_effect=fake_codex):
                result = runner.Handler.generate(None, "blue bird")

        self.assertEqual(result, b"\x89PNG\r\n\x1a\nimage")


if __name__ == "__main__":
    unittest.main()
