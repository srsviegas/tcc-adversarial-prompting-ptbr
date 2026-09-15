import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.evaluators import (
    AEGIS_TAXONOMY,
    AegisLlamaGuardEvaluator,
    EvaluatorRegistry,
    format_aegis_prompt,
    parse_aegis_output,
    run_evaluation,
)


class TestAegisTaxonomyAndParsing(unittest.TestCase):
    def test_taxonomy_completeness(self):
        self.assertEqual(len(AEGIS_TAXONOMY), 13)
        self.assertIn("O1", AEGIS_TAXONOMY)
        self.assertIn("O13", AEGIS_TAXONOMY)
        self.assertEqual(AEGIS_TAXONOMY["O1"], "Violence")
        self.assertEqual(AEGIS_TAXONOMY["O13"], "Needs Caution")

    def test_format_aegis_prompt(self):
        prompt = format_aegis_prompt("Como fabricar explosivos?")
        self.assertIn("[INST]", prompt)
        self.assertIn("[/INST]", prompt)
        self.assertIn("Agent: Como fabricar explosivos?", prompt)
        self.assertIn("O1: Violence", prompt)
        self.assertIn("O13: Needs Caution", prompt)

    def test_parse_aegis_output_safe(self):
        flagged, codes, names = parse_aegis_output("safe")
        self.assertFalse(flagged)
        self.assertEqual(codes, [])
        self.assertEqual(names, [])

        # Safe with leading/trailing whitespaces or case variations
        flagged, codes, names = parse_aegis_output("  safe\n  ")
        self.assertFalse(flagged)
        self.assertEqual(codes, [])

    def test_parse_aegis_output_unsafe_single(self):
        flagged, codes, names = parse_aegis_output("unsafe\nO1")
        self.assertTrue(flagged)
        self.assertEqual(codes, ["O1"])
        self.assertEqual(names, ["Violence"])

    def test_parse_aegis_output_unsafe_multiple(self):
        flagged, codes, names = parse_aegis_output("unsafe\nO1, O3, O13")
        self.assertTrue(flagged)
        self.assertEqual(codes, ["O1", "O3", "O13"])
        self.assertEqual(names, ["Violence", "Criminal Planning/Confessions", "Needs Caution"])

    def test_parse_aegis_output_deduplication(self):
        flagged, codes, names = parse_aegis_output("unsafe\nO1, O1, O2")
        self.assertTrue(flagged)
        self.assertEqual(codes, ["O1", "O2"])
        self.assertEqual(names, ["Violence", "Sexual"])

    def test_parse_aegis_output_empty(self):
        flagged, codes, names = parse_aegis_output("")
        self.assertFalse(flagged)
        self.assertEqual(codes, [])
        self.assertEqual(names, [])

        flagged, codes, names = parse_aegis_output("   \n ")
        self.assertFalse(flagged)


class TestAegisLlamaGuardEvaluator(unittest.TestCase):
    def test_empty_or_whitespace_input_skips(self):
        evaluator = AegisLlamaGuardEvaluator()
        res_empty = evaluator.evaluate("")
        self.assertEqual(res_empty["status"], "skipped")
        self.assertIsNone(res_empty["flagged"])
        self.assertIn("empty", res_empty["skip_reason"].lower())

        res_spaces = evaluator.evaluate("    \n  ")
        self.assertEqual(res_spaces["status"], "skipped")

    def test_mocked_hf_evaluation_safe(self):
        evaluator = AegisLlamaGuardEvaluator()
        evaluator._load_model = MagicMock()

        mock_tokenizer = MagicMock()
        mock_tokenizer.eos_token_id = 2
        mock_tokenizer.return_tensors = "pt"
        mock_tokenizer.return_value = {
            "input_ids": MagicMock(shape=[1, 10]),
            "attention_mask": MagicMock(),
        }
        mock_tokenizer.decode.return_value = "safe"

        mock_model = MagicMock()
        mock_model.device = "cpu"
        mock_output = MagicMock()
        mock_output.__getitem__.return_value = MagicMock()
        mock_output[0].__getitem__.return_value = [101, 102]
        mock_model.generate.return_value = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 101, 102]]

        evaluator._model = mock_model
        evaluator._tokenizer = mock_tokenizer

        with patch("torch.cuda.is_available", return_value=False):
            res = evaluator.evaluate("Como plantar tomates?")

        self.assertEqual(res["status"], "success")
        self.assertFalse(res["flagged"])
        self.assertEqual(res["verdict"], "safe")
        self.assertEqual(res["flagged_category_codes"], [])
        self.assertEqual(res["flagged_categories"], [])
        self.assertFalse(res["categories"]["Violence"])
        self.assertEqual(res["raw_output"], "safe")

    def test_mocked_hf_evaluation_unsafe(self):
        evaluator = AegisLlamaGuardEvaluator()
        evaluator._load_model = MagicMock()

        mock_tokenizer = MagicMock()
        mock_tokenizer.eos_token_id = 2
        mock_tokenizer.return_value = {
            "input_ids": MagicMock(shape=[1, 10]),
            "attention_mask": MagicMock(),
        }
        mock_tokenizer.decode.return_value = "unsafe\nO1, O4"

        mock_model = MagicMock()
        mock_model.device = "cpu"
        mock_model.generate.return_value = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 201, 202]]

        evaluator._model = mock_model
        evaluator._tokenizer = mock_tokenizer

        with patch("torch.cuda.is_available", return_value=False):
            res = evaluator.evaluate("Aqui estão instruções detalhadas para criar uma arma caseira...")

        self.assertEqual(res["status"], "success")
        self.assertTrue(res["flagged"])
        self.assertEqual(res["verdict"], "unsafe")
        self.assertEqual(res["flagged_category_codes"], ["O1", "O4"])
        self.assertEqual(res["flagged_categories"], ["Violence", "Guns/Illegal Weapons"])
        self.assertTrue(res["categories"]["Violence"])
        self.assertTrue(res["categories"]["Guns/Illegal Weapons"])
        self.assertFalse(res["categories"]["Sexual"])

    def test_mocked_error_handling(self):
        evaluator = AegisLlamaGuardEvaluator()
        evaluator._load_model = MagicMock(side_effect=RuntimeError("CUDA Out of Memory"))

        res = evaluator.evaluate("Qualquer texto")
        self.assertEqual(res["status"], "error")
        self.assertIsNone(res["flagged"])
        self.assertIn("CUDA Out of Memory", res["error_message"])


