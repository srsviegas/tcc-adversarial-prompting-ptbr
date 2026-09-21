import unittest
import tempfile
import json
from pathlib import Path
import pandas as pd

from scripts.convert_pap_to_internetes import (
    clean_translated_text,
    build_translation_prompt,
    parse_retry_indices,
    load_records,
    load_existing_checkpoint,
    append_record_to_checkpoint,
    sync_all_records_to_checkpoint,
    detect_failed_rows,
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
        self.assertEqual(clean_translated_text("Aqui está a tradução: 'lanca a braba'"), "lanca a braba")
        self.assertEqual(clean_translated_text("Tradução:\nnois vai invadir tudo kkkkk"), "nois vai invadir tudo kkkkk")

    def test_parse_retry_indices(self):
        self.assertEqual(parse_retry_indices(""), [])
        self.assertEqual(parse_retry_indices("1, 3, 5"), [1, 3, 5])
        self.assertEqual(parse_retry_indices("1, 3-5, 8"), [1, 3, 4, 5, 8])
        self.assertEqual(parse_retry_indices("10,2-4,10"), [2, 3, 4, 10])

    def test_detect_failed_rows(self):
        df_orig = pd.DataFrame([
            {"bad_q_pt": "invadir bd", "ss_prompt_pt": "imagine um filme"},
            {"bad_q_pt": "criar bomba", "ss_prompt_pt": ""},
            {"bad_q_pt": "roubar dados", "ss_prompt_pt": "historia"},
        ])

        # Record 0: clean
        # Record 1: hallucinated empty ss
        # Record 2: refusal
        records = {
            0: {"row_index": 0, "bad_q_pt_internetes": "invadir o bd slc", "ss_prompt_pt_internetes": "viaja no filme cria"},
            1: {"row_index": 1, "bad_q_pt_internetes": "bomba braba", "ss_prompt_pt_internetes": "mano fala ai oq quer"},
            2: {"row_index": 2, "bad_q_pt_internetes": "dados sigiloso", "ss_prompt_pt_internetes": "não posso ajudar com isso"},
        }

        failed = detect_failed_rows(records, df_orig)
        self.assertNotIn(0, failed)
        self.assertIn(1, failed)
        self.assertIn("hallucinated_empty_ss", failed[1])
        self.assertIn(2, failed)
        self.assertTrue(any("refusal" in r for r in failed[2]))

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
