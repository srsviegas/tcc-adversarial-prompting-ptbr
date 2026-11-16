import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.evaluators.sidecar import generate_record_key

DEFAULT_LOG = project_root / "logs" / "gemini_gemini-3.5-flash-lite_toxicchat_prefix_eval.jsonl"


def is_malicious(record: dict) -> bool:
    """Returns True if the record is malicious (toxicity == 1 or jailbreaking == 1)."""
    meta = record.get("dataset_metadata", {})
    toxicity = meta.get("toxicity", 0)
    jailbreaking = meta.get("jailbreaking", 0)
    malicious = meta.get("malicious", 0)
    return bool(toxicity == 1 or jailbreaking == 1 or malicious == 1)


def atomic_write_lines(target: Path, lines: list[str], backup: bool = True) -> None:
    if backup and target.exists():
        backup_path = target.with_suffix(target.suffix + ".bak")
        shutil.copy2(target, backup_path)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=target.parent,
        delete=False,
        suffix=".tmp",
    ) as tmp:
        tmp_path = Path(tmp.name)
        for line in lines:
            tmp.write(line if line.endswith("\n") else line + "\n")

    tmp_path.replace(target)


def filter_log_file(log_path: Path, dry_run: bool = False, backup: bool = True) -> set[str]:
    kept_lines: list[str] = []
    kept_keys: set[str] = set()
    total = 0
    removed = 0

    with log_path.open("r", encoding="utf-8") as f:
        for idx, raw_line in enumerate(f):
            stripped = raw_line.strip()
            if not stripped:
                continue
            total += 1
            record = json.loads(stripped)
            if is_malicious(record):
                kept_lines.append(stripped)
                kept_keys.add(generate_record_key(record, idx))
            else:
                removed += 1

    print(f"[Log] {log_path.name}: total={total}, kept(malicious)={len(kept_lines)}, removed(benign)={removed}")

    if not dry_run:
        atomic_write_lines(log_path, kept_lines, backup=backup)
        print(f"  -> Updated {log_path}")

    return kept_keys


def filter_sidecars(log_filename: str, kept_keys: set[str], dry_run: bool = False, backup: bool = True) -> None:
    evaluations_dir = project_root / "evaluations"
    if not evaluations_dir.is_dir():
        return

    for subdir in sorted(evaluations_dir.iterdir()):
        if not subdir.is_dir():
            continue
        sidecar_path = subdir / log_filename
        if not sidecar_path.is_file():
            continue

        kept_lines: list[str] = []
        total = 0
        removed = 0

        with sidecar_path.open("r", encoding="utf-8") as f:
            for raw_line in f:
                stripped = raw_line.strip()
                if not stripped:
                    continue
                total += 1
                record = json.loads(stripped)
                key = record.get("record_key")
                if key in kept_keys:
                    if "line_idx" in record:
                        record["line_idx"] = len(kept_lines)
                    kept_lines.append(json.dumps(record, ensure_ascii=False))
                else:
                    removed += 1

        print(f"[Sidecar: {subdir.name}] {sidecar_path.name}: total={total}, kept={len(kept_lines)}, removed={removed}")

        if not dry_run:
            atomic_write_lines(sidecar_path, kept_lines, backup=backup)
            print(f"  -> Updated {sidecar_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove malicious=0 (benign) rows from a generation log (and optionally its evaluation sidecars)."
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=DEFAULT_LOG,
        help=f"Path to the JSONL generation log (default: {DEFAULT_LOG}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show how many rows would be kept/removed without modifying files.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not create .bak backup files before overwriting.",
    )
    parser.add_argument(
        "--no-clean-evaluations",
        action="store_true",
        help="Do not filter matching sidecar files under evaluations/.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_path = args.log if args.log.is_absolute() else (project_root / args.log)

    if not log_path.is_file():
        print(f"[ERROR] Log file not found: {log_path}")
        sys.exit(1)

    backup = not args.no_backup
    kept_keys = filter_log_file(log_path, dry_run=args.dry_run, backup=backup)

    if not args.no_clean_evaluations:
        filter_sidecars(log_path.name, kept_keys, dry_run=args.dry_run, backup=backup)

    if args.dry_run:
        print("\nDry run complete. No files were modified.")
    else:
        print("\nDone! Files filtered to keep only malicious rows.")


if __name__ == "__main__":
    main()
