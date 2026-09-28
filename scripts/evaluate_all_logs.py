import argparse
import json
import os
import sys
import time
from datetime import datetime
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

from src.evaluators import EvaluatorRegistry, run_evaluation

console = Console()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Batch evaluator: scans benchmark logs and evaluates all pending / unevaluated rows."
    )
    parser.add_argument(
        "--evaluator",
        type=str,
        default="qwen_judge",
        help="Evaluator to use: 'qwen_judge' (default), 'openai_moderation', 'aegis_llamaguard'.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model ID or GGUF path for the evaluator (defaults to evaluator's native default).",
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
        "--n-ctx",
        type=int,
        default=8192,
        help="Context window size for local LLM judge (default: 8192).",
    )
    parser.add_argument(
        "--n-gpu-layers",
        type=int,
        default=None,
        help="Number of GPU layers to offload (-1 for all layers).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature for judge generation (default: 0.0 for deterministic evaluation).",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=1024,
        help="Max output tokens for the structured judge evaluation (default: 1024).",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="API key for API-based evaluators (e.g. OpenAI).",
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
        help="Optional delay (in seconds) between requests to respect rate limits.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Maximum number of pending files to evaluate in this run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and display the evaluation delta/status table without running inference.",
    )
    return parser.parse_args()


def get_file_evaluation_status(
    source_path: Path,
    evaluated_dir: Path,
    evaluator_name: str,
) -> Dict[str, Any]:
    """
    Inspects a source JSONL file and its evaluated checkpoint file to determine
    total rows, evaluated rows, and remaining pending rows.
    """
    output_path = evaluated_dir / source_path.name

    total_source = 0
    try:
        with open(source_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    total_source += 1
    except Exception as e:
        return {
            "source_file": source_path,
            "output_file": output_path,
            "total_rows": 0,
            "evaluated_rows": 0,
            "pending_rows": 0,
            "is_complete": False,
            "error": str(e),
        }

    if total_source == 0:
        return {
            "source_file": source_path,
            "output_file": output_path,
            "total_rows": 0,
            "evaluated_rows": 0,
            "pending_rows": 0,
            "is_complete": True,
            "error": None,
        }

    if not output_path.exists():
        return {
            "source_file": source_path,
            "output_file": output_path,
            "total_rows": total_source,
            "evaluated_rows": 0,
            "pending_rows": total_source,
            "is_complete": False,
            "error": None,
        }

    evaluated_count = 0
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    rec = json.loads(line_str)
                    evals = rec.get("evaluations", [])
                    has_eval = any(
                        ev.get("evaluator") == evaluator_name
                        and ev.get("status") in ("success", "skipped")
                        for ev in evals
                    )
                    if has_eval:
                        evaluated_count += 1
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        return {
            "source_file": source_path,
            "output_file": output_path,
            "total_rows": total_source,
            "evaluated_rows": 0,
            "pending_rows": total_source,
            "is_complete": False,
            "error": str(e),
        }

    pending = max(0, total_source - evaluated_count)
    return {
        "source_file": source_path,
        "output_file": output_path,
        "total_rows": total_source,
        "evaluated_rows": evaluated_count,
        "pending_rows": pending,
        "is_complete": pending == 0 and total_source > 0,
        "error": None,
    }


def main():
    args = parse_args()
    logs_dir = Path(args.logs_dir).resolve()

    if not logs_dir.exists() or not logs_dir.is_dir():
        console.print(f"[bold red][ERROR][/bold red] Logs directory not found: {logs_dir}")
        sys.exit(1)

    evaluated_dir = logs_dir / "evaluated"
    evaluated_dir.mkdir(parents=True, exist_ok=True)

    # Validate evaluator registration
    raw_eval_key = args.evaluator.lower()
    if raw_eval_key not in EvaluatorRegistry._EVALUATORS:
        supported = ", ".join(sorted(EvaluatorRegistry._EVALUATORS.keys()))
        console.print(f"[bold red][ERROR][/bold red] Unknown evaluator: '{args.evaluator}'. Supported: {supported}")
        sys.exit(1)

    eval_canonical_map = {
        "openai": "openai_moderation",
        "openai_moderation": "openai_moderation",
        "moderation": "openai_moderation",
        "omni_moderation": "openai_moderation",
        "aegis": "aegis_llamaguard",
        "aegis_llamaguard": "aegis_llamaguard",
        "llamaguard": "aegis_llamaguard",
        "llama_guard": "aegis_llamaguard",
        "qwen_judge": "qwen_judge",
        "qwen-judge": "qwen_judge",
        "qwen": "qwen_judge",
        "llm_judge": "qwen_judge",
        "llm-judge": "qwen_judge",
        "judge": "qwen_judge",
    }
    canonical_evaluator_name = eval_canonical_map.get(raw_eval_key, raw_eval_key)

    # Scan for matching log files (exclude subdirectories like evaluated/, old/, etc.)
    all_files = sorted([
        f for f in logs_dir.glob(args.pattern)
        if f.is_file() and not f.name.startswith("_test_")
    ])

    if not all_files:
        console.print(f"[yellow]No log files found in '{logs_dir}' matching pattern '{args.pattern}'.[/yellow]")
        sys.exit(0)

    console.print(Panel(
        f"[bold cyan]Batch Log Evaluator[/bold cyan]\n"
        f"Evaluator: [green]{canonical_evaluator_name}[/green] | "
        f"Model: [yellow]{args.model or 'Default'}[/yellow] | "
        f"Logs Directory: [magenta]{logs_dir}[/magenta]\n"
        f"Matching Files: [white]{len(all_files)}[/white] | "
        f"Force Re-evaluate: [white]{args.force}[/white] | "
        f"Dry Run: [white]{args.dry_run}[/white]",
        border_style="cyan",
    ))

    # Scan files to check evaluation delta
    with console.status("[bold blue]Scanning log files and checkpoints...[/bold blue]"):
        statuses: List[Dict[str, Any]] = []
        for file_path in all_files:
            st = get_file_evaluation_status(
                source_path=file_path,
                evaluated_dir=evaluated_dir,
                evaluator_name=canonical_evaluator_name,
            )
            statuses.append(st)

    # Build status table
    table = Table(
        title=f"Evaluation Status Inventory ({canonical_evaluator_name})",
        header_style="bold magenta",
        show_lines=False,
    )
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
        elif st["pending_rows"] > 0:
            pending = st["pending_rows"]
            status_text = f"[bold yellow]PENDING ({pending})[/bold yellow]"
            pending_files.append(st)
        else:
            pending = 0
            status_text = "[dim]EMPTY[/dim]"

        total_pending_rows += pending

        table.add_row(
            str(idx),
            st["source_file"].name,
            f"{st['total_rows']:,}",
            f"{st['evaluated_rows']:,}",
            f"{pending:,}",
            status_text,
        )

    console.print(table)

    summary_text = (
        f"[bold]Summary:[/bold] {len(all_files)} files scanned | "
        f"{len(all_files) - len(pending_files)} complete | "
        f"{len(pending_files)} pending | "
        f"[yellow]{total_pending_rows:,}[/yellow] rows waiting for evaluation."
    )
    console.print(f"\n{summary_text}\n")

    if args.dry_run:
        console.print("[dim]Dry run requested: exiting without performing evaluation.[/dim]")
        sys.exit(0)

    if not pending_files or total_pending_rows == 0:
        console.print("[bold green]✔ All log rows have already been evaluated! Nothing to do.[/bold green]")
        sys.exit(0)

    if args.max_files is not None and args.max_files > 0:
        pending_files = pending_files[:args.max_files]
        console.print(f"[dim]Processing capped at {len(pending_files)} files via --max-files.[/dim]\n")

    console.print(f"[bold green]Starting evaluation of {len(pending_files)} files ({total_pending_rows:,} total rows)...[/bold green]\n")

    start_batch_time = time.time()
    completed_files = 0
    failed_files = 0

    eval_kwargs: Dict[str, Any] = {
        "evaluator_name": canonical_evaluator_name,
        "force_reevaluate": args.force,
        "delay_sec": args.delay,
        "n_ctx": args.n_ctx,
        "n_gpu_layers": args.n_gpu_layers,
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
    }
    if args.model:
        eval_kwargs["model"] = args.model
    if args.api_key:
        eval_kwargs["api_key"] = args.api_key

    try:
        for f_idx, st in enumerate(pending_files, start=1):
            file_name = st["source_file"].name
            pending_count = st["total_rows"] if args.force else st["pending_rows"]

            console.print(f"\n[bold cyan]▶ [{f_idx}/{len(pending_files)}] Evaluating: {file_name}[/bold cyan] [dim]({pending_count:,} rows pending)[/dim]")

            try:
                out_path = run_evaluation(
                    log_file=st["source_file"],
                    **eval_kwargs,
                )
                completed_files += 1
            except KeyboardInterrupt:
                raise
            except Exception as e:
                failed_files += 1
                console.print(f"[bold red]✖ Error evaluating {file_name}: {e}[/bold red]")

    except KeyboardInterrupt:
        console.print("\n[bold yellow]⚠ Evaluation interrupted by user. Progress saved in checkpoint logs.[/bold yellow]")
        sys.exit(130)

    elapsed_batch = time.time() - start_batch_time
    minutes = int(elapsed_batch // 60)
    seconds = int(elapsed_batch % 60)

    console.print(Panel(
        f"[bold green]Batch Evaluation Complete![/bold green]\n"
        f"Files processed: [white]{completed_files}/{len(pending_files)}[/white] | "
        f"Errors: [white]{failed_files}[/white] | "
        f"Total duration: [white]{minutes}m {seconds}s[/white]\n"
        f"Results saved to: [magenta]{evaluated_dir}[/magenta]",
        border_style="green",
    ))


if __name__ == "__main__":
    main()
