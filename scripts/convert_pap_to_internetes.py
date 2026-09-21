import os
import sys
import json
import argparse
import time
from pathlib import Path
from typing import Dict, Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

import pandas as pd

from src.models.gemma import (
    DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH,
    resolve_gemma_27b_model_path,
    call_gemma_27b,
)
from src.prompts import INTERNETES_SYSTEM_PROMPT

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn, TimeRemainingColumn
    from rich.table import Table
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


DEFAULT_INPUT_DATASET = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_train.parquet"
DEFAULT_CHECKPOINT_JSONL = project_root / "dataset" / "pap_pt_dataset" / "checkpoint_pap_internetes.jsonl"
DEFAULT_OUTPUT_PARQUET = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_internetes_train.parquet"
DEFAULT_PREFIX_TEMPLATE = "Traduza o prompt a seguir: '{text}'"


def clean_translated_text(text: str) -> str:
    """Cleans up markdown code blocks or surrounding quotation marks returned by the model."""
    if not text:
        return ""
    cleaned = text.strip()
    # Strip markdown fences if present
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1]).strip()
    # Strip outer single or double quotes if the model wrapped the entire response
    if (cleaned.startswith("'") and cleaned.endswith("'")) or (cleaned.startswith('"') and cleaned.endswith('"')):
        cleaned = cleaned[1:-1].strip()
    return cleaned


def build_translation_prompt(text: str, prefix_template: str = DEFAULT_PREFIX_TEMPLATE) -> str:
    """Builds the user prompt asking the model to translate the text into internetes."""
    text_content = text.strip() if text else ""
    if "{text}" in prefix_template:
        return prefix_template.format(text=text_content)
    return f"{prefix_template.rstrip()} '{text_content}'"


def load_existing_checkpoint(checkpoint_path: Path) -> Dict[int, Dict[str, Any]]:
    """
    Loads completed rows from the JSONL checkpoint file.
    Returns a dict mapping row_index (int) -> record dict.
    """
    completed_records = {}
    if not checkpoint_path.exists():
        return completed_records

    with open(checkpoint_path, "r", encoding="utf-8") as fp:
        for line_num, line in enumerate(fp):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                record = json.loads(line_str)
                idx = record.get("row_index")
                bad_q_internetes = record.get("bad_q_pt_internetes") or record.get("bad_q_internetes")
                ss_prompt_internetes = record.get("ss_prompt_pt_internetes") or record.get("ss_prompt_internetes")

                # Verify both translations were successfully recorded and not empty
                if idx is not None and bad_q_internetes and ss_prompt_internetes:
                    completed_records[int(idx)] = record
            except Exception as e:
                print(f"[!] Warning: Failed parsing line {line_num + 1} in checkpoint: {e}")

    return completed_records


