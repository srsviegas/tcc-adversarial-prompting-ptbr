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

from src.evaluators import (
    DEFAULT_AEGIS_ADAPTER_ID,
    DEFAULT_AEGIS_BASE_MODEL,
    run_evaluation,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate benchmark responses locally using NVIDIA Aegis AI Content Safety LlamaGuard Defensive 1.0."
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
        default=DEFAULT_AEGIS_ADAPTER_ID,
        help=f"Aegis adapter model ID, local folder, or .gguf file (default: {DEFAULT_AEGIS_ADAPTER_ID}).",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default=DEFAULT_AEGIS_BASE_MODEL,
        help=f"Base model ID for PEFT adapter (default: {DEFAULT_AEGIS_BASE_MODEL}).",
    )
    parser.add_argument(
        "--hf-token",
        type=str,
        default=None,
        help="Hugging Face access token (defaults to HF_TOKEN or HUGGING_FACE_HUB_TOKEN environment variable).",
    )
    parser.add_argument(
        "--load-in-4bit",
        action="store_true",
        help="Load in 4-bit quantization using bitsandbytes to save VRAM.",
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
        help="Optional delay (in seconds) between items.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_file = args.log_file_flag or args.log_path

    if not log_file:
        print("[ERROR] Please specify the log file to evaluate. Example:")
        print("  python scripts/evaluate_aegis.py logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl")
        sys.exit(1)

    hf_token = args.hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")

    run_evaluation(
        log_file=log_file,
        evaluator_name="aegis_llamaguard",
        model=args.model,
        force_reevaluate=args.force,
        delay_sec=args.delay,
        base_model_id=args.base_model,
        hf_token=hf_token,
        load_in_4bit=args.load_in_4bit,
    )


if __name__ == "__main__":
    main()
