import sys
import argparse
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark

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
        description="Run ToxicChat Cipher Benchmark on DeepSeek-R1 Distill Qwen 14B",
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
  python scripts/run_toxicchat_cipher_deepseek_r1_14b.py leetcode
  python scripts/run_toxicchat_cipher_deepseek_r1_14b.py base64
  python scripts/run_toxicchat_cipher_deepseek_r1_14b.py --cipher rot13 --filter malicious
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
    return parser.parse_args()


def main():
    args = parse_args()

    dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "toxicchat_pt_train.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

    model_path = project_root / "models" / "DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf"

    cipher = args.cipher
    filter_label = args.filter_label

    for pos in [args.arg1, args.arg2]:
        if not pos:
            continue
        p_lower = pos.lower().strip()
        if p_lower in CIPHER_CHOICES and cipher is None:
            cipher = CIPHER_CHOICES[p_lower]
        elif p_lower in FILTER_LABELS and filter_label is None:
            filter_label = p_lower
        elif cipher is None:
            cipher = CIPHER_CHOICES.get(p_lower, p_lower)
        elif filter_label is None:
            filter_label = p_lower

    final_cipher = CIPHER_CHOICES.get(str(cipher).lower().strip(), "toxicchat_cipher") if cipher else "toxicchat_cipher"
    final_filter = filter_label if filter_label else "malicious"

    print(f"[*] Running ToxicChat Cipher Benchmark | Sub-technique: {final_cipher} | Filter: {final_filter}")

    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type=final_cipher,
        provider="deepseek",
        model=str(model_path),
        iterations=args.iterations,
        temperature=0.6,
        top_p=0.95,
        max_output_tokens=8192,
        sleep=0.0,
        filter_label=final_filter,
    )


if __name__ == "__main__":
    main()