def append_record_to_checkpoint(checkpoint_path: Path, record: Dict[str, Any]) -> None:
    """Appends a completed record as a single line JSON into the checkpoint file with flush."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False) + "\n"
    with open(checkpoint_path, "a", encoding="utf-8") as fp:
        fp.write(line)
        fp.flush()
        os.fsync(fp.fileno())


def compile_checkpoint_to_parquet(
    checkpoint_path: Path,
    output_parquet_path: Path,
    expected_total_rows: Optional[int] = None,
) -> pd.DataFrame:
    """Compiles all records from the JSONL checkpoint into a Parquet file ordered by row_index."""
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint file not found at: {checkpoint_path}")

    records = []
    with open(checkpoint_path, "r", encoding="utf-8") as fp:
        for line in fp:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                records.append(json.loads(line_str))
            except json.JSONDecodeError:
                continue

    if not records:
        raise ValueError(f"No valid records found in checkpoint: {checkpoint_path}")

    df_out = pd.DataFrame(records)

    # Sort by original row_index if available
    if "row_index" in df_out.columns:
        df_out = df_out.sort_values(by="row_index").reset_index(drop=True)

    output_parquet_path.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_parquet(output_parquet_path, index=False)

    total_compiled = len(df_out)
    if HAS_RICH:
        console.print(
            Panel(
                f"[bold green]Parquet compiled successfully![/bold green]\n"
                f"[bold cyan]Rows:[/] {total_compiled}" + (f" / {expected_total_rows}" if expected_total_rows else "") + "\n"
                f"[bold cyan]Saved to:[/] [underline]{output_parquet_path}[/underline]",
                title="[bold green]Compilation Complete[/bold green]",
                border_style="green",
            )
        )
    else:
        print(f"[*] Parquet compiled successfully with {total_compiled} rows saved to: {output_parquet_path}")

    return df_out


def translate_prompt(
    text: str,
    model_path: str,
    prefix_template: str,
    temperature: float = 0.6,
    top_p: float = 0.95,
    max_tokens: int = 4096,
    n_ctx: int = 8192,
    n_gpu_layers: Optional[int] = None,
    max_retries: int = 3,
) -> str:
    """Translates a single prompt using Gemma 2 27B abliterated and INTERNETES_SYSTEM_PROMPT."""
    user_prompt = build_translation_prompt(text, prefix_template=prefix_template)

    for attempt in range(1, max_retries + 1):
        res = call_gemma_27b(
            model_name=model_path,
            system_prompt=INTERNETES_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_tokens,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
        )

        if not res.get("error_log", {}).get("failed", False):
            extracted = res.get("output", {}).get("extracted_text", "")
            cleaned = clean_translated_text(extracted)
            if cleaned:
                return cleaned

        err_msg = res.get("error_log", {}).get("error_message", "Unknown error")
        print(f"[!] Warning: Model call attempt {attempt}/{max_retries} failed: {err_msg}")
        time.sleep(1.5 * attempt)

    raise RuntimeError(f"Failed translating prompt after {max_retries} attempts: {text[:60]}...")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert Brazilian Portuguese prompts in PAP dataset to Internetês / Shitpost using Gemma 2 27B Abliterated",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input-dataset", "-i",
        type=Path,
        default=DEFAULT_INPUT_DATASET,
        help=f"Path to input PAP dataset parquet file (default: {DEFAULT_INPUT_DATASET})"
    )
    parser.add_argument(
        "--checkpoint-jsonl", "-c",
        type=Path,
        default=DEFAULT_CHECKPOINT_JSONL,
        help=f"Path to intermediate JSONL checkpoint (default: {DEFAULT_CHECKPOINT_JSONL})"
    )
    parser.add_argument(
        "--output-parquet", "-o",
        type=Path,
        default=DEFAULT_OUTPUT_PARQUET,
        help=f"Path to final compiled parquet dataset (default: {DEFAULT_OUTPUT_PARQUET})"
    )
    parser.add_argument(
        "--model-path", "-m",
        type=str,
        default=DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH,
        help="Path or alias for Gemma 2 27B Abliterated GGUF file"
    )
    parser.add_argument(
        "--prefix-template", "-p",
        type=str,
        default=DEFAULT_PREFIX_TEMPLATE,
        help=f"Prefix template telling the AI to translate the entry (default: \"{DEFAULT_PREFIX_TEMPLATE}\")"
    )
    parser.add_argument(
        "--temperature", "-t",
        type=float,
        default=0.6,
        help="Sampling temperature (default: 0.6)"
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=0.95,
        help="Top-p sampling (default: 0.95)"
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=4096,
        help="Maximum generation tokens per prompt (default: 4096)"
    )
    parser.add_argument(
        "--context-size", "-ctx",
        type=int,
        default=8192,
        help="Context window length n_ctx (default: 8192)"
    )
    parser.add_argument(
        "--gpu-layers", "-ngl",
        type=int,
        default=None,
        help="Number of GPU layers to offload (-1 for all, default: auto-detect)"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=None,
        help="Limit number of rows to process (useful for testing)"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        default=False,
        help="Ignore existing checkpoint and start from scratch"
    )
    parser.add_argument(
        "--compile-only",
        action="store_true",
        default=False,
        help="Compile existing JSONL checkpoint into Parquet directly without invoking model"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    input_path = args.input_dataset
    checkpoint_path = args.checkpoint_jsonl
    output_parquet_path = args.output_parquet

    if not input_path.exists():
        print(f"[!] Error: Input dataset not found: {input_path}")
        sys.exit(1)

    df_original = pd.read_parquet(input_path)
    total_original_rows = len(df_original)

    if args.compile_only:
        print(f"[*] Compiling checkpoint '{checkpoint_path}' into Parquet...")
        compile_checkpoint_to_parquet(
            checkpoint_path=checkpoint_path,
            output_parquet_path=output_parquet_path,
            expected_total_rows=total_original_rows,
        )
        return

    resolved_model_path = resolve_gemma_27b_model_path(args.model_path)

    # Load existing checkpoint
    if args.force:
        if checkpoint_path.exists():
            checkpoint_path.unlink()
        completed_records = {}
        print("[*] Force mode enabled: checkpoint reset.")
    else:
        completed_records = load_existing_checkpoint(checkpoint_path)

    already_done_count = len(completed_records)

    target_total_rows = total_original_rows if args.limit is None else min(args.limit, total_original_rows)

    if HAS_RICH:
        grid = Table.grid(expand=True)
        grid.add_column(justify="left")
        grid.add_row(f"[bold cyan]Input Dataset:[/] {input_path} ({total_original_rows} total rows)")
        grid.add_row(f"[bold cyan]Model:[/] {resolved_model_path}")
        grid.add_row(f"[bold cyan]Checkpoint JSONL:[/] {checkpoint_path}")
        grid.add_row(f"[bold cyan]Output Parquet:[/] {output_parquet_path}")
        grid.add_row(f"[bold green]Already Completed:[/] {already_done_count}/{target_total_rows}")
        grid.add_row(f"[bold yellow]Prefix Template:[/] {args.prefix_template}")
        console.print(Panel(grid, title="[bold magenta]PAP Dataset -> Internetês / Shitpost Translator[/bold magenta]", border_style="cyan"))
    else:
        print("=" * 70)
        print(" PAP Dataset -> Internetês / Shitpost Translator")
        print("=" * 70)
        print(f"[*] Input Dataset: {input_path} ({total_original_rows} rows)")
        print(f"[*] Model: {resolved_model_path}")
        print(f"[*] Checkpoint JSONL: {checkpoint_path}")
        print(f"[*] Output Parquet: {output_parquet_path}")
        print(f"[*] Already Completed: {already_done_count}/{target_total_rows}")
        print("=" * 70)

    if already_done_count >= target_total_rows:
        print(f"\n[+] All {target_total_rows} rows are already completed in checkpoint!")
        compile_checkpoint_to_parquet(checkpoint_path, output_parquet_path, expected_total_rows=target_total_rows)
        return

    # Process rows
    processed_in_this_run = 0

    indices_to_process = list(range(target_total_rows))

    for row_idx in indices_to_process:
        if row_idx in completed_records:
            continue

        row = df_original.iloc[row_idx]
        original_dict = row.to_dict()

        bad_q_pt = str(row.get("bad_q_pt", "") or "").strip()
        ss_prompt_pt = str(row.get("ss_prompt_pt", "") or "").strip()

        row_start_time = time.time()

        if HAS_RICH:
            console.print(f"\n[bold blue]━━━━━━━━ Processing Row #{row_idx + 1}/{target_total_rows} ━━━━━━━━[/bold blue]")
            console.print(f"[dim]Plain PT-BR:[/] {bad_q_pt[:90]}...")
            console.print(f"[dim]PAP PT-BR:[/]   {ss_prompt_pt[:90]}...")
        else:
            print(f"\n--- Processing Row #{row_idx + 1}/{target_total_rows} ---")
            print(f"Plain PT-BR: {bad_q_pt[:80]}...")
            print(f"PAP PT-BR:   {ss_prompt_pt[:80]}...")

        # 1. Translate plain prompt (bad_q_pt)
        bad_q_internetes = translate_prompt(
            text=bad_q_pt,
            model_path=resolved_model_path,
            prefix_template=args.prefix_template,
            temperature=args.temperature,
            top_p=args.top_p,
            max_tokens=args.max_tokens,
            n_ctx=args.context_size,
            n_gpu_layers=args.gpu_layers,
        )

        # 2. Translate PAP prompt (ss_prompt_pt)
        ss_prompt_internetes = translate_prompt(
            text=ss_prompt_pt,
            model_path=resolved_model_path,
            prefix_template=args.prefix_template,
            temperature=args.temperature,
            top_p=args.top_p,
            max_tokens=args.max_tokens,
            n_ctx=args.context_size,
            n_gpu_layers=args.gpu_layers,
        )

        row_duration = time.time() - row_start_time

        # Create record with all original columns + new internetes fields + metadata
        record = {
            "row_index": int(row_idx),
            **original_dict,
            "bad_q_pt_internetes": bad_q_internetes,
            "bad_q_internetes": bad_q_internetes,
            "ss_prompt_pt_internetes": ss_prompt_internetes,
            "ss_prompt_internetes": ss_prompt_internetes,
            "translation_model": Path(resolved_model_path).name,
            "translation_timestamp": time.time(),
        }

        # Save to JSONL checkpoint immediately
        append_record_to_checkpoint(checkpoint_path, record)
        completed_records[row_idx] = record
        processed_in_this_run += 1

        if HAS_RICH:
            console.print(Panel(bad_q_internetes, title="[bold green]bad_q_pt_internetes[/bold green]", border_style="green"))
            console.print(Panel(ss_prompt_internetes, title="[bold cyan]ss_prompt_pt_internetes[/bold cyan]", border_style="cyan"))
            console.print(f"[dim green]✓ Row #{row_idx + 1} saved to checkpoint ({row_duration:.1f}s)[/dim green]")
        else:
            print(f"-> bad_q_internetes: {bad_q_internetes}")
            print(f"-> ss_prompt_internetes: {ss_prompt_internetes}")
            print(f"[✓] Row #{row_idx + 1} saved to checkpoint ({row_duration:.1f}s)")

    print(f"\n[+] Finished processing {processed_in_this_run} new rows in this run!")

    # Check if all rows are now in checkpoint
    if len(completed_records) >= target_total_rows:
        print(f"[*] Compiling all {len(completed_records)} records into Parquet: {output_parquet_path}")
        compile_checkpoint_to_parquet(checkpoint_path, output_parquet_path, expected_total_rows=target_total_rows)


if __name__ == "__main__":
    main()
