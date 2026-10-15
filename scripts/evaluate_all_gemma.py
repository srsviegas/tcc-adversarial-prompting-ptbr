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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from src.evaluators import (
    DEFAULT_GEMMA_JUDGE_MODEL_PATH,
    resolve_gemma_judge_model_path,
    run_evaluation,
)

console = Console()


def get_file_status(source_path: Path, sidecar_path: Path) -> Dict[str, Any]:
    """
    Checks source log against the evaluations/gemma_judge/ sidecar file.
    Returns total, evaluated, and remaining pending row counts.
    """
    total_source = 0
    try:
        with open(source_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    total_source += 1
    except Exception as e:
        return {
            "source_file": source_path,
            "sidecar_file": sidecar_path,
            "total_rows": 0,
            "evaluated_rows": 0,
            "pending_rows": 0,
            "is_complete": False,
            "error": str(e),
        }

    if total_source == 0:
        return {
            "source_file": source_path,
            "sidecar_file": sidecar_path,
            "total_rows": 0,
            "evaluated_rows": 0,
            "pending_rows": 0,
            "is_complete": True,
            "error": None,
        }

    if not sidecar_path.is_file():
        return {
            "source_file": source_path,
            "sidecar_file": sidecar_path,
            "total_rows": total_source,
            "evaluated_rows": 0,
            "pending_rows": total_source,
            "is_complete": False,
            "error": None,
        }

    evaluated_count = 0
    try:
        with open(sidecar_path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    rec = json.loads(line_str)
                    if rec.get("status") in ("success", "skipped"):
                        evaluated_count += 1
                    elif "evaluations" in rec:
                        # Fallback for legacy format
                        for ev in rec.get("evaluations", []):
                            if ev.get("status") in ("success", "skipped") and "gemma" in str(ev.get("evaluator", "")).lower():
                                evaluated_count += 1
                                break
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        return {
            "source_file": source_path,
            "sidecar_file": sidecar_path,
            "total_rows": total_source,
            "evaluated_rows": 0,
            "pending_rows": total_source,
            "is_complete": False,
            "error": str(e),
        }

    pending = max(0, total_source - evaluated_count)
    return {
        "source_file": source_path,
        "sidecar_file": sidecar_path,
        "total_rows": total_source,
        "evaluated_rows": evaluated_count,
        "pending_rows": pending,
        "is_complete": pending == 0 and total_source > 0,
        "error": None,
    }


def parse_args():
    parser = argparse.ArgumentParser(
        description="Batch Gemma 2 27B Judge evaluator: scans logs/ and evaluates pending rows into evaluations/gemma_judge/."
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_GEMMA_JUDGE_MODEL_PATH,
        help=f"GGUF path or alias for Gemma 27B judge (default: {DEFAULT_GEMMA_JUDGE_MODEL_PATH}).",
    )
    parser.add_argument(
        "--n-ctx",
        type=int,
        default=8192,
        help="Context window size (default: 8192).",
    )
    parser.add_argument(
        "--n-gpu-layers",
        type=int,
        default=None,
        help="GPU layers to offload (-1 for all layers, None for auto-detect).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature (default: 0.0 for deterministic evaluation).",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=1024,
        help="Max output tokens for structured output (default: 1024).",
    )
    parser.add_argument(
        "--dir",
        "--logs-dir",
        dest="logs_dir",
        type=str,
        default="logs",
        help="Directory containing benchmark JSONL log files (default: 'logs').",
    )
    parser.add_argument(
        "--pattern",
        type=str,
        default="*.jsonl",
        help="Glob pattern to match log files in the directory (default: '*.jsonl').",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-evaluation of all rows even if already evaluated in the sidecar checkpoint.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Optional delay (in seconds) between evaluation requests.",
    )
    parser.add_argument(
        "--max-consecutive-errors",
        type=int,
        default=3,
        help="Maximum consecutive errors before aborting a file evaluation (default: 3).",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Maximum number of files with pending rows to evaluate in this run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and display inventory table without executing evaluations.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    logs_dir = Path(args.logs_dir)
    if not logs_dir.is_absolute():
        logs_dir = project_root / logs_dir

    if not logs_dir.is_dir():
        console.print(f"[bold red][ERROR][/bold red] Logs directory not found: {logs_dir}")
        sys.exit(1)

    evaluations_dir = project_root / "evaluations" / "gemma_judge"
    evaluations_dir.mkdir(parents=True, exist_ok=True)

    all_files = sorted([
        f for f in logs_dir.glob(args.pattern)
        if f.is_file() and not f.name.startswith("_test_")
    ])

    if not all_files:
        console.print(f"[yellow]No log files found in '{logs_dir}' matching pattern '{args.pattern}'.[/yellow]")
        sys.exit(0)

    resolved_model_path = resolve_gemma_judge_model_path(args.model)
    model_exists = os.path.isfile(resolved_model_path)

    console.print(
        Panel(
            f"[bold cyan]Batch Evaluator: Gemma 2 27B Abliterated Judge[/bold cyan]\n"
            f"Model                : {args.model}\n"
            f"Resolved Model Path  : {resolved_model_path} ({'[green]Found[/green]' if model_exists else '[red]Not Found[/red]'})\n"
            f"Logs Directory       : {logs_dir.relative_to(project_root)}\n"
            f"Target Sidecar Folder: {evaluations_dir.relative_to(project_root)}\n"
            f"Matched Files        : {len(all_files)}\n"
            f"Force Re-evaluate    : {args.force}\n"
            f"Dry Run Mode         : {args.dry_run}",
            expand=False,
        )
    )

    if not model_exists and not args.dry_run:
        console.print(
            Panel(
                f"[bold red]Error: Gemma Judge model file not found![/bold red]\n\n"
                f"Resolved path: [bold cyan]{resolved_model_path}[/bold cyan]\n\n"
                f"Please download the GGUF model using the command in models/README.md:\n"
                f"  py -m huggingface_hub.cli.hf download mradermacher/gemma-2-27b-it-abliterated-GGUF gemma-2-27b-it-abliterated.Q5_K_M.gguf --local-dir ./models\n\n"
                f"Or specify an existing custom GGUF model path via: --model <path_to_gguf>",
                border_style="red",
            )
        )
        sys.exit(1)

    statuses: List[Dict[str, Any]] = []
    with console.status("[bold blue]Scanning files and sidecar checkpoints...[/bold blue]"):
        for f in all_files:
            sidecar_path = evaluations_dir / f.name
            st = get_file_status(source_path=f, sidecar_path=sidecar_path)
            statuses.append(st)

    table = Table(title="Gemma Judge Evaluation Inventory", header_style="bold magenta", show_lines=False)
    table.add_column("#", justify="right", style="dim", width=4)
    table.add_column("Log File", style="white", min_width=35)
    table.add_column("Total Rows", justify="right", style="cyan", width=12)
    table.add_column("Evaluated", justify="right", style="green", width=12)
    table.add_column("Pending", justify="right", style="yellow", width=12)
    table.add_column("Status", justify="center", width=14)

    total_all_rows = 0
    total_evaluated_rows = 0
    total_pending_rows = 0
    pending_files: List[Dict[str, Any]] = []

    for idx, st in enumerate(statuses, start=1):
        total_all_rows += st["total_rows"]
        total_evaluated_rows += st["evaluated_rows"]

        if args.force:
            pending = st["total_rows"]
            status_text = "[bold yellow]FORCE[/bold yellow]"
            pending_files.append(st)
        elif st["is_complete"]:
            pending = 0
            status_text = "[bold green]COMPLETE[/bold green]"
        elif st["evaluated_rows"] > 0:
            pending = st["pending_rows"]
            status_text = f"[bold yellow]RESUME ({st['evaluated_rows']}/{st['total_rows']})[/bold yellow]"
            pending_files.append(st)
        else:
            pending = st["pending_rows"]
            status_text = "[bold red]PENDING[/bold red]"
            pending_files.append(st)

        total_pending_rows += pending

        table.add_row(
            str(idx),
            st["source_file"].name,
            str(st["total_rows"]),
            str(st["evaluated_rows"]),
            str(pending),
            status_text,
        )

    console.print(table)
    console.print(
        f"\nInventory: [white]{total_all_rows}[/white] total rows | "
        f"[green]{total_evaluated_rows}[/green] evaluated | "
        f"[yellow]{total_pending_rows}[/yellow] pending | "
        f"[cyan]{len(pending_files)}/{len(statuses)}[/cyan] files need processing.\n"
    )

    if args.dry_run:
        console.print("[yellow]Dry-run complete. No evaluations were run.[/yellow]")
        return

    if not pending_files:
        console.print("[bold green]All files are already 100% evaluated by Gemma Judge! Nothing to do.[/bold green]")
        return

    files_to_run = pending_files
    if args.max_files and args.max_files > 0:
        files_to_run = pending_files[:args.max_files]
        console.print(f"[yellow]Limiting execution to first {len(files_to_run)} files (--max-files {args.max_files}).[/yellow]\n")

    for f_idx, item in enumerate(files_to_run, start=1):
        src = item["source_file"]
        console.rule(f"[bold cyan]File {f_idx}/{len(files_to_run)}: {src.name}[/bold cyan]")
        try:
            run_evaluation(
                log_file=str(src),
                evaluator_name="gemma_judge",
                model=args.model,
                force_reevaluate=args.force,
                delay_sec=args.delay,
                n_ctx=args.n_ctx,
                n_gpu_layers=args.n_gpu_layers,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
                max_consecutive_errors=args.max_consecutive_errors,
            )
        except KeyboardInterrupt:
            console.print("\n[bold yellow]Evaluation interrupted by user. Stopping batch cleanly...[/bold yellow]")
            break
        except Exception as e:
            err_str = str(e)
            console.print(f"[bold red]Failed evaluating {src.name}: {e}[/bold red]")
            if any(k in err_str.lower() for k in ("not found", "cuda out of memory", "fatal")):
                console.print(f"[bold red]Halting batch: Fatal model/environment error detected.[/bold red]")
                break
            continue

    console.print(Panel("[bold green]Batch Gemma Judge evaluation session finished![/bold green]", expand=False))


if __name__ == "__main__":
    main()
