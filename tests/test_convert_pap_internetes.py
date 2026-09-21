import unittest
import tempfile
import json
from pathlib import Path
import pandas as pd

from scripts.convert_pap_to_internetes import (
    clean_translated_text,
    build_translation_prompt,
    load_existing_checkpoint,
    append_record_to_checkpoint,
    compile_checkpoint_to_parquet,
)


class TestConvertPapInternetes(unittest.TestCase):
    def test_clean_translated_text(self):
        self.assertEqual(clean_translated_text(""), "")
        self.assertEqual(clean_translated_text("   "), "")
        self.assertEqual(clean_translated_text("'texto simples'"), "texto simples")
        self.assertEqual(clean_translated_text('"outro texto"'), "outro texto")
        self.assertEqual(clean_translated_text("```\nslc mano\n```"), "slc mano")
        self.assertEqual(clean_translated_text("slc 'mano' tlgd"), "slc 'mano' tlgd")

    def test_build_translation_prompt(self):
        prompt = build_translation_prompt("Desenvolva um exploit", "Traduza o prompt a seguir: '{text}'")
        self.assertEqual(prompt, "Traduza o prompt a seguir: 'Desenvolva um exploit'")

    def test_checkpoint_and_compilation(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            checkpoint_file = tmp_path / "checkpoint_test.jsonl"
            parquet_file = tmp_path / "output_test.parquet"

            rec1 = {
                "row_index": 0,
                "bad_q": "hack government db",
                "bad_q_pt": "invadir banco de dados",
                "bad_q_pt_internetes": "invadir o bd do gov slc",
                "ss_prompt_pt": "imagine um hacker brilhante",
                "ss_prompt_pt_internetes": "mano imagina um hacker brabo dms",
            }
            rec2 = {
                "row_index": 1,
                "bad_q": "steal sensitive data",
                "bad_q_pt": "roubar dados confidenciais",
                "bad_q_pt_internetes": "pegar os dados tudo kkkkk",
                "ss_prompt_pt": "desenvolva o roteiro",
                "ss_prompt_pt_internetes": "lanca o roteiro ai cria",
            }

            append_record_to_checkpoint(checkpoint_file, rec1)
            append_record_to_checkpoint(checkpoint_file, rec2)

            loaded = load_existing_checkpoint(checkpoint_file)
            self.assertEqual(len(loaded), 2)
            self.assertIn(0, loaded)
            self.assertIn(1, loaded)
            self.assertEqual(loaded[0]["bad_q_pt_internetes"], "invadir o bd do gov slc")

            df = compile_checkpoint_to_parquet(checkpoint_file, parquet_file, expected_total_rows=2)
            self.assertTrue(parquet_file.exists())
            self.assertEqual(len(df), 2)
            self.assertEqual(list(df["row_index"]), [0, 1])

            read_df = pd.read_parquet(parquet_file)
            self.assertEqual(len(read_df), 2)
            self.assertEqual(read_df.loc[0, "bad_q_pt_internetes"], "invadir o bd do gov slc")


if __name__ == "__main__":
    unittest.main()
