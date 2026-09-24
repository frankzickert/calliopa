"""The caps: every default kept by an unset or empty variable, every override read. BO_0296_001"""

import unittest

from lib.caps import Caps, parse_bytes


class CapsTest(unittest.TestCase):
    def test_given_no_environment_then_every_default_holds(self):
        caps = Caps.from_env({})
        self.assertEqual(caps, Caps())
        self.assertEqual(caps.source_max_bytes, 1024**2)
        self.assertEqual(caps.timeout_s, 5.0)
        self.assertEqual(caps.concurrency, 3)

    def test_given_an_empty_variable_then_the_default_is_kept(self):
        caps = Caps.from_env({"CALLIOPA_CODE_FORMAT_TIMEOUT_S": "", "CALLIOPA_CODE_FORMAT_CONCURRENCY": "  "})
        self.assertEqual(caps.timeout_s, Caps().timeout_s)
        self.assertEqual(caps.concurrency, Caps().concurrency)

    def test_given_overrides_then_each_is_read(self):
        caps = Caps.from_env({
            "CALLIOPA_CODE_FORMAT_SOURCE_MAX_BYTES": "64k",
            "CALLIOPA_CODE_FORMAT_TIMEOUT_S": "0.5",
            "CALLIOPA_CODE_FORMAT_CONCURRENCY": "1",
            "CALLIOPA_CODE_FORMAT_QUEUE_WAIT_S": "0.25",
        })
        self.assertEqual(caps.source_max_bytes, 64 * 1024)
        self.assertEqual(caps.timeout_s, 0.5)
        self.assertEqual(caps.concurrency, 1)
        self.assertEqual(caps.queue_wait_s, 0.25)

    def test_given_a_size_then_every_unit_reads(self):
        self.assertEqual(parse_bytes("1024"), 1024)
        self.assertEqual(parse_bytes("64k"), 64 * 1024)
        self.assertEqual(parse_bytes("2MiB"), 2 * 1024**2)
        with self.assertRaises(ValueError):
            parse_bytes("a lot")


if __name__ == "__main__":
    unittest.main()
