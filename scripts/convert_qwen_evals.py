import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeRemainingColumn
from rich.table import Table

from src.evaluators.sidecar import extract_judge_sidecar, generate_record_key

console = Console()


def resolve_input_dirs(input_dir_arg: Optional[str]) -> List[Path]:
    """Finds existing directories containing Qwen Judge evaluations."""
    candidate_dirs: List[Path] = []

    if input_dir_arg:
        custom_path = Path(input_dir_arg)
        if custom_path.is_dir():
            candidate_dirs.append(custom_path.resolve())
        elif (project_root / input_dir_arg).is_dir():
            candidate_dirs.append((project_root / input_dir_arg).resolve())
        else:
            console.print(f"[bold red]Specified input directory not found: '{input_dir_arg}'[/bold red]")
            sys.exit(1)
        return candidate_dirs

    # Default discovery priority
    possible_eval_dirs = [
        project_root / "logs" / "evaluated",
        project_root / "evaluation",
        project_root / "logs" / "evaluation",
    ]
    for d in possible_eval_dirs:
        if d.is_dir():
            candidate_dirs.append(d.resolve())
            break

    return candidate_dirs


def convert_file(
    source_file: Path,
    output_file: Path,
    target_evaluator: str = "qwen_judge",
) -> Optional[Dict[str, Any]]:
    """
    Parses a full benchmark JSONL log and extracts lightweight Qwen Judge records.
    Deduplicates by record_key (preferring successful evaluations).
    """
    records_by_key: Dict[str, dict] = {}
    total_lines = 0

    try:
        with open(source_file, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line_str = line.strip()
                if not line_str:
                    continue
                total_lines += 1
                try:
                    record = json.loads(line_str)
                except json.JSONDecodeError:
                    continue

                sidecar = extract_judge_sidecar(record, idx, target_evaluator=target_evaluator)
                if sidecar is None:
                    continue

                rkey = sidecar["record_key"]
                if rkey in records_by_key:
                    existing = records_by_key[rkey]
                    # Prefer successful evaluation over failed/error one
                    if existing.get("status") != "success" and sidecar.get("status") == "success":
                        records_by_key[rkey] = sidecar
                    elif existing.get("status") == "success" and sidecar.get("status") != "success":
                        pass  # Keep existing successful one
                    else:
                        records_by_key[rkey] = sidecar  # Update with latest
                else:
                    records_by_key[rkey] = sidecar

    except Exception as e:
        console.print(f"[red]Error reading {source_file.name}: {e}[/red]")
        return None

    if not records_by_key:
        return None

    # Write lightweight sidecar records
    output_file.parent.mkdir(parents=True, exist_ok=True)
    stats = {
        "total_source": total_lines,
        "valid": 0,
        "flagged": 0,
        "safe": 0,
        "error": 0,
        "scores": [],
    }

    with open(output_file, "w", encoding="utf-8") as out_f:
        for sidecar in records_by_key.values():
            out_f.write(json.dumps(sidecar, ensure_ascii=False) + "\n")
            stats["valid"] += 1
            if sidecar.get("status") == "error":
                stats["error"] += 1
            elif sidecar.get("flagged") is True:
                stats["flagged"] += 1
            elif sidecar.get("flagged") is False:
                stats["safe"] += 1

            sc = sidecar.get("score")
            if sc is not None and isinstance(sc, (int, float)):
                stats["scores"].append(sc)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Extracts lightweight Qwen Judge sidecar evaluations into evaluations/qwen_judge/."
    )
    parser.add_argument(
        "--input-dir",
        "-i",
        type=str,
        default=None,
        help="Input directory (defaults to checking logs/evaluated or evaluation).",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=str,
        default="evaluations/qwen_judge",
        help="Output directory for lightweight Qwen Judge evaluations (default: 'evaluations/qwen_judge').",
    )
    parser.add_argument(
        "--evaluator",
        type=str,
        default="qwen_judge",
        help="Evaluator identifier name to extract (default: 'qwen_judge').",
    )
    args = parser.parse_args()

    input_dirs = resolve_input_dirs(args.input_dir)
    if not input_dirs:
        console.print("[bold red]No evaluation directories found to parse![/bold red]")
        sys.exit(1)

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = project_root / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    console.print(
        Panel(
            f"[bold cyan]Qwen Judge Sidecar Converter[/bold cyan]\n"
            f"Input Directories : {', '.join(str(d.relative_to(project_root)) for d in input_dirs)}\n"
            f"Output Directory  : {output_dir.relative_to(project_root)}\n"
            f"Target Evaluator  : {args.evaluator}",
            expand=False,
        )
    )

    all_files: Dict[str, Path] = {}
    for d in input_dirs:
        for file_path in d.glob("*.jsonl"):
            all_files[file_path.name] = file_path

    if not all_files:
        console.print("[yellow]No .jsonl files found in input directories.[/yellow]")
        return

    summary_table = Table(title="Qwen Judge Conversion Results", show_lines=True)
    summary_table.add_column("Log Filename", style="cyan")
    summary_table.add_column("Extracted", justify="right", style="green")
    summary_table.add_column("Dangerous / Flagged", justify="right", style="red")
    summary_table.add_column("Safe", justify="right", style="blue")
    summary_table.add_column("Avg Score", justify="right", style="magenta")
    summary_table.add_column("Errors", justify="right", style="yellow")
    summary_table.add_column("Output File", style="dim")

    total_extracted = 0
    total_flagged = 0
    total_safe = 0
    total_errors = 0
    all_scores: List[float] = []
    converted_files_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Converting Qwen Judge evals...", total=len(all_files))

        for filename, source_path in all_files.items():
            progress.update(task, description=f"Converting {filename[:40]}...")
            target_out = output_dir / filename
            stats = convert_file(source_path, target_out, target_evaluator=args.evaluator)

            if stats and stats["valid"] > 0:
                converted_files_count += 1
                total_extracted += stats["valid"]
                total_flagged += stats["flagged"]
                total_safe += stats["safe"]
                total_errors += stats["error"]
                all_scores.extend(stats["scores"])

                flagged_pct = (stats["flagged"] / stats["valid"] * 100) if stats["valid"] > 0 else 0
                avg_sc = sum(stats["scores"]) / len(stats["scores"]) if stats["scores"] else 0.0

                summary_table.add_row(
                    filename,
                    str(stats["valid"]),
                    f"{stats['flagged']} ({flagged_pct:.1f}%)",
                    str(stats["safe"]),
                    f"{avg_sc:.2f}" if avg_sc > 0 else "-",
                    str(stats["error"]),
                    str(target_out.name),
                )

            progress.advance(task)

    console.print("\n")
    if converted_files_count > 0:
        console.print(summary_table)
        global_avg = sum(all_scores) / len(all_scores) if all_scores else 0.0
        console.print(
            Panel(
                f"[bold green]Conversion Finished Successfully![/bold green]\n"
                f"Files converted: [bold]{converted_files_count}[/bold]\n"
                f"Total evaluations: [bold]{total_extracted}[/bold]\n"
                f"Flagged Dangerous (Score 4-5): [bold red]{total_flagged}[/bold red] ({total_flagged/max(1, total_extracted)*100:.1f}%)\n"
                f"Safe: [bold blue]{total_safe}[/bold blue]\n"
                f"Global Average Score: [bold magenta]{global_avg:.2f} / 5.0[/bold magenta]\n"
                f"Output: [bold]{output_dir}[/bold]",
                expand=False,
            )
        )
    else:
        console.print("[yellow]No Qwen Judge evaluations were found in the scanned files.[/yellow]")


if __name__ == "__main__":
    main()
