import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.evaluators import (
    EvaluatorRegistry,
    OpenAIModerationEvaluator,
    run_evaluation,
)


class TestOpenAIModerationEvaluator(unittest.TestCase):
    def test_empty_or_whitespace_input_skips(self):
        evaluator = OpenAIModerationEvaluator()
        res_empty = evaluator.evaluate("")
        self.assertEqual(res_empty["status"], "skipped")
        self.assertIsNone(res_empty["flagged"])
        self.assertIn("empty", res_empty["skip_reason"].lower())

        res_spaces = evaluator.evaluate("    \n  ")
        self.assertEqual(res_spaces["status"], "skipped")

    @patch("openai.OpenAI")
    def test_flagged_content_evaluation(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_category_scores = MagicMock()
        mock_category_scores.model_dump.return_value = {
            "sexual": 0.001,
            "hate": 0.005,
            "harassment": 0.02,
            "self-harm": 0.0,
            "sexual/minors": 0.0,
            "hate/threatening": 0.0,
            "violence/graphic": 0.01,
            "self-harm/intent": 0.0,
            "self-harm/instructions": 0.0,
            "harassment/threatening": 0.01,
            "violence": 0.942,
            "illicit": 0.810,
            "illicit/violent": 0.05,
        }

        mock_categories = MagicMock()
        mock_categories.model_dump.return_value = {
            "sexual": False,
            "hate": False,
            "harassment": False,
            "self-harm": False,
            "sexual/minors": False,
            "hate/threatening": False,
            "violence/graphic": False,
            "self-harm/intent": False,
            "self-harm/instructions": False,
            "harassment/threatening": False,
            "violence": True,
            "illicit": True,
            "illicit/violent": False,
        }

        mock_result = MagicMock()
        mock_result.flagged = True
        mock_result.categories = mock_categories
        mock_result.category_scores = mock_category_scores
        mock_result.category_applied_input_types = None
        mock_result.model_dump.return_value = {"flagged": True, "id": "modr-123"}

        mock_response = MagicMock()
        mock_response.results = [mock_result]
        mock_response.model_dump.return_value = {
            "id": "modr-123",
            "model": "omni-moderation-latest",
            "results": [{"flagged": True}],
        }
        mock_client.moderations.create.return_value = mock_response

        evaluator = OpenAIModerationEvaluator(api_key="test-key")
        res = evaluator.evaluate("Threatening violent text")

        self.assertEqual(res["status"], "success")
        self.assertTrue(res["flagged"])
        self.assertEqual(set(res["flagged_categories"]), {"violence", "illicit"})
        self.assertEqual(res["highest_scoring_category"], "violence")
        self.assertAlmostEqual(res["highest_score"], 0.942, places=3)
        self.assertIsNotNone(res["raw_response"])
        self.assertEqual(res["raw_response"]["id"], "modr-123")

    @patch("openai.OpenAI")
    def test_clean_content_evaluation(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_category_scores = MagicMock()
        mock_category_scores.model_dump.return_value = {
            "sexual": 0.0001,
            "hate": 0.0002,
            "violence": 0.001,
        }

        mock_categories = MagicMock()
        mock_categories.model_dump.return_value = {
            "sexual": False,
            "hate": False,
            "violence": False,
        }

        mock_result = MagicMock()
        mock_result.flagged = False
        mock_result.categories = mock_categories
        mock_result.category_scores = mock_category_scores
        mock_result.category_applied_input_types = None
        mock_result.model_dump.return_value = {"flagged": False}

        mock_response = MagicMock()
        mock_response.results = [mock_result]
        mock_response.model_dump.return_value = {"id": "modr-clean", "results": [{"flagged": False}]}
        mock_client.moderations.create.return_value = mock_response

        evaluator = OpenAIModerationEvaluator(api_key="test-key")
        res = evaluator.evaluate("Construa uma casinha de passarinhos de madeira.")

        self.assertEqual(res["status"], "success")
        self.assertFalse(res["flagged"])
        self.assertEqual(res["flagged_categories"], [])
        self.assertEqual(res["highest_scoring_category"], "violence")
        self.assertAlmostEqual(res["highest_score"], 0.001, places=3)


class TestEvaluatorRegistry(unittest.TestCase):
    def test_registry_lookups(self):
        ev1 = EvaluatorRegistry.get_evaluator("openai_moderation")
        self.assertIsInstance(ev1, OpenAIModerationEvaluator)

        ev2 = EvaluatorRegistry.get_evaluator("openai")
        self.assertIsInstance(ev2, OpenAIModerationEvaluator)

        with self.assertRaises(ValueError):
            EvaluatorRegistry.get_evaluator("unknown_evaluator_xyz")


class TestEvaluationRunnerAndCheckpoint(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.project_root = Path(__file__).resolve().parent.parent
        self.logs_dir = self.project_root / "logs"
        self.evaluated_dir = self.logs_dir / "evaluated"
        self.evaluated_dir.mkdir(parents=True, exist_ok=True)

        self.test_log_name = "_test_dummy_pap_eval.jsonl"
        self.test_log_path = self.logs_dir / self.test_log_name
        self.test_output_path = self.evaluated_dir / self.test_log_name

        records = [
            {
                "dataset_metadata": {"original_row_index": 0},
                "model_config": {"model_name": "test-model"},
                "inputs": {"prompt_language": "pt", "attack_style": "plain"},
                "run_metadata": {"iteration": 1},
                "output": {"extracted_text": "Texto malicioso perigoso"},
                "error_log": {"failed": False},
            },
            {
                "dataset_metadata": {"original_row_index": 1},
                "model_config": {"model_name": "test-model"},
                "inputs": {"prompt_language": "pt", "attack_style": "plain"},
                "run_metadata": {"iteration": 1},
                "output": {"extracted_text": "Texto inofensivo e limpo"},
                "error_log": {"failed": False},
            },
            {
                "dataset_metadata": {"original_row_index": 2},
                "model_config": {"model_name": "test-model"},
                "inputs": {"prompt_language": "pt", "attack_style": "plain"},
                "run_metadata": {"iteration": 1},
                "output": {"extracted_text": ""},
                "error_log": {"failed": True, "error_message": "Network error"},
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

    @patch.object(OpenAIModerationEvaluator, "evaluate")
    def test_run_evaluation_and_checkpoint_resume(self, mock_evaluate):
        # Mock responses
        mock_evaluate.side_effect = [
            {
                "evaluator": "openai_moderation",
                "model": "omni-moderation-latest",
                "evaluated_at": "2026-09-14T00:00:00Z",
                "status": "success",
                "flagged": True,
                "flagged_categories": ["violence"],
                "highest_scoring_category": "violence",
                "highest_score": 0.95,
                "categories": {"violence": True},
                "category_scores": {"violence": 0.95},
                "raw_response": {"flagged": True},
            },
            {
                "evaluator": "openai_moderation",
                "model": "omni-moderation-latest",
                "evaluated_at": "2026-09-14T00:00:01Z",
                "status": "success",
                "flagged": False,
                "flagged_categories": [],
                "highest_scoring_category": "violence",
                "highest_score": 0.01,
                "categories": {"violence": False},
                "category_scores": {"violence": 0.01},
                "raw_response": {"flagged": False},
            },
        ]

        # 1. First run: processes rows 0, 1, and skips row 2 (which had failed error_log)
        from rich.console import Console
        from src.evaluators.ui import EvaluationUI
        quiet_ui = EvaluationUI(console=Console(quiet=True))

        out_path = run_evaluation(
            log_file=str(self.test_log_path),
            evaluator_name="openai_moderation",
            api_key="mock_key",
            ui=quiet_ui,
        )

        self.assertTrue(out_path.exists())
        self.assertEqual(mock_evaluate.call_count, 2)

        # Inspect written evaluated lines
        evaluated_lines = []
        with open(out_path, "r", encoding="utf-8") as f:
            for line in f:
                evaluated_lines.append(json.loads(line))

        self.assertEqual(len(evaluated_lines), 3)

        # Check evaluations list format
        self.assertIn("evaluations", evaluated_lines[0])
        self.assertIsInstance(evaluated_lines[0]["evaluations"], list)
        self.assertEqual(len(evaluated_lines[0]["evaluations"]), 1)
        self.assertTrue(evaluated_lines[0]["evaluations"][0]["flagged"])

        # Row 1 is clean
        self.assertFalse(evaluated_lines[1]["evaluations"][0]["flagged"])

        # Row 2 was skipped because error_log.failed was True
        self.assertEqual(evaluated_lines[2]["evaluations"][0]["status"], "skipped")
        self.assertIsNone(evaluated_lines[2]["evaluations"][0]["flagged"])

        # 2. Second run: resume from checkpoint!
        mock_evaluate.reset_mock()
        quiet_ui2 = EvaluationUI(console=Console(quiet=True))
        run_evaluation(
            log_file=str(self.test_log_path),
            evaluator_name="openai_moderation",
            api_key="mock_key",
            ui=quiet_ui2,
        )

        # evaluate should NOT be called because all 3 rows were already completed!
        self.assertEqual(mock_evaluate.call_count, 0)

        # Verify output still has exactly 3 rows
        with open(out_path, "r", encoding="utf-8") as f:
            lines = [json.loads(line) for line in f if line.strip()]
        self.assertEqual(len(lines), 3)


if __name__ == "__main__":
    unittest.main()
