import os
import sys
import time
import argparse
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

    framework = "google-genai" if provider == "gemini" else "transformers"

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
    api_keys: Optional[Union[str, List[str]]] = None
):
    ui = BenchmarkUI()
    run_id = f"{dataset_type}_eval_{model}_{provider}_v1"
    env_info = get_environment_info(provider)

    key_rotator = None
    if provider == "gemini":
        key_rotator = KeyRotator(keys=api_keys or api_key)
        if key_rotator.total_keys == 0:
            ui.log_error("Neither GEMINI_API_KEYS nor GEMINI_API_KEY environment variable is set.")
            sys.exit(1)

    df = pd.read_parquet(dataset_path)
    adapter = get_adapter(dataset_type)
    df = adapter.format_data(df)

    log_filename = f"{provider}_{model}_{dataset_type}_eval.jsonl".replace("/", "_")
    logger = BenchmarkLogger(log_filename)

    # Compute total planned executions
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
    )

    if provider == "gemini" and key_rotator and key_rotator.is_multi_key:
        ui.log_info(f"Initialized API key pool with {key_rotator.total_keys} keys (round-robin rotation enabled).")

    start_time = time.time()
    completed_count = checkpoint_count

    ui.start_live(total=total_executions, completed=checkpoint_count)
    try:
        for index, row in df.iterrows():
            tests = adapter.get_tests(row)

            for test in tests:
                for iteration in range(1, iterations + 1):
                    if logger.is_already_processed(index, model, test["lang"], test["style"], iteration):
                        continue

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
                            error_msg = str(result["error_log"]["error_message"]).lower()

                            # Fatal quota exhaustion for current key
                            if "quota" in error_msg and ("exhausted" in error_msg or "daily" in error_msg):
                                if key_rotator and key_rotator.is_multi_key:
                                    masked = KeyRotator.mask_key(current_api_key)
                                    has_remaining = key_rotator.mark_exhausted(current_api_key)
                                    if not has_remaining:
                                        ui.log_quota_exhausted()
                                        sys.exit(0)
                                    ui.log_warning(f"Key {masked} daily quota exhausted. Evicted from pool ({key_rotator.total_keys} keys remaining). Retrying with next key...")
                                    current_api_key = key_rotator.get_next_key()
                                    retry_count = 0
                                    continue
                                else:
                                    ui.log_quota_exhausted()
                                    sys.exit(0)

                            if retry_count < max_retries:
                                if "429" in error_msg or "too many requests" in error_msg:
                                    if key_rotator and key_rotator.is_multi_key:
                                        current_api_key = key_rotator.get_next_key()
                                        wait_time = min(2 * retry_count, 30)
                                        ui.log_warning(f"Rate limit (429). Rotated to next key. Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                                    else:
                                        wait_time = min(30 * retry_count, 120)
                                        ui.log_warning(f"Rate limit (429). Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                                    time.sleep(wait_time)
                                elif "503" in error_msg or "unavailable" in error_msg or "high demand" in error_msg or "overloaded" in error_msg:
                                    wait_time = 5 * (2 ** retry_count)
                                    ui.log_warning(f"Model busy/unavailable (503). Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                                    time.sleep(wait_time)
                                else:
                                    wait_time = 3 * retry_count
                                    ui.log_warning(f"Generation error ({error_msg[:60]}). Retrying in {wait_time}s... (Attempt {retry_count}/{max_retries})")
                                    time.sleep(wait_time)
                                continue
                            else:
                                ui.log_error(f"Row #{index} ({test['lang'].upper()}/{test['style'].upper()} iter {iteration}) failed after {max_retries} attempts: {error_msg[:100]}")
                                break

                        success = True

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
                    completed_count += 1
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
    finally:
        ui.stop_live()

    total_time = time.time() - start_time
    ui.show_summary(
        total_completed=completed_count,
        total_planned=total_executions,
        elapsed_time_sec=total_time,
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Run LLM Prompt Injection Benchmarks")
    parser.add_argument("--dataset", type=str, required=True, help="Path to the parquet dataset (e.g., datasets/pap_pt_train.parquet)")
    parser.add_argument("--type", type=str, default="pap", help="Type of dataset test to run (e.g., pap, toxicchat)")
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
        api_keys=api_keys
    )


if __name__ == "__main__":
    main()
