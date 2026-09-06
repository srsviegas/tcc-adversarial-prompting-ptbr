import os
import sys
import json
import time
import unittest
import threading
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.key_rotator import KeyRotator
from src.logger import BenchmarkLogger


class TestConcurrency(unittest.TestCase):

    def test_concurrent_key_rotation(self):
        """Verify that multiple threads rotating keys concurrently do not cause race conditions."""
        keys = ["key_alpha", "key_beta", "key_gamma", "key_delta"]
        rotator = KeyRotator(keys=keys)

        results = []
        lock = threading.Lock()

        def worker(num_iterations):
            local_keys = []
            for _ in range(num_iterations):
                k = rotator.get_next_key()
                local_keys.append(k)
            with lock:
                results.extend(local_keys)

        num_threads = 8
        iterations_per_thread = 250
        total_calls = num_threads * iterations_per_thread

        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, iterations_per_thread) for _ in range(num_threads)]
            for f in futures:
                f.result()

        self.assertEqual(len(results), total_calls)
        # All keys should have been used
        for k in keys:
            self.assertIn(k, results)
        # Each key should have been selected approximately total_calls // len(keys) times
        expected_per_key = total_calls // len(keys)
        for k in keys:
            self.assertEqual(results.count(k), expected_per_key)

    def test_concurrent_key_exhaustion(self):
        """Verify thread-safe key exhaustion when multiple threads encounter quota errors."""
        keys = [f"key_{i}" for i in range(10)]
        rotator = KeyRotator(keys=keys)

        def worker(key_to_exhaust):
            time.sleep(0.001)
            rotator.mark_exhausted(key_to_exhaust)

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(worker, k) for k in keys]
            for f in futures:
                f.result()

        self.assertEqual(rotator.total_keys, 0)
        self.assertIsNone(rotator.get_next_key())

    def test_concurrent_logger_writes(self):
        """Verify that concurrent writes from multiple threads never corrupt JSONL lines and checkpoints load cleanly."""
        temp_log_name = f"test_concurrent_{int(time.time() * 1000)}.jsonl"
        logger = BenchmarkLogger(temp_log_name)

        try:
            num_threads = 10
            records_per_thread = 25
            total_records = num_threads * records_per_thread

            def write_worker(thread_idx):
                for rec_idx in range(records_per_thread):
                    global_id = thread_idx * 1000 + rec_idx
                    record = {
                        "run_metadata": {
                            "run_id": "test_run",
                            "iteration": 1,
                        },
                        "dataset_metadata": {
                            "original_row_index": global_id,
                        },
                        "inputs": {
                            "prompt_language": "en",
                            "attack_style": "plain",
                        },
                        "model_config": {
                            "model_name": "test-model",
                        },
                        "execution_metrics": {
                            "latency_seconds": 0.05,
                        },
                        "output": f"Output from thread {thread_idx} record {rec_idx}",
                        "error_log": {
                            "failed": False,
                        },
                    }
                    logger.log_result(record)

            with ThreadPoolExecutor(max_workers=num_threads) as executor:
                futures = [executor.submit(write_worker, i) for i in range(num_threads)]
                for f in futures:
                    f.result()

            # 1. Verify in-memory processed keys count
            self.assertEqual(len(logger.processed_keys), total_records)

            # 2. Verify physical file line-by-line: every line must be valid JSON
            parsed_lines = []
            with open(logger.log_filepath, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line_str = line.strip()
                    self.assertTrue(bool(line_str), f"Empty line found at line {line_num}")
                    try:
                        data = json.loads(line_str)
                        parsed_lines.append(data)
                    except json.JSONDecodeError as err:
                        self.fail(f"Corrupted JSON line at line {line_num}: {err}\nLine: {line_str}")

            self.assertEqual(len(parsed_lines), total_records)

            # 3. Verify checkpoint recovery: a new BenchmarkLogger instance pointing to the same file
            # must recover exactly total_records processed keys without errors.
            reloaded_logger = BenchmarkLogger(temp_log_name)
            self.assertEqual(len(reloaded_logger.processed_keys), total_records)

            # Spot-check membership
            for thread_idx in range(num_threads):
                for rec_idx in range(records_per_thread):
                    gid = thread_idx * 1000 + rec_idx
                    self.assertTrue(
                        reloaded_logger.is_already_processed(gid, "test-model", "en", "plain", 1),
                        f"Expected record {gid} to be checkpointed"
                    )

        finally:
            # Clean up temporary test log file
            if logger.log_filepath.exists():
                try:
                    logger.log_filepath.unlink()
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()
