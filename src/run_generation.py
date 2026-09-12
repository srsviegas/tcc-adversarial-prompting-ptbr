import os
import sys
import time
import argparse
import threading
import concurrent.futures
import pandas as pd
from pathlib import Path
import platform
from typing import Optional, Union, List

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.logger import BenchmarkLogger
from src.models import generate_response
from src.prompts import TARGET_SYSTEM_PROMPTS
from src.adapters import get_adapter
from src.ui import BenchmarkUI
from src.key_rotator import KeyRotator


def get_environment_info(provider: str):
    gpu_name = None
    try:
        # pyrefly: ignore [missing-import]
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
    except Exception:
        pass

    framework = "google-genai" if provider == "gemini" else "llama-cpp-python"

    return {
        "execution_type": "api" if provider == "gemini" else "local",
        "os": f"{platform.system()} {platform.release()}".strip(),
        "gpu": gpu_name,
        "framework": framework
    }


def run_benchmark(
    dataset_path: str,
    dataset_type: str = "pap",
    provider: str = "gemini",
    model: str = "gemini-3.5-flash-lite",
    iterations: int = 5,
    temperature: float = 0.6,
    top_p: float = 1.0,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    sleep: float = 0.0,
    api_key: Optional[Union[str, List[str]]] = None,
    api_keys: Optional[Union[str, List[str]]] = None,
    max_workers: Optional[int] = None,
    filter_label: str = "all",
):
    if provider == "local" and model == "gemini-3.5-flash-lite":
        model = "models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
    elif provider in ("deepseek", "deepseek_r1", "deepseek-r1", "r1") and model == "gemini-3.5-flash-lite":
        model = "models/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf"
    model_short_name = Path(model).name if ("/" in model or "\\" in model or ":" in model) else model
    model_short_name = model_short_name.replace(":", "_").replace("/", "_").replace("\\", "_")

    ui = BenchmarkUI()
    run_id = f"{dataset_type}_eval_{model_short_name}_{provider}_v1"
    env_info = get_environment_info(provider)

    key_rotator = None
    if provider == "gemini":
        key_rotator = KeyRotator(keys=api_keys or api_key)
        if key_rotator.total_keys == 0:
            ui.log_error("Neither GEMINI_API_KEYS nor GEMINI_API_KEY environment variable is set.")
            sys.exit(1)

    if max_workers is not None and max_workers > 0:
        effective_workers = max_workers
    elif provider == "gemini" and key_rotator:
        effective_workers = max(1, key_rotator.total_keys)
    else:
        effective_workers = 1

    df = pd.read_parquet(dataset_path)
    try:
        adapter = get_adapter(dataset_type, filter_label=filter_label)
    except TypeError:
        adapter = get_adapter(dataset_type)
    df = adapter.format_data(df)

    log_filename = f"{provider}_{model_short_name}_{dataset_type}_eval.jsonl"
    logger = BenchmarkLogger(log_filename)

    total_executions = sum(len(adapter.get_tests(row)) * iterations for _, row in df.iterrows())
    checkpoint_count = len(logger.processed_keys)

    dataset_name = Path(dataset_path).name
    ui.show_header(
        dataset_name=dataset_name,
        total_rows=len(df),
        provider=provider,
        model=model,
        iterations=iterations,
        temperature=temperature,
        top_p=top_p,
        total_executions=total_executions,
        checkpoint_count=checkpoint_count,
        workers=effective_workers,
    )

    if provider == "gemini" and key_rotator and key_rotator.is_multi_key:
        ui.log_info(f"Initialized API key pool with {key_rotator.total_keys} keys (round-robin rotation enabled).")
    if effective_workers > 1:
        ui.log_info(f"Parallel execution enabled with {effective_workers} worker threads.")

    # Collect pending tasks that haven't been completed yet
    tasks = []
    for index, row in df.iterrows():
        tests = adapter.get_tests(row)
        for test in tests:
            for iteration in range(1, iterations + 1):
                if not logger.is_already_processed(index, model, test["lang"], test["style"], iteration):
                    tasks.append({
                        "index": index,
                        "row": row,
                        "test": test,
                        "iteration": iteration,
                    })

    stop_event = threading.Event()

    def process_task(task):
        if stop_event.is_set():
            return

        index = task["index"]
        row = task["row"]
        test = task["test"]
        iteration = task["iteration"]

        if logger.is_already_processed(index, model, test["lang"], test["style"], iteration):
            return

        status_desc = f"Generating [dim]| Row #{index} ({test['lang'].upper()}/{test['style'].upper()} iter {iteration}/{iterations})[/dim]"
        ui.update_progress(advance=0, status_desc=status_desc)

        system_prompt = TARGET_SYSTEM_PROMPTS[test["lang"]]
        max_retries = 3
        retry_count = 0
        success = False
        result = None

        current_seed = seed + iteration if seed is not None else None
        current_api_key = key_rotator.get_next_key() if key_rotator else None

        while retry_count < max_retries and not success:
            if stop_event.is_set():
                return

            result = generate_response(
                model_provider=provider,
                api_key=current_api_key,
                model_name=model,
                system_prompt=system_prompt,
                user_prompt=test["text"],
                temperature=temperature,
                top_p=top_p,
                max_output_tokens=max_output_tokens,
                seed=current_seed
            )

            if result["error_log"]["failed"]:
                retry_count += 1
                raw_err_msg = str(result["error_log"]["error_message"]).strip()
                error_msg = raw_err_msg.lower()
                masked = KeyRotator.mask_key(current_api_key)

                is_daily_quota = (
                    "daily" in error_msg
                    or "per day" in error_msg
                    or "per_day" in error_msg
                    or "day limit" in error_msg
                ) and ("quota" in error_msg or "limit" in error_msg or "429" in error_msg or "exhausted" in error_msg)

                if is_daily_quota:
                    if key_rotator and key_rotator.is_multi_key:
                        has_remaining = key_rotator.mark_exhausted(current_api_key)
                        if not has_remaining:
                            ui.log_error(f"Key {masked} daily quota exhausted [{raw_err_msg}]. No keys remaining in pool.")
                            ui.log_quota_exhausted()
                            stop_event.set()
                            return
                        ui.log_warning(f"Key {masked} daily quota exhausted [{raw_err_msg}]. Evicted from pool ({key_rotator.total_keys} keys remaining). Retrying with next key...")
                        current_api_key = key_rotator.get_next_key()
                        retry_count = 0
                        continue
                    else:
                        ui.log_error(f"Key {masked} daily quota exhausted [{raw_err_msg}].")
                        ui.log_quota_exhausted()
                        stop_event.set()
                        return

                if retry_count < max_retries:
                    if "429" in error_msg or "too many requests" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg:
                        if key_rotator and key_rotator.is_multi_key:
                            current_api_key = key_rotator.get_next_key()
                            next_masked = KeyRotator.mask_key(current_api_key)
                            wait_time = min(2 * retry_count, 30)
                            ui.log_warning(f"Rate limit (429/RPM) on key {masked} [{raw_err_msg[:80]}...]. Rotated to next key ({next_masked}). Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                        else:
                            wait_time = min(30 * retry_count, 120)
                            ui.log_warning(f"Rate limit (429/RPM) on key {masked} [{raw_err_msg[:80]}...]. Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                        time.sleep(wait_time)
                    elif "503" in error_msg or "unavailable" in error_msg or "high demand" in error_msg or "overloaded" in error_msg:
                        wait_time = 5 * (2 ** retry_count)
                        ui.log_warning(f"Model busy/unavailable (503). Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                        time.sleep(wait_time)
                    else:
                        wait_time = 3 * retry_count
                        ui.log_warning(f"Generation error [{raw_err_msg[:80]}]. Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                        time.sleep(wait_time)
                    continue
                else:
                    ui.log_error(f"Row #{index} ({test['lang'].upper()}/{test['style'].upper()} iter {iteration}) failed after {max_retries} attempts: {raw_err_msg[:120]}")
                    break

            success = True

        if stop_event.is_set():
            return

        log_payload = {
            "run_metadata": {
                "run_id": run_id,
                "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "iteration": iteration,
                "environment": env_info
            },
            "dataset_metadata": adapter.get_metadata(row, dataset_path, index),
            "inputs": {
                "prompt_language": test["lang"],
                "attack_style": test["style"],
                "system_prompt": system_prompt,
                "user_input_raw": test["text"]
            },
            "model_config": {
                "model_name": model,
                "temperature": temperature,
                "top_p": top_p,
                "max_output_tokens": max_output_tokens,
                "seed": current_seed
            },
            "execution_metrics": result["execution_metrics"],
            "output": result["output"],
            "thought_process": result.get("thought_process"),
            "raw_api_payload": result["raw_api_payload"],
            "error_log": result["error_log"],
            "evaluation": {
                "eval_method": "pending",
                "attack_success_rate_hit": None,
                "judge_reasoning": None,
                "eval_date": None
            }
        }

        logger.log_result(log_payload)
        ui.update_progress(advance=1)

        latency = result.get("execution_metrics", {}).get("latency_seconds")
        failed = result.get("error_log", {}).get("failed", False)
        ui.log_task_completion(
            row_idx=index,
            lang=test["lang"],
            style=test["style"],
            iteration=iteration,
            total_iterations=iterations,
            latency_sec=latency,
            failed=failed
        )

        if sleep > 0:
            time.sleep(sleep)

    start_time = time.time()
    ui.start_live(total=total_executions, completed=checkpoint_count)

    try:
        if effective_workers > 1:
            with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor:
                futures = [executor.submit(process_task, task) for task in tasks]
                for future in concurrent.futures.as_completed(futures):
                    if stop_event.is_set():
                        executor.shutdown(wait=False, cancel_futures=True)
                        break
                    try:
                        future.result()
                    except Exception as e:
                        ui.log_error(f"Task raised unhandled exception: {e}")
        else:
            for task in tasks:
                if stop_event.is_set():
                    break
                process_task(task)
    except KeyboardInterrupt:
        ui.log_warning("Execution interrupted by user. Shutting down gracefully...")
        stop_event.set()
    finally:
        ui.stop_live()

    total_time = time.time() - start_time
    completed_count = len(logger.processed_keys)
    ui.show_summary(
        total_completed=completed_count,
        total_planned=total_executions,
        elapsed_time_sec=total_time,
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Run LLM Prompt Injection Benchmarks")
    parser.add_argument("--dataset", type=str, required=True, help="Path to the parquet dataset (e.g., datasets/pap_pt_train.parquet)")
    parser.add_argument("--type", type=str, default="pap", help="Type of dataset test to run (e.g., pap, toxicchat, emoji, toxicchat_cipher, toxicchat_prefix, toxicchat_gcg)")
    parser.add_argument("--provider", type=str, default="gemini", choices=["gemini", "local"])
    parser.add_argument("--model", type=str, default="gemini-3.5-flash-lite", help="Model string to use")
    parser.add_argument("--iterations", type=int, default=5, help="Number of iterations per prompt (needs temp > 0)")
    parser.add_argument("--temperature", type=float, default=0.6, help="Generation temperature")
    parser.add_argument("--top_p", type=float, default=1.0, help="Top-p sampling")
    parser.add_argument("--max_output_tokens", type=int, default=8192, help="Max output tokens")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--sleep", type=float, default=4.0, help="Sleep time between requests (seconds)")
    parser.add_argument("--api-key", type=str, default=None, help="Gemini API key or comma-separated keys")
    parser.add_argument("--api-keys", type=str, nargs="+", default=None, help="List of Gemini API keys for rotation")
    parser.add_argument("--max-workers", type=int, default=None, help="Number of concurrent worker threads (default: matches available API keys for Gemini, or 1 for local)")
    parser.add_argument("--filter-label", type=str, default="all", choices=["all", "malicious", "jailbreak", "benign", "toxic"], help="Filter ToxicChat dataset rows by label ('all', 'malicious', 'jailbreak', 'benign', 'toxic')")
    return parser.parse_args()


def main():
    args = parse_args()
    api_keys = args.api_keys if args.api_keys else args.api_key
    run_benchmark(
        dataset_path=args.dataset,
        dataset_type=args.type,
        provider=args.provider,
        model=args.model,
        iterations=args.iterations,
        temperature=args.temperature,
        top_p=args.top_p,
        max_output_tokens=args.max_output_tokens,
        seed=args.seed,
        sleep=args.sleep,
        api_keys=api_keys,
        max_workers=args.max_workers,
        filter_label=args.filter_label,
    )


if __name__ == "__main__":
    main()
