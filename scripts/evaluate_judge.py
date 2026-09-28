import argparse
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from src.evaluators import DEFAULT_QWEN_JUDGE_MODEL_PATH, run_evaluation


def parse_args():
    parser = argparse.ArgumentParser(
        description="LLM-as-a-Judge response evaluator using Qwen 2.5 32B Abliterated with Grammar-Constrained Decoding."
    )
    parser.add_argument(
        "log_path",
        nargs="?",
        default=None,
        help="Path or filename of the JSONL log to evaluate (e.g., logs/gemini_gemini-3.5-flash-lite_pap_eval.jsonl).",
    )
    parser.add_argument(
        "--log",
        "--log-file",
        dest="log_file_flag",
        type=str,
        default=None,
        help="Alternative flag to specify the log file path.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_QWEN_JUDGE_MODEL_PATH,
        help=f"Path or alias of the Qwen 32B GGUF model (default: {DEFAULT_QWEN_JUDGE_MODEL_PATH}).",
    )
    parser.add_argument(
        "--n-ctx",
        type=int,
        default=8192,
        help="Context window size for judge model (default: 8192).",
    )
    parser.add_argument(
        "--n-gpu-layers",
        type=int,
        default=None,
        help="Number of GPU layers to offload (-1 for all layers).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature for judge generation (default: 0.0 for deterministic evaluation).",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=1024,
        help="Max output tokens for the structured judge evaluation (default: 1024).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-evaluation of all rows even if already evaluated in the checkpoint.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Optional delay (in seconds) between requests.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_file = args.log_file_flag or args.log_path

    if not log_file:
        print("[ERROR] Please specify the log file to evaluate. Example:")
        print("  python scripts/evaluate_judge.py logs/gemini_gemini-3.5-flash-lite_pap_eval.jsonl")
        sys.exit(1)

    run_evaluation(
        log_file=log_file,
        evaluator_name="qwen_judge",
        model=args.model,
        force_reevaluate=args.force,
        delay_sec=args.delay,
        n_ctx=args.n_ctx,
        n_gpu_layers=args.n_gpu_layers,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )


if __name__ == "__main__":
    main()