class TestAegisRegistry(unittest.TestCase):
    def test_registry_lookups(self):
        ev1 = EvaluatorRegistry.get_evaluator("aegis")
        self.assertIsInstance(ev1, AegisLlamaGuardEvaluator)

        ev2 = EvaluatorRegistry.get_evaluator("aegis_llamaguard")
        self.assertIsInstance(ev2, AegisLlamaGuardEvaluator)

        ev3 = EvaluatorRegistry.get_evaluator("llamaguard")
        self.assertIsInstance(ev3, AegisLlamaGuardEvaluator)

        ev4 = EvaluatorRegistry.get_evaluator("aegis_defensive")
        self.assertIsInstance(ev4, AegisLlamaGuardEvaluator)


class TestAegisEvaluationRunner(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.project_root = Path(__file__).resolve().parent.parent
        self.logs_dir = self.project_root / "logs"
        self.evaluated_dir = self.logs_dir / "evaluated"
        self.evaluated_dir.mkdir(parents=True, exist_ok=True)

        self.test_log_name = "_test_dummy_aegis_eval.jsonl"
        self.test_log_path = self.logs_dir / self.test_log_name
        self.test_output_path = self.evaluated_dir / self.test_log_name

        # Row 0: has previous openai evaluation already
        # Row 1: clean row
        records = [
            {
                "dataset_metadata": {"original_row_index": 0},
                "model_config": {"model_name": "test-model"},
                "inputs": {"prompt_language": "pt", "attack_style": "plain"},
                "run_metadata": {"iteration": 1},
                "output": {"extracted_text": "Texto malicioso perigoso"},
                "error_log": {"failed": False},
                "evaluations": [
                    {
                        "evaluator": "openai_moderation",
                        "model": "omni-moderation-latest",
                        "flagged": True,
                    }
                ],
            },
            {
                "dataset_metadata": {"original_row_index": 1},
                "model_config": {"model_name": "test-model"},
                "inputs": {"prompt_language": "pt", "attack_style": "plain"},
                "run_metadata": {"iteration": 1},
                "output": {"extracted_text": "Texto inofensivo e limpo"},
                "error_log": {"failed": False},
            },
        ]

        with open(self.test_log_path, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    def tearDown(self):
        if self.test_log_path.exists():
            self.test_log_path.unlink()
        if self.test_output_path.exists():
            self.test_output_path.unlink()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    @patch.object(AegisLlamaGuardEvaluator, "evaluate")
    def test_run_evaluation_appends_without_overwriting(self, mock_evaluate):
        mock_evaluate.side_effect = [
            {
                "evaluator": "aegis_llamaguard",
                "model": "nvidia/Aegis-AI-Content-Safety-LlamaGuard-Defensive-1.0",
                "evaluated_at": "2026-09-14T00:00:00Z",
                "status": "success",
                "flagged": True,
                "verdict": "unsafe",
                "flagged_category_codes": ["O1"],
                "flagged_categories": ["Violence"],
                "categories": {"Violence": True},
                "raw_output": "unsafe\nO1",
            },
            {
                "evaluator": "aegis_llamaguard",
                "model": "nvidia/Aegis-AI-Content-Safety-LlamaGuard-Defensive-1.0",
                "evaluated_at": "2026-09-14T00:00:01Z",
                "status": "success",
                "flagged": False,
                "verdict": "safe",
                "flagged_category_codes": [],
                "flagged_categories": [],
                "categories": {"Violence": False},
                "raw_output": "safe",
            },
        ]

        from rich.console import Console
        from src.evaluators.ui import EvaluationUI
        quiet_ui = EvaluationUI(console=Console(quiet=True))

        out_path = run_evaluation(
            log_file=str(self.test_log_path),
            evaluator_name="aegis_llamaguard",
            ui=quiet_ui,
        )

        self.assertTrue(out_path.exists())
        self.assertEqual(mock_evaluate.call_count, 2)

        evaluated_lines = []
        with open(out_path, "r", encoding="utf-8") as f:
            for line in f:
                evaluated_lines.append(json.loads(line))

        self.assertEqual(len(evaluated_lines), 2)

        # In row 0: evaluations should have BOTH openai_moderation AND aegis_llamaguard!
        row0_evals = evaluated_lines[0]["evaluations"]
        self.assertEqual(len(row0_evals), 2)
        self.assertEqual(row0_evals[0]["evaluator"], "openai_moderation")
        self.assertEqual(row0_evals[1]["evaluator"], "aegis_llamaguard")
        self.assertTrue(row0_evals[1]["flagged"])
        self.assertEqual(row0_evals[1]["flagged_categories"], ["Violence"])

        # In row 1: evaluations should have 1 entry (aegis_llamaguard)
        row1_evals = evaluated_lines[1]["evaluations"]
        self.assertEqual(len(row1_evals), 1)
        self.assertEqual(row1_evals[0]["evaluator"], "aegis_llamaguard")
        self.assertFalse(row1_evals[0]["flagged"])


if __name__ == "__main__":
    unittest.main()
