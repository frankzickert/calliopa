"""The caps: every default kept by an unset or empty variable, every override read. BO_0289_005"""

import unittest

from lib.caps import Caps, parse_bytes


class CapsTest(unittest.TestCase):
    def test_given_no_environment_then_every_default_holds(self):
        caps = Caps.from_env({})
        self.assertEqual(caps, Caps())
        self.assertEqual(caps.memory_bytes, 2 * 1024**3)
        self.assertEqual(caps.output_max_bytes, 8 * 1024**2)
        self.assertEqual(caps.max_runtimes, 8)

    def test_given_an_empty_variable_then_the_default_is_kept(self):
        caps = Caps.from_env({"CALLIOPA_CODE_MEMORY": "", "CALLIOPA_CODE_CPUS": "  "})
        self.assertEqual(caps.memory_bytes, Caps().memory_bytes)
        self.assertEqual(caps.cpus, Caps().cpus)

    def test_given_overrides_then_each_is_read(self):
        caps = Caps.from_env({
            "CALLIOPA_CODE_MEMORY": "512m", "CALLIOPA_CODE_CPUS": "0.5",
            "CALLIOPA_CODE_OUTPUT_MAX_BYTES": "4096", "CALLIOPA_CODE_COPY_MAX_BYTES": "1g",
            "CALLIOPA_CODE_MAX_RUNTIMES": "2", "CALLIOPA_CODE_EXECUTION_TIMEOUT_S": "6",
        })
        self.assertEqual(caps.memory_bytes, 512 * 1024**2)
        self.assertEqual(caps.cpus, 0.5)
        self.assertEqual(caps.output_max_bytes, 4096)
        self.assertEqual(caps.copy_max_bytes, 1024**3)
        self.assertEqual(caps.max_runtimes, 2)
        self.assertEqual(caps.execution_timeout_s, 6.0)

    def test_sizes_are_read_in_every_spelling(self):
        self.assertEqual(parse_bytes("8388608"), 8388608)
        self.assertEqual(parse_bytes("2G"), 2 * 1024**3)
        self.assertEqual(parse_bytes("16MiB"), 16 * 1024**2)
        with self.assertRaises(ValueError):
            parse_bytes("lots")


if __name__ == "__main__":
    unittest.main()
