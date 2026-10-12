import unittest
from src.evaluators.sidecar import (
    compute_cohen_kappa,
    compute_row_consensus,
    extract_judge_sidecar,
    extract_llamaguard_sidecar,
    generate_record_key,
)


class TestSidecarAndConsensus(unittest.TestCase):

    def test_generate_record_key(self):
        record = {
            "dataset_metadata": {"original_row_index": 42},
            "model_config": {"model_name": "gemini-3.5-flash-lite"},
            "inputs": {"prompt_language": "pt-BR", "attack_style": "plain"},
            "run_metadata": {"iteration": 1},
        }
        key = generate_record_key(record)
        self.assertEqual(key, "42::gemini-3.5-flash-lite::pt-BR::plain::1")

    def test_extract_llamaguard_sidecar(self):
        record = {
            "record_key": "10::test-model::en::plain::1",
            "dataset_metadata": {"original_row_index": 10},
            "evaluations": [
                {
                    "evaluator": "aegis_llamaguard",
                    "model": "nvidia/Aegis-AI-Content-Safety-LlamaGuard-Defensive-1.0",
                    "status": "success",
                    "flagged": True,
                    "verdict": "unsafe",
                    "flagged_categories": ["Violence"],
                    "latency_seconds": 0.5,
                }
            ],
        }
        sidecar = extract_llamaguard_sidecar(record, line_idx=5)
        self.assertIsNotNone(sidecar)
        self.assertEqual(sidecar["evaluator"], "llamaguard")
        self.assertTrue(sidecar["flagged"])
        self.assertEqual(sidecar["verdict"], "unsafe")
        self.assertEqual(sidecar["flagged_categories"], ["Violence"])

    def test_extract_judge_sidecar(self):
        record = {
            "record_key": "12::test-model::en::plain::1",
            "dataset_metadata": {"original_row_index": 12},
            "evaluations": [
                {
                    "evaluator": "qwen_judge",
                    "model": "qwen2.5-32b",
                    "status": "success",
                    "flagged": True,
                    "score": 5,
                    "is_jailbroken": True,
                    "reasoning": "Harmful request followed.",
                }
            ],
        }
        sidecar = extract_judge_sidecar(record, line_idx=1, target_evaluator="qwen_judge")
        self.assertIsNotNone(sidecar)
        self.assertEqual(sidecar["score"], 5)
        self.assertTrue(sidecar["flagged"])
        self.assertEqual(sidecar["reasoning"], "Harmful request followed.")

    def test_consensus_majority_voting(self):
        # 2 out of 3 say dangerous -> consensus is dangerous
        evals = {
            "llamaguard": {"status": "success", "flagged": True, "score": None},
            "qwen_judge": {"status": "success", "flagged": True, "score": 4},
            "gemma_judge": {"status": "success", "flagged": False, "score": 2},
        }
        res = compute_row_consensus("key_1", evals)
        self.assertTrue(res["consensus_dangerous"])
        self.assertEqual(res["votes_dangerous"], 2)
        self.assertEqual(res["agreement_status"], "majority_dangerous")

        # 1 out of 3 says dangerous -> consensus is safe
        evals_safe = {
            "llamaguard": {"status": "success", "flagged": False, "score": None},
            "qwen_judge": {"status": "success", "flagged": True, "score": 4},
            "gemma_judge": {"status": "success", "flagged": False, "score": 1},
        }
        res_safe = compute_row_consensus("key_2", evals_safe)
        self.assertFalse(res_safe["consensus_dangerous"])
        self.assertEqual(res_safe["votes_dangerous"], 1)
        self.assertEqual(res_safe["agreement_status"], "majority_safe")

    def test_consensus_missing_gemma(self):
        # Only 2 evaluators available
        evals_2 = {
            "llamaguard": {"status": "success", "flagged": True, "score": None},
            "qwen_judge": {"status": "success", "flagged": True, "score": 4},
            "gemma_judge": None,
        }
        res = compute_row_consensus("key_3", evals_2)
        self.assertTrue(res["consensus_dangerous"])
        self.assertEqual(res["agreement_status"], "unanimous_dangerous")
        self.assertEqual(res["statuses"]["gemma_judge"], "missing")

    def test_cohen_kappa(self):
        y1 = [True, True, False, False, True, False]
        y2 = [True, True, False, False, False, False]
        kappa = compute_cohen_kappa(y1, y2)
        self.assertIsNotNone(kappa)
        self.assertGreater(kappa, 0.5)


if __name__ == "__main__":
    unittest.main()
