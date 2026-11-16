import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark

EVALUATORS = [
    "aegis_llamaguard",
    "qwen_judge",
    "gemma_judge",
]


def run_generation(filter_label: str, iterations: int) -> list[str]:
    dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "toxicchat_pt_train.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

    model_path = project_root / "models" / "gemma-4-12B-it-Q4_K_M.gguf"

    log_files = run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type="toxicchat_prefix",
        provider="gemma4",
        model=str(model_path),
        iterations=iterations,
        temperature=0.6,
        top_p=0.95,
        max_output_tokens=8192,
        sleep=0.0,
        filter_label=filter_label,
    )
    return log_files or []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run ToxicChat Prefix generation with Gemma 4 12B and evaluate with all 3 evaluators."
    )
    parser.add_argument(
        "filter_label",
        nargs="?",
        default="malicious",
        help="Filter ToxicChat dataset rows by label (default: malicious).",
    )
    parser.add_argument(
        "iterations",
        nargs="?",
        type=int,
        default=3,
        help="Number of iterations per prompt (default: 3).",
    )
    parser.add_argument("--generate-only", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--log-manifest", type=str, default=None, help=argparse.SUPPRESS)
    return parser.parse_args()


def main():
    args = parse_args()

    if args.generate_only:
        log_files = run_generation(args.filter_label, args.iterations)
        if args.log_manifest:
            Path(args.log_manifest).write_text(json.dumps(log_files), encoding="utf-8")
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
        manifest_path = Path(tmp.name)

    try:
        print(f"\n=== [1/4] Generation: Gemma 4 12B (toxicchat_prefix, filter={args.filter_label}, iterations={args.iterations}) ===")
        subprocess.run(
            [
                sys.executable,
                __file__,
                args.filter_label,
                str(args.iterations),
                "--generate-only",
                "--log-manifest",
                str(manifest_path),
            ],
            check=True,
        )
        log_files = json.loads(manifest_path.read_text(encoding="utf-8"))
    finally:
        manifest_path.unlink(missing_ok=True)

    if not log_files:
        print("[ERROR] Generation did not produce any log files.")
        sys.exit(1)

    evaluate_log_script = project_root / "scripts" / "evaluate_log.py"
    total_steps = 1 + len(EVALUATORS)

    for idx, evaluator in enumerate(EVALUATORS, start=2):
        for log_file in log_files:
            print(f"\n=== [{idx}/{total_steps}] Evaluation ({evaluator}): {log_file} ===")
            subprocess.run(
                [
                    sys.executable,
                    str(evaluate_log_script),
                    log_file,
                    "--evaluator",
                    evaluator,
                ],
                check=True,
            )

    print("\n=== All 4 stages (generation + 3 evaluations) completed successfully! ===")


if __name__ == "__main__":
    main()
