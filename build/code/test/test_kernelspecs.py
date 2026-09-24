"""The kernelspec scan's two output shapes, and the choice among them. BO_0289_005"""

import json
import unittest

from lib.runtimes import Refused, choose_kernelspec, normalize_image, parse_kernelspecs

LISTED = json.dumps({"kernelspecs": {
    "python3": {"resource_dir": "/usr/local/share/jupyter/kernels/python3",
                "spec": {"argv": ["python", "-m", "ipykernel_launcher", "-f", "{connection_file}"],
                         "display_name": "Python 3", "language": "python"}},
    "ir": {"resource_dir": "/opt/conda/share/jupyter/kernels/ir",
           "spec": {"argv": ["R", "--slave", "-e", "IRkernel::main()", "--args", "{connection_file}"],
                    "display_name": "R", "language": "R", "interrupt_mode": "message"}},
}})

SCANNED = (
    "==/usr/local/share/jupyter/kernels/deno/kernel.json\n"
    + json.dumps({"argv": ["deno", "jupyter", "--kernel", "--conn", "{connection_file}"], "display_name": "Deno", "language": "typescript"})
    + "\n==/root/.local/share/jupyter/kernels/python3/kernel.json\n"
    + json.dumps({"argv": ["python3", "-m", "ipykernel_launcher", "-f", "{connection_file}"], "display_name": "Python 3", "language": "python"})
    + "\n"
)


class KernelspecTest(unittest.TestCase):
    def test_given_jupyters_own_listing_then_each_spec_is_read(self):
        specs = {spec["name"]: spec for spec in parse_kernelspecs(LISTED)}
        self.assertEqual(set(specs), {"python3", "ir"})
        self.assertEqual(specs["ir"]["interruptMode"], "message")
        self.assertEqual(specs["python3"]["interruptMode"], "signal")
        self.assertEqual(specs["python3"]["resourceDir"], "/usr/local/share/jupyter/kernels/python3")

    def test_given_a_directory_scan_then_each_kernel_json_is_read(self):
        specs = {spec["name"]: spec for spec in parse_kernelspecs(SCANNED)}
        self.assertEqual(set(specs), {"deno", "python3"})
        self.assertEqual(specs["deno"]["language"], "typescript")
        self.assertEqual(specs["python3"]["resourceDir"], "/root/.local/share/jupyter/kernels/python3")

    def test_given_nothing_then_no_spec(self):
        self.assertEqual(parse_kernelspecs(""), [])
        self.assertEqual(parse_kernelspecs("   \n"), [])

    def test_the_choice_prefers_the_asked_then_python3_then_the_first_by_name(self):
        specs = parse_kernelspecs(LISTED)
        self.assertEqual(choose_kernelspec(specs, "ir")["name"], "ir")
        self.assertEqual(choose_kernelspec(specs, None)["name"], "python3")
        self.assertEqual(choose_kernelspec([s for s in specs if s["name"] != "python3"], None)["name"], "ir")
        with self.assertRaises(Refused) as refused:
            choose_kernelspec(specs, "julia")
        self.assertIn("no kernelspec named julia", refused.exception.message)
        with self.assertRaises(Refused) as none:
            choose_kernelspec([], None)
        self.assertEqual(none.exception.status, 400)

    def test_an_image_with_neither_tag_nor_digest_names_latest(self):
        self.assertEqual(normalize_image("jupyter/minimal-notebook"), "jupyter/minimal-notebook:latest")
        self.assertEqual(normalize_image("python:3.13-slim"), "python:3.13-slim")
        self.assertEqual(normalize_image("ghcr.io/x/y@sha256:abc"), "ghcr.io/x/y@sha256:abc")
        self.assertEqual(normalize_image("localhost:5000/kernel"), "localhost:5000/kernel:latest")
        with self.assertRaises(Refused):
            normalize_image("two words")


if __name__ == "__main__":
    unittest.main()
