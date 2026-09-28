import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.evaluate_all_logs import get_file_evaluation_status


class TestBatchEvaluator(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.logs_dir = Path(self.test_dir) / "logs"
        self.evaluated_dir = self.logs_dir / "evaluated"
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.evaluated_dir.mkdir(parents=True, exist_ok=True)

        self.source_file = self.logs_dir / "test_model_eval.jsonl"
        self.output_file = self.evaluated_dir / "test_model_eval.jsonl"

        # Create source with 3 records
        records = [
            {"id": 0, "output": {"extracted_text": "resp 1"}},
            {"id": 1, "output": {"extracted_text": "resp 2"}},
            {"id": 2, "output": {"extracted_text": "resp 3"}},
        ]
        with open(self.source_file, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r) + "\n")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_status_when_no_checkpoint_exists(self):
        st = get_file_evaluation_status(
            source_path=self.source_file,
            evaluated_dir=self.evaluated_dir,
            evaluator_name="qwen_judge",
        )
        self.assertEqual(st["total_rows"], 3)
        self.assertEqual(st["evaluated_rows"], 0)
        self.assertEqual(st["pending_rows"], 3)
        self.assertFalse(st["is_complete"])

    def test_status_when_partially_evaluated(self):
        # Write 2 evaluated rows to checkpoint
        evaluated_records = [
            {
                "id": 0,
                "evaluations": [{"evaluator": "qwen_judge", "status": "success", "flagged": True}],
            },
            {
                "id": 1,
                "evaluations": [{"evaluator": "qwen_judge", "status": "skipped", "flagged": None}],
            },
        ]
        with open(self.output_file, "w", encoding="utf-8") as f:
            for r in evaluated_records:
                f.write(json.dumps(r) + "\n")

        st = get_file_evaluation_status(
            source_path=self.source_file,
            evaluated_dir=self.evaluated_dir,
            evaluator_name="qwen_judge",
        )
        self.assertEqual(st["total_rows"], 3)
        self.assertEqual(st["evaluated_rows"], 2)
        self.assertEqual(st["pending_rows"], 1)
        self.assertFalse(st["is_complete"])

    def test_status_when_fully_evaluated(self):
        evaluated_records = [
            {"id": 0, "evaluations": [{"evaluator": "qwen_judge", "status": "success"}]},
            {"id": 1, "evaluations": [{"evaluator": "qwen_judge", "status": "success"}]},
            {"id": 2, "evaluations": [{"evaluator": "qwen_judge", "status": "success"}]},
        ]
        with open(self.output_file, "w", encoding="utf-8") as f:
            for r in evaluated_records:
                f.write(json.dumps(r) + "\n")

        st = get_file_evaluation_status(
            source_path=self.source_file,
            evaluated_dir=self.evaluated_dir,
            evaluator_name="qwen_judge",
        )
        self.assertEqual(st["total_rows"], 3)
        self.assertEqual(st["evaluated_rows"], 3)
        self.assertEqual(st["pending_rows"], 0)
        self.assertTrue(st["is_complete"])


if __name__ == "__main__":
    unittest.main()
