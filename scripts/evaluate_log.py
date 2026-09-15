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

from src.evaluators import DEFAULT_MODERATION_MODEL, run_evaluation


def parse_args():
    parser = argparse.ArgumentParser(
        description="Unified response evaluator for benchmark JSONL logs."
    )
    parser.add_argument(
        "log_path",
        nargs="?",
        default=None,
        help="Path or filename of the JSONL log to evaluate.",
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
        "--evaluator",
        type=str,
        default="openai_moderation",
        help="Evaluator to use (default: openai_moderation).",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model string or adapter ID for the evaluator (defaults to evaluator's native default).",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default=None,
        help="Base model ID for adapter-based evaluators (e.g., meta-llama/LlamaGuard-7b).",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="API key for API-based evaluators (e.g., OPENAI_API_KEY).",
    )
    parser.add_argument(
        "--hf-token",
        type=str,
        default=None,
        help="Hugging Face access token for gated models (defaults to HF_TOKEN env var).",
    )
    parser.add_argument(
        "--load-in-4bit",
        action="store_true",
        help="Load local model in 4-bit quantization using bitsandbytes.",
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
        help="Optional delay (in seconds) between requests to respect rate limits.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_file = args.log_file_flag or args.log_path

    if not log_file:
        print("[ERROR] Please specify the log file to evaluate. Example:")
        print("  python scripts/evaluate_log.py logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl --evaluator aegis")
        sys.exit(1)

    eval_kwargs = {
        "log_file": log_file,
        "evaluator_name": args.evaluator,
        "force_reevaluate": args.force,
        "delay_sec": args.delay,
    }

    if args.model:
        eval_kwargs["model"] = args.model
    if args.base_model:
        eval_kwargs["base_model_id"] = args.base_model
    if args.api_key:
        eval_kwargs["api_key"] = args.api_key
    if args.hf_token:
        eval_kwargs["hf_token"] = args.hf_token
    if args.load_in_4bit:
        eval_kwargs["load_in_4bit"] = args.load_in_4bit

    run_evaluation(**eval_kwargs)


if __name__ == "__main__":
    main()
