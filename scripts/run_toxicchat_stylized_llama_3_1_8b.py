import sys
import argparse
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark
from src.adapters.toxicchat_stylized import STYLIZED_REGISTRY

STYLE_CHOICES = {
    "all": "toxicchat_stylized",
    "stylized": "toxicchat_stylized",
    "fancy": "toxicchat_stylized",
    "toxicchat_stylized": "toxicchat_stylized",
    "toxicchat_fancy": "toxicchat_stylized",
}

for style_id, conf in STYLIZED_REGISTRY.items():
    dataset_name = f"toxicchat_stylized_{style_id}"
    STYLE_CHOICES[style_id] = dataset_name
    STYLE_CHOICES[str(conf["index"])] = dataset_name
    STYLE_CHOICES[f"style{conf['index']}"] = dataset_name
    STYLE_CHOICES[dataset_name] = dataset_name
    for alias in conf["aliases"]:
        STYLE_CHOICES[alias] = dataset_name

FILTER_LABELS = {"all", "malicious", "jailbreak", "benign", "toxic"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run ToxicChat Stylized Characters Benchmark on Meta Llama 3.1 8B",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "arg1",
        nargs="?",
        default=None,
        help="Stylized alphabet technique or filter label (e.g., 'bold_script', '2', 'fraktur', 'all', 'malicious')"
    )
    parser.add_argument(
        "arg2",
        nargs="?",
        default=None,
        help="Second positional argument (technique or filter label)"
    )
    parser.add_argument(
        "--style", "--sub", "--technique", "-s",
        dest="style",
        default=None,
        help="Stylized alphabet technique (1-8, fraktur, bold_script, script, etc.)"
    )
    parser.add_argument(
        "--filter", "--filter-label", "-f",
        dest="filter_label",
        default=None,
        choices=["all", "malicious", "jailbreak", "benign", "toxic"],
        help="Filter ToxicChat dataset rows by label"
    )
    parser.add_argument(
        "--iterations", "-i",
        type=int,
        default=1,
        help="Number of iterations per prompt (default: 1)"
    )
    parser.add_argument(
        "--eval-aegis",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Automatically run Aegis evaluation on output log after completion"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        default=False,
        help="Run test mode: only the first 10 rows of every type (default: False)"
    )
    parser.add_argument(
        "--max-rows", "-n",
        type=int,
        default=None,
        help="Maximum number of dataset rows per type (default: all)"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "toxicchat_pt_train.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

    model_path = project_root / "models" / "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

    style = args.style
    filter_label = args.filter_label
    is_test = False

    for pos in [args.arg1, args.arg2]:
        if not pos:
            continue
        p_lower = pos.lower().strip()
        if p_lower in ("test", "--test"):
            is_test = True
        elif p_lower in STYLE_CHOICES and style is None:
            style = STYLE_CHOICES[p_lower]
        elif p_lower in FILTER_LABELS and filter_label is None:
            filter_label = p_lower
        elif style is None:
            style = STYLE_CHOICES.get(p_lower, p_lower)
        elif filter_label is None:
            filter_label = p_lower

    final_style = STYLE_CHOICES.get(str(style).lower().strip(), "toxicchat_stylized") if style else "toxicchat_stylized"
    final_filter = filter_label if filter_label else "malicious"
    max_rows = 10 if (args.test or is_test) else args.max_rows

    test_info = f" | Test Mode: first {max_rows} rows per type" if max_rows else ""
    print(f"[*] Running ToxicChat Stylized Characters Benchmark | Sub-technique: {final_style} | Filter: {final_filter}{test_info}")

    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type=final_style,
        provider="local",
        model=str(model_path),
        iterations=args.iterations,
        temperature=0.6,
        top_p=1.0,
        max_output_tokens=8192,
        sleep=0.0,
        filter_label=final_filter,
        eval_aegis=args.eval_aegis,
        max_rows=max_rows,
    )


if __name__ == "__main__":
    main()
