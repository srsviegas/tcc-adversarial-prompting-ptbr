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
        description="Evaluate benchmark responses using the OpenAI Moderation API (omni-moderation-latest)."
    )
    parser.add_argument(
        "log_path",
        nargs="?",
        default=None,
        help="Path or filename of the JSONL log to evaluate (e.g., logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl).",
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
        default=DEFAULT_MODERATION_MODEL,
        help=f"Moderation model to use (default: {DEFAULT_MODERATION_MODEL}).",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="OpenAI API key (defaults to OPENAI_API_KEY environment variable).",
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
        print("  python scripts/evaluate_moderation.py logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl")
        sys.exit(1)

    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[WARNING] OPENAI_API_KEY is not set in environment or passed via --api-key.")
        print("          If making actual API calls, set it via: export OPENAI_API_KEY=\"your-key\"")

    run_evaluation(
        log_file=log_file,
        evaluator_name="openai_moderation",
        model=args.model,
        api_key=api_key,
        force_reevaluate=args.force,
        delay_sec=args.delay,
    )


if __name__ == "__main__":
    main()
