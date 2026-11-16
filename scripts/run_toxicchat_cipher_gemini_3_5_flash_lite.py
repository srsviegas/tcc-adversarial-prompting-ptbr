import sys
import json
import argparse
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_cipher_benchmark_with_probe, run_generation_subprocess_then_evaluate

CIPHER_CHOICES = {
    "base64": "toxicchat_base64",
    "b64": "toxicchat_base64",
    "toxicchat_base64": "toxicchat_base64",
    "rot13": "toxicchat_rot13",
    "rot-13": "toxicchat_rot13",
    "toxicchat_rot13": "toxicchat_rot13",
    "hex": "toxicchat_hex",
    "hexadecimal": "toxicchat_hex",
    "toxicchat_hex": "toxicchat_hex",
    "caesar": "toxicchat_caesar",
    "cesar": "toxicchat_caesar",
    "toxicchat_caesar": "toxicchat_caesar",
    "toxicchat_cesar": "toxicchat_caesar",
    "leetspeak": "toxicchat_leetspeak",
    "leet": "toxicchat_leetspeak",
    "leetcode": "toxicchat_leetspeak",
    "1337": "toxicchat_leetspeak",
    "toxicchat_leetspeak": "toxicchat_leetspeak",
    "all": "toxicchat_cipher",
    "cipher": "toxicchat_cipher",
    "toxicchat_cipher": "toxicchat_cipher",
}

FILTER_LABELS = {"all", "malicious", "jailbreak", "benign", "toxic"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run ToxicChat Cipher Benchmark on Gemini 3.5 Flash Lite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available cipher sub-techniques:
  all         Run all 5 ciphers sequentially (default)
  base64      Base64 encoding (alias: b64)
  rot13       ROT13 letter substitution (alias: rot-13)
  hex         Hexadecimal UTF-8 representation (alias: hexadecimal)
  caesar      Caesar cipher shift-3 (alias: cesar)
  leetspeak   Leet character substitution (alias: leetcode, leet, 1337)

Examples:
  python scripts/run_toxicchat_cipher_gemini_3_5_flash_lite.py leetcode
  python scripts/run_toxicchat_cipher_gemini_3_5_flash_lite.py base64
  python scripts/run_toxicchat_cipher_gemini_3_5_flash_lite.py --cipher rot13 --filter malicious
        """
    )
    parser.add_argument(
        "arg1",
        nargs="?",
        default=None,
        help="Cipher sub-technique or filter label (e.g., 'leetspeak', 'base64', 'rot13', 'all', 'malicious')"
    )
    parser.add_argument(
        "arg2",
        nargs="?",
        default=None,
        help="Second positional argument (cipher technique or filter label)"
    )
    parser.add_argument(
        "--cipher", "--sub", "--technique", "-c",
        dest="cipher",
        default=None,
        help="Cipher sub-technique: base64, rot13, hex, caesar, leetspeak/leetcode, or all"
    )
    parser.add_argument(
        "--filter", "--filter-label", "-f",
        dest="filter_label",
        default=None,
        choices=["all", "malicious", "jailbreak", "benign", "toxic"],
        help="Filter ToxicChat dataset rows by label ('all', 'malicious', 'jailbreak', 'benign', 'toxic')"
    )
    parser.add_argument(
        "--iterations", "-i",
        type=int,
        default=1,
        help="Number of iterations per prompt (default: 1)"
    )
    parser.add_argument(
        "--max-workers", "-w",
        type=int,
        default=None,
        help="Max concurrent worker threads (default: auto)"
    )
    parser.add_argument(
        "--eval-aegis",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Automatically run Aegis evaluation on output log after completion (default: False)"
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
    parser.add_argument(
        "--probe-rows",
        type=int,
        default=10,
        help="Number of dataset rows per cipher for the convergence probe (~2 interactions per row, default: 10 = 20 interactions)"
    )
    parser.add_argument(
        "--min-success-rate",
        type=float,
        default=0.5,
        help="Minimum decode success rate (0.0-1.0) required in the probe to run the full cipher (default: 0.5)"
    )
    parser.add_argument(
        "--skip-probe",
        action="store_true",
        default=False,
        help="Skip the convergence probe and run all selected ciphers directly"
    )
    parser.add_argument(
        "--skip-eval",
        action="store_true",
        default=False,
        help="Skip automatic evaluation after generation completes"
    )
    parser.add_argument("--generate-only", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--log-manifest", type=str, default=None, help=argparse.SUPPRESS)
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.generate_only and not args.skip_eval:
        run_generation_subprocess_then_evaluate(__file__, sys.argv[1:])
        return

    dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "toxicchat_pt_train.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

    cipher = args.cipher
    filter_label = args.filter_label
    is_test = False

    for pos in [args.arg1, args.arg2]:
        if not pos:
            continue
        p_lower = pos.lower().strip()
        if p_lower in ("test", "--test"):
            is_test = True
        elif p_lower in CIPHER_CHOICES and cipher is None:
            cipher = CIPHER_CHOICES[p_lower]
        elif p_lower in FILTER_LABELS and filter_label is None:
            filter_label = p_lower
        elif cipher is None:
            cipher = CIPHER_CHOICES.get(p_lower, p_lower)
        elif filter_label is None:
            filter_label = p_lower

    final_cipher = CIPHER_CHOICES.get(str(cipher).lower().strip(), "toxicchat_cipher") if cipher else "toxicchat_cipher"
    final_filter = filter_label if filter_label else "malicious"
    max_rows = 10 if (args.test or is_test) else args.max_rows

    test_info = f" | Test Mode: first {max_rows} rows per type" if max_rows else ""
    print(f"[*] Running ToxicChat Cipher Benchmark | Sub-technique: {final_cipher} | Filter: {final_filter}{test_info}")

    log_files = run_cipher_benchmark_with_probe(
        dataset_path=str(dataset_path),
        dataset_type=final_cipher,
        provider="gemini",
        model="gemini-3.5-flash-lite",
        iterations=args.iterations,
        temperature=0.6,
        top_p=1.0,
        max_output_tokens=8192,
        sleep=0.0,
        max_workers=args.max_workers,
        filter_label=final_filter,
        eval_aegis=args.eval_aegis,
        max_rows=max_rows,
        probe_rows=args.probe_rows,
        min_success_rate=args.min_success_rate,
        skip_probe=args.skip_probe,
    )
    if args.log_manifest:
        Path(args.log_manifest).write_text(json.dumps(log_files), encoding="utf-8")


if __name__ == "__main__":
    main()
