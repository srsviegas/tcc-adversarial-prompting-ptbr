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
    DEFAULT_AEGIS_ADAPTER_ID,
    DEFAULT_AEGIS_BASE_MODEL,
    run_evaluation,
)

console = Console()


def get_file_status(source_path: Path, sidecar_path: Path) -> Dict[str, Any]:
    """
    Checks source log against the evaluations/llamaguard/ sidecar file.
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
                            if ev.get("status") in ("success", "skipped") and "llama" in str(ev.get("evaluator", "")).lower():
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
        description="Batch LlamaGuard evaluator: scans logs/ and evaluates pending rows into evaluations/llamaguard/."
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
        "--max-consecutive-errors",
        type=int,
        default=3,
        help="Maximum consecutive errors before aborting a file evaluation (default: 3).",
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

    evaluations_dir = project_root / "evaluations" / "llamaguard"
    evaluations_dir.mkdir(parents=True, exist_ok=True)

    all_files = sorted([
        f for f in logs_dir.glob(args.pattern)
        if f.is_file() and not f.name.startswith("_test_")
    ])

    if not all_files:
        console.print(f"[yellow]No log files found in '{logs_dir}' matching pattern '{args.pattern}'.[/yellow]")
        sys.exit(0)

    hf_token = args.hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")

    console.print(
        Panel(
            f"[bold cyan]Batch Evaluator: LlamaGuard[/bold cyan]\n"
            f"Logs Directory       : {logs_dir.relative_to(project_root)}\n"
            f"Target Sidecar Folder: {evaluations_dir.relative_to(project_root)}\n"
            f"Adapter Model        : {args.model}\n"
            f"Base Model           : {args.base_model}\n"
            f"Load in 4-bit        : {args.load_in_4bit}\n"
            f"Matched Files        : {len(all_files)}\n"
            f"Force Re-evaluate    : {args.force}\n"
            f"Dry Run Mode         : {args.dry_run}",
            expand=False,
        )
    )

    is_gguf = args.model.endswith(".gguf") or (os.path.isfile(args.model) and "gguf" in args.model.lower())
    if not is_gguf and not hf_token and not args.dry_run:
        try:
            from huggingface_hub import try_to_load_from_cache
            cached_config = try_to_load_from_cache(args.base_model, "config.json")
            if not cached_config:
                console.print(
                    Panel(
                        f"[bold yellow]Warning: HF_TOKEN is not set and '{args.base_model}' is not cached locally.[/bold yellow]\n\n"
                        f"Aegis LlamaGuard uses the gated base model [bold cyan]{args.base_model}[/bold cyan].\n"
                        f"Without an authenticated Hugging Face token, evaluation will fail with 401 Client Error.\n\n"
                        f"To fix this, either:\n"
                        f"  1. Set HF_TOKEN in your .env file or environment (export HF_TOKEN=\"...\")\n"
                        f"  2. Pass --hf-token YOUR_TOKEN\n"
                        f"  3. Use a local GGUF model: --model path/to/model.gguf",
                        border_style="yellow",
                    )
                )
        except Exception:
            pass

    statuses: List[Dict[str, Any]] = []
    with console.status("[bold blue]Scanning files and sidecar checkpoints...[/bold blue]"):
        for f in all_files:
            sidecar_path = evaluations_dir / f.name
            st = get_file_status(source_path=f, sidecar_path=sidecar_path)
            statuses.append(st)

    table = Table(title="LlamaGuard Evaluation Inventory", header_style="bold magenta", show_lines=False)
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
        console.print("[bold green]All files are already 100% evaluated by LlamaGuard! Nothing to do.[/bold green]")
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
                evaluator_name="aegis_llamaguard",
                model=args.model,
                base_model_id=args.base_model,
                hf_token=hf_token,
                load_in_4bit=args.load_in_4bit,
                force_reevaluate=args.force,
                delay_sec=args.delay,
                max_consecutive_errors=args.max_consecutive_errors,
            )
        except KeyboardInterrupt:
            console.print("\n[bold yellow]Evaluation interrupted by user. Stopping batch cleanly...[/bold yellow]")
            break
        except Exception as e:
            err_str = str(e)
            console.print(f"[bold red]Failed evaluating {src.name}: {e}[/bold red]")
            if any(k in err_str.lower() for k in ("401", "403", "gated repo", "unauthorized", "cuda out of memory")):
                console.print(f"[bold red]Halting batch: Fatal model/environment error detected.[/bold red]")
                break
            continue

    console.print(Panel("[bold green]Batch LlamaGuard evaluation session finished![/bold green]", expand=False))


if __name__ == "__main__":
    main()
