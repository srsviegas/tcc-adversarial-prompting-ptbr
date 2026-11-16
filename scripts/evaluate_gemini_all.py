import argparse
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import evaluate_logs_with_all_judges

DEFAULT_GEMINI_LOG = project_root / "logs" / "gemini_gemini-3.5-flash-lite_toxicchat_prefix_eval.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate Gemini log(s) with all 3 evaluators (aegis_llamaguard, qwen_judge, gemma_judge)."
    )
    parser.add_argument(
        "logs",
        nargs="*",
        help=f"Path(s) to Gemini JSONL log file(s) (default: {DEFAULT_GEMINI_LOG.name}).",
    )
    parser.add_argument(
        "--all-gemini",
        action="store_true",
        help="Evaluate all logs matching logs/gemini_*.jsonl.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.all_gemini:
        log_paths = sorted((project_root / "logs").glob("gemini_*.jsonl"))
    elif args.logs:
        log_paths = [
            Path(p) if Path(p).is_absolute() else (
                Path(p) if Path(p).is_file() else (project_root / "logs" / Path(p).name)
            )
            for p in args.logs
        ]
    else:
        log_paths = [DEFAULT_GEMINI_LOG]

    missing = [p for p in log_paths if not p.is_file()]
    if missing:
        for p in missing:
            print(f"[ERROR] Log file not found: {p}")
        sys.exit(1)

    if not log_paths:
        print("[WARN] No matching Gemini log files found.")
        sys.exit(0)

    print(f"[*] Evaluating {len(log_paths)} Gemini log(s) with all 3 evaluators:")
    for p in log_paths:
        print(f"    - {p}")

    evaluate_logs_with_all_judges([str(p.resolve()) for p in log_paths])


if __name__ == "__main__":
    main()
