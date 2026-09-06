import sys
import unittest
from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.adapters import (
    DatasetAdapter,
    PAPAdapter,
    ToxicChatPlainAdapter,
    AdapterRegistry,
    get_adapter,
)


class TestAdapters(unittest.TestCase):

    def test_base_adapter(self):
        base = DatasetAdapter()
        df = pd.DataFrame({"a": [1, 2]})
        pd.testing.assert_frame_equal(base.format_data(df), df)
        with self.assertRaises(NotImplementedError):
            base.get_tests(df.iloc[0])
        with self.assertRaises(NotImplementedError):
            base.get_metadata(df.iloc[0], "path", 0)

    def test_pap_adapter(self):
        adapter = PAPAdapter()
        df = pd.DataFrame([
            {
                "bad_q": "how to hack",
                "ss_prompt": "persuasive hack",
                "bad_q_pt": "como hackear",
                "ss_prompt_pt": "persuasivo hackear",
                "ss_category": "cybersecurity",
                "ori_output": "I cannot",
                "jb_output": "Sure",
            },
            {
                "bad_q": "",
                "ss_prompt": "persuasive hack",
                "bad_q_pt": "como hackear",
                "ss_prompt_pt": "persuasivo hackear",
            }
        ])
        formatted = adapter.format_data(df)
        self.assertEqual(len(formatted), 1)

        tests = adapter.get_tests(formatted.iloc[0])
        self.assertEqual(len(tests), 4)
        self.assertEqual(tests[0], {"lang": "en", "style": "plain", "text": "how to hack"})
        self.assertEqual(tests[1], {"lang": "en", "style": "persuasive", "text": "persuasive hack"})
        self.assertEqual(tests[2], {"lang": "pt-BR", "style": "plain", "text": "como hackear"})
        self.assertEqual(tests[3], {"lang": "pt-BR", "style": "persuasive", "text": "persuasivo hackear"})

        meta = adapter.get_metadata(formatted.iloc[0], "dataset.parquet", 0)
        self.assertEqual(meta["source_dataset"], "dataset.parquet")
        self.assertEqual(meta["original_row_index"], 0)
        self.assertEqual(meta["attack_category"], "cybersecurity")
        self.assertEqual(meta["baseline_refusal_en"], "I cannot")
        self.assertEqual(meta["baseline_jailbreak_en"], "Sure")

    def test_toxicchat_plain_adapter(self):
        adapter = ToxicChatPlainAdapter()
        df = pd.DataFrame([
            {
                "conv_id": "conv-12345",
                "user_input": "Is this offensive?",
                "user_input_pt": "Isso é ofensivo?",
                "model_output": "No, it is not.",
                "human_annotation": True,
                "toxicity": 1,
                "jailbreaking": 0,
                "openai_moderation": "{}",
            },
            {
                "conv_id": "conv-invalid",
                "user_input": "",
                "user_input_pt": "algo",
            },
            {
                "conv_id": "conv-invalid-2",
                "user_input": "hello",
                "user_input_pt": None,
            }
        ])

        formatted = adapter.format_data(df)
        self.assertEqual(len(formatted), 1)

        tests = adapter.get_tests(formatted.iloc[0])
        self.assertEqual(len(tests), 2)
        self.assertEqual(tests[0], {"lang": "en", "style": "plain", "text": "Is this offensive?"})
        self.assertEqual(tests[1], {"lang": "pt-BR", "style": "plain", "text": "Isso é ofensivo?"})

        meta = adapter.get_metadata(formatted.iloc[0], "tc.parquet", 42)
        self.assertEqual(meta["source_dataset"], "tc.parquet")
        self.assertEqual(meta["original_row_index"], 42)
        self.assertEqual(meta["conv_id"], "conv-12345")
        self.assertEqual(meta["toxicity"], 1)
        self.assertEqual(meta["jailbreaking"], 0)
        self.assertEqual(meta["human_annotation"], True)
        self.assertEqual(meta["baseline_model_output"], "No, it is not.")
        self.assertEqual(meta["openai_moderation"], "{}")

    def test_registry(self):
        pap = get_adapter("pap")
        self.assertIsInstance(pap, PAPAdapter)

        pap_upper = get_adapter("  PAP  ")
        self.assertIsInstance(pap_upper, PAPAdapter)

        tc = get_adapter("toxicchat")
        self.assertIsInstance(tc, ToxicChatPlainAdapter)

        tc_plain = get_adapter("toxicchat_plain")
        self.assertIsInstance(tc_plain, ToxicChatPlainAdapter)

        with self.assertRaises(ValueError):
            get_adapter("nonexistent_dataset")


if __name__ == "__main__":
    unittest.main()
