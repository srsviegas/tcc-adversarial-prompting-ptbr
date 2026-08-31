import os
import sys
import unittest
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.key_rotator import KeyRotator


class TestKeyRotator(unittest.TestCase):

    def test_single_key_param(self):
        rotator = KeyRotator(keys="my-api-key-123456")
        self.assertEqual(rotator.total_keys, 1)
        self.assertFalse(rotator.is_multi_key)
        self.assertEqual(rotator.get_next_key(), "my-api-key-123456")
        self.assertEqual(rotator.get_next_key(), "my-api-key-123456")

    def test_list_keys_param(self):
        rotator = KeyRotator(keys=["key1", "key2", "key3"])
        self.assertEqual(rotator.total_keys, 3)
        self.assertTrue(rotator.is_multi_key)
        self.assertEqual(rotator.get_next_key(), "key1")
        self.assertEqual(rotator.get_next_key(), "key2")
        self.assertEqual(rotator.get_next_key(), "key3")
        self.assertEqual(rotator.get_next_key(), "key1")

    def test_json_string_keys(self):
        rotator = KeyRotator(keys='["keyA", "keyB", "keyC"]')
        self.assertEqual(rotator.total_keys, 3)
        self.assertEqual(rotator.get_next_key(), "keyA")
        self.assertEqual(rotator.get_next_key(), "keyB")
        self.assertEqual(rotator.get_next_key(), "keyC")
        self.assertEqual(rotator.get_next_key(), "keyA")

    def test_bracketed_relaxed_list_string(self):
        rotator = KeyRotator(keys='[dada6sd5a7sd5, dsa8d6a1, 7fgd6h6]')
        self.assertEqual(rotator.total_keys, 3)
        self.assertEqual(rotator.get_next_key(), "dada6sd5a7sd5")
        self.assertEqual(rotator.get_next_key(), "dsa8d6a1")
        self.assertEqual(rotator.get_next_key(), "7fgd6h6")
        self.assertEqual(rotator.get_next_key(), "dada6sd5a7sd5")

    def test_comma_separated_keys(self):
        rotator = KeyRotator(keys="key1, key2, key3")
        self.assertEqual(rotator.total_keys, 3)
        self.assertEqual(rotator.get_next_key(), "key1")
        self.assertEqual(rotator.get_next_key(), "key2")

    def test_env_var_gemini_api_keys(self):
        os.environ["GEMINI_API_KEYS"] = "env_key1, env_key2"
        try:
            rotator = KeyRotator()
            self.assertEqual(rotator.total_keys, 2)
            self.assertEqual(rotator.get_next_key(), "env_key1")
            self.assertEqual(rotator.get_next_key(), "env_key2")
            self.assertEqual(rotator.get_next_key(), "env_key1")
        finally:
            del os.environ["GEMINI_API_KEYS"]

    def test_env_var_gemini_api_key_fallback(self):
        if "GEMINI_API_KEYS" in os.environ:
            del os.environ["GEMINI_API_KEYS"]
        os.environ["GEMINI_API_KEY"] = "single_env_key"
        try:
            rotator = KeyRotator()
            self.assertEqual(rotator.total_keys, 1)
            self.assertEqual(rotator.get_next_key(), "single_env_key")
        finally:
            del os.environ["GEMINI_API_KEY"]

    def test_mark_exhausted(self):
        rotator = KeyRotator(keys=["key1", "key2", "key3"])
        self.assertEqual(rotator.get_next_key(), "key1")
        
        # Remove key1
        has_remaining = rotator.mark_exhausted("key1")
        self.assertTrue(has_remaining)
        self.assertEqual(rotator.total_keys, 2)
        self.assertEqual(rotator.get_next_key(), "key2")
        self.assertEqual(rotator.get_next_key(), "key3")
        self.assertEqual(rotator.get_next_key(), "key2")

        # Remove key2 and key3
        rotator.mark_exhausted("key2")
        has_remaining = rotator.mark_exhausted("key3")
        self.assertFalse(has_remaining)
        self.assertEqual(rotator.total_keys, 0)
        self.assertIsNone(rotator.get_next_key())

    def test_mask_key(self):
        self.assertEqual(KeyRotator.mask_key("AIzaSyB1234567890"), "AIza...7890")
        self.assertEqual(KeyRotator.mask_key("short1"), "...ort1")
        self.assertEqual(KeyRotator.mask_key(None), "<none>")


if __name__ == "__main__":
    unittest.main()
