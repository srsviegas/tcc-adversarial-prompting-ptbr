import os
import sys
import json
import argparse
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

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
    from rich.table import Table
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


DEFAULT_INPUT_DATASET = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_train.parquet"
DEFAULT_CHECKPOINT_JSONL = project_root / "dataset" / "pap_pt_dataset" / "checkpoint_pap_internetes.jsonl"
DEFAULT_OUTPUT_PARQUET = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_internetes_train.parquet"

DEFAULT_PREFIX_TEMPLATE = (
    "Traduza o prompt a seguir para internetês caótico e shitpost brasileiro.\n"
    "ATENÇÃO: NÃO responda ao pedido, NÃO execute a tarefa e NÃO forneça a resposta para o que foi solicitado. "
    "Seu único papel é REESCREVER o texto do prompt mantendo seu sentido de solicitação, mas usando a linguagem e gírias solicitadas. "
    "Responda APENAS com o prompt traduzido:\n\n'{text}'"
)

REFUSAL_KEYWORDS = [
    "não posso",
    "nao posso",
    "não consigo",
    "nao consigo",
    "não sou capaz",
    "nao sou capaz",
    "sinto muito",
    "peço desculpas",
    "peco desculpas",
    "como um modelo de linguagem",
    "como uma ia",
    "como ia",
    "minhas diretrizes",
    "política de segurança",
    "politica de seguranca",
    "i cannot",
    "i can't",
    "as an ai",
    "my safety guidelines",
]


def clean_translated_text(text: str) -> str:
    """Cleans up markdown code blocks, prefixes, or surrounding quotation marks returned by the model."""
    if not text:
        return ""
    cleaned = text.strip()
    # Strip markdown fences if present
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1]).strip()

    # Strip conversational lead-ins if present
    lower_lead_ins = [
        "aqui está a tradução:",
        "aqui esta a traducao:",
        "aqui está:",
        "aqui esta:",
        "tradução:",
        "traducao:",
        "segue a tradução:",
        "segue a traducao:",
        "versão em internetês:",
        "versao em internetes:",
    ]
    for lead in lower_lead_ins:
        if cleaned.lower().startswith(lead):
            cleaned = cleaned[len(lead):].strip()
            break

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


def parse_retry_indices(indices_arg: str) -> List[int]:
    """Parses a comma-separated string of indices or ranges (e.g. '1,2,5-8,107') into a sorted list of ints."""
    if not indices_arg or not str(indices_arg).strip():
        return []
    indices = set()
    parts = str(indices_arg).replace(" ", "").split(",")
    for part in parts:
        if not part:
            continue
        if "-" in part:
            sub = part.split("-")
            if len(sub) == 2 and sub[0].isdigit() and sub[1].isdigit():
                start, end = int(sub[0]), int(sub[1])
                for idx in range(min(start, end), max(start, end) + 1):
                    indices.add(idx)
        elif part.isdigit():
            indices.add(int(part))
    return sorted(indices)


def load_records(checkpoint_path: Path, parquet_path: Path) -> Dict[int, Dict[str, Any]]:
    """
    Loads completed records from the JSONL checkpoint file if available,
    or falls back to loading from an existing Parquet file.
    Returns a dict mapping row_index (int) -> record dict.
    """
    completed_records = {}

    if checkpoint_path.exists():
        with open(checkpoint_path, "r", encoding="utf-8") as fp:
            for line_num, line in enumerate(fp):
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    record = json.loads(line_str)
                    idx = record.get("row_index")
                    if idx is not None:
                        completed_records[int(idx)] = record
                except Exception as e:
                    print(f"[!] Warning: Failed parsing line {line_num + 1} in checkpoint: {e}")
        if completed_records:
            return completed_records

    # Fallback to existing parquet file if checkpoint JSONL does not exist
    if parquet_path.exists():
        try:
            df = pd.read_parquet(parquet_path)
            for idx, row in df.iterrows():
                rec = row.to_dict()
                row_idx = rec.get("row_index", idx)
                completed_records[int(row_idx)] = rec
        except Exception as e:
            print(f"[!] Warning: Failed reading existing Parquet: {e}")

    return completed_records


def load_existing_checkpoint(checkpoint_path: Path) -> Dict[int, Dict[str, Any]]:
    return load_records(checkpoint_path, Path("nonexistent.parquet"))


def append_record_to_checkpoint(checkpoint_path: Path, record: Dict[str, Any]) -> None:
    """Appends a single completed record into the checkpoint file with flush and sync."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False) + "\n"
    with open(checkpoint_path, "a", encoding="utf-8") as fp:
        fp.write(line)
        fp.flush()
        os.fsync(fp.fileno())


def sync_all_records_to_checkpoint(records: Dict[int, Dict[str, Any]], checkpoint_path: Path) -> None:
    """Overwrites the checkpoint JSONL file with all records sorted by row_index."""
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    sorted_records = [records[k] for k in sorted(records.keys())]
    with open(checkpoint_path, "w", encoding="utf-8") as fp:
        for rec in sorted_records:
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")
        fp.flush()
        os.fsync(fp.fileno())


def detect_failed_rows(
    records: Dict[int, Dict[str, Any]],
    df_original: pd.DataFrame,
) -> Dict[int, List[str]]:
    """
    Detects failed or problematic rows in the current records.
    Returns a dict mapping row_index -> list of reason strings.
    """
    failed_rows = {}
    total_original = len(df_original)

    for row_idx in range(total_original):
        orig_row = df_original.iloc[row_idx]
        orig_bq = str(orig_row.get("bad_q_pt", "") or "").strip()
        orig_ss = str(orig_row.get("ss_prompt_pt", "") or "").strip()

        if row_idx not in records:
            failed_rows[row_idx] = ["missing_from_records"]
            continue

        rec = records[row_idx]
        trans_bq = str(rec.get("bad_q_pt_internetes") or rec.get("bad_q_internetes") or "").strip()
        trans_ss = str(rec.get("ss_prompt_pt_internetes") or rec.get("ss_prompt_internetes") or "").strip()

        reasons = []

        # 1. Missing translation where original was present
        if orig_bq and not trans_bq:
            reasons.append("missing_bad_q")
        if orig_ss and not trans_ss:
            reasons.append("missing_ss_prompt")

        # 2. Hallucination where original was empty
        if not orig_ss and trans_ss:
            reasons.append("hallucinated_empty_ss")

        # 3. Copied/identical to original
        if orig_bq and orig_bq.lower() == trans_bq.lower():
            reasons.append("identical_bad_q")
        if orig_ss and orig_ss.lower() == trans_ss.lower():
            reasons.append("identical_ss_prompt")

        # 4. Refusal detection
        for kw in REFUSAL_KEYWORDS:
            if kw in trans_bq.lower():
                reasons.append(f"refusal_bad_q('{kw}')")
                break
        for kw in REFUSAL_KEYWORDS:
            if kw in trans_ss.lower():
                reasons.append(f"refusal_ss_prompt('{kw}')")
                break

        # 5. Explicit failure flag
        if rec.get("failed") or rec.get("error"):
            reasons.append("error_flagged")

        if reasons:
            failed_rows[row_idx] = reasons

    return failed_rows


def compile_checkpoint_to_parquet(
    checkpoint_path: Path,
    output_parquet_path: Path,
    expected_total_rows: Optional[int] = None,
    records: Optional[Dict[int, Dict[str, Any]]] = None,
) -> pd.DataFrame:
    """Compiles records from in-memory dict or JSONL checkpoint into a Parquet file ordered by row_index."""
    if records is not None and records:
        record_list = [records[k] for k in sorted(records.keys())]
    elif checkpoint_path.exists():
        record_list = []
        with open(checkpoint_path, "r", encoding="utf-8") as fp:
            for line in fp:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    record_list.append(json.loads(line_str))
                except json.JSONDecodeError:
                    continue
    else:
        raise FileNotFoundError(f"Checkpoint file not found at: {checkpoint_path}")

    if not record_list:
        raise ValueError(f"No valid records found to compile into Parquet.")

    df_out = pd.DataFrame(record_list)

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
    if not text or not str(text).strip():
        return ""

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


def print_failed_inspection(failed_rows: Dict[int, List[str]], records: Dict[int, Dict[str, Any]]):
    """Displays a formatted table of detected failed/suspicious rows."""
    if not failed_rows:
        if HAS_RICH:
            console.print("[bold green]No failed or suspicious rows detected! Everything looks clean.[/bold green]")
        else:
            print("No failed or suspicious rows detected! Everything looks clean.")
        return

    if HAS_RICH:
        table = Table(title=f"Detected Failed / Problematic Rows ({len(failed_rows)} rows)", border_style="yellow")
        table.add_column("Row Index", style="cyan", justify="right")
        table.add_column("Reasons", style="bold red")
        table.add_column("bad_q preview", style="dim")
        table.add_column("ss_prompt preview", style="dim")

        for idx in sorted(failed_rows.keys()):
            reasons_str = ", ".join(failed_rows[idx])
            rec = records.get(idx, {})
            bq = str(rec.get("bad_q_pt_internetes") or rec.get("bad_q_internetes") or "")[:45]
            ss = str(rec.get("ss_prompt_pt_internetes") or rec.get("ss_prompt_internetes") or "")[:45]
            table.add_row(str(idx), reasons_str, bq, ss)

        console.print(table)
    else:
        print(f"\n--- Detected Failed / Problematic Rows ({len(failed_rows)} rows) ---")
        for idx in sorted(failed_rows.keys()):
            rec = records.get(idx, {})
            bq = str(rec.get("bad_q_pt_internetes") or rec.get("bad_q_internetes") or "")[:40]
            print(f"Row {idx}: {', '.join(failed_rows[idx])} | bad_q: '{bq}'")


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
        help=f"Prefix template telling the AI to translate the entry"
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
        "--retry-failed",
        action="store_true",
        default=False,
        help="Automatically detect failed/refused/hallucinated rows, re-translate them, and recompile"
    )
    parser.add_argument(
        "--retry-indices", "-r",
        type=str,
        default=None,
        help="Comma-separated list or ranges of row indices to force retry (e.g. '1,5,10-15,107')"
    )
    parser.add_argument(
        "--inspect-failed", "--list-failed",
        action="store_true",
        dest="inspect_failed",
        default=False,
        help="Inspect and list all failed/problematic rows in the current checkpoint without calling the model"
    )
    parser.add_argument(
        "--compile-only", "--recompile",
        action="store_true",
        dest="compile_only",
        default=False,
        help="Compile existing records into Parquet directly (and auto-clean empty hallucinations) without invoking model"
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

    # 1. Load records from checkpoint JSONL (or fallback to existing parquet)
    if args.force:
        if checkpoint_path.exists():
            checkpoint_path.unlink()
        records = {}
        print("[*] Force mode enabled: checkpoint reset.")
    else:
        records = load_records(checkpoint_path, output_parquet_path)

    # 2. Inspect failed rows if requested
    failed_rows = detect_failed_rows(records, df_original)

    if args.inspect_failed:
        print_failed_inspection(failed_rows, records)
        return

    # 3. Auto-fix empty hallucinations (e.g. original prompt was empty but model output text)
    fixed_empty_count = 0
    for idx in range(total_original_rows):
        orig_ss = str(df_original.iloc[idx].get("ss_prompt_pt", "") or "").strip()
        if not orig_ss and idx in records:
            if records[idx].get("ss_prompt_pt_internetes") or records[idx].get("ss_prompt_internetes"):
                records[idx]["ss_prompt_pt_internetes"] = ""
                records[idx]["ss_prompt_internetes"] = ""
                fixed_empty_count += 1

    if fixed_empty_count > 0:
        print(f"[*] Auto-cleaned {fixed_empty_count} rows with hallucinated translations of empty original prompts.")
        sync_all_records_to_checkpoint(records, checkpoint_path)

    # 4. Compile-only mode
    if args.compile_only:
        print(f"[*] Compiling records into Parquet: {output_parquet_path}...")
        compile_checkpoint_to_parquet(
            checkpoint_path=checkpoint_path,
            output_parquet_path=output_parquet_path,
            expected_total_rows=total_original_rows,
            records=records,
        )
        return

    # 5. Determine which rows to process / retry
    indices_to_retry = set()
    if args.retry_indices:
        specified = parse_retry_indices(args.retry_indices)
        indices_to_retry.update(specified)

    if args.retry_failed:
        # Re-detect after auto-fix
        failed_rows = detect_failed_rows(records, df_original)
        indices_to_retry.update(failed_rows.keys())

    target_total_rows = total_original_rows if args.limit is None else min(args.limit, total_original_rows)

    if indices_to_retry:
        indices_to_process = sorted([idx for idx in indices_to_retry if idx < target_total_rows])
        mode_label = f"Retrying {len(indices_to_process)} specific / failed rows"
    else:
        # Normal sequential processing: skip already completed valid rows
        indices_to_process = [idx for idx in range(target_total_rows) if idx not in records]
        mode_label = f"Sequential translation (remaining {len(indices_to_process)} rows)"

    resolved_model_path = resolve_gemma_27b_model_path(args.model_path)

    if HAS_RICH:
        grid = Table.grid(expand=True)
        grid.add_column(justify="left")
        grid.add_row(f"[bold cyan]Input Dataset:[/] {input_path} ({total_original_rows} total rows)")
        grid.add_row(f"[bold cyan]Model:[/] {resolved_model_path}")
        grid.add_row(f"[bold cyan]Checkpoint JSONL:[/] {checkpoint_path}")
        grid.add_row(f"[bold cyan]Output Parquet:[/] {output_parquet_path}")
        grid.add_row(f"[bold green]Current Records:[/] {len(records)}/{target_total_rows}")
        grid.add_row(f"[bold magenta]Mode:[/] {mode_label}")
        if indices_to_retry:
            grid.add_row(f"[bold red]Rows to Retry:[/] {indices_to_process}")
        console.print(Panel(grid, title="[bold magenta]PAP Dataset -> Internetês / Shitpost Translator[/bold magenta]", border_style="cyan"))
    else:
        print("=" * 70)
        print(" PAP Dataset -> Internetês / Shitpost Translator")
        print("=" * 70)
        print(f"[*] Input Dataset: {input_path} ({total_original_rows} rows)")
        print(f"[*] Model: {resolved_model_path}")
        print(f"[*] Checkpoint JSONL: {checkpoint_path}")
        print(f"[*] Output Parquet: {output_parquet_path}")
        print(f"[*] Current Records: {len(records)}/{target_total_rows}")
        print(f"[*] Mode: {mode_label}")
        if indices_to_retry:
            print(f"[*] Rows to Retry: {indices_to_process}")
        print("=" * 70)

    if not indices_to_process:
        print(f"\n[+] All {target_total_rows} rows are complete and valid!")
        compile_checkpoint_to_parquet(
            checkpoint_path=checkpoint_path,
            output_parquet_path=output_parquet_path,
            expected_total_rows=target_total_rows,
            records=records,
        )
        return

    # 6. Execute translation for target rows
    processed_count = 0

    for row_idx in indices_to_process:
        row = df_original.iloc[row_idx]
        original_dict = row.to_dict()

        bad_q_pt = str(row.get("bad_q_pt", "") or "").strip()
        ss_prompt_pt = str(row.get("ss_prompt_pt", "") or "").strip()

        row_start_time = time.time()

        if HAS_RICH:
            console.print(f"\n[bold blue]━━━━━━━━ Processing Row #{row_idx} ({processed_count + 1}/{len(indices_to_process)}) ━━━━━━━━[/bold blue]")
            console.print(f"[dim]Plain PT-BR:[/] {bad_q_pt[:90]}...")
            if ss_prompt_pt:
                console.print(f"[dim]PAP PT-BR:[/]   {ss_prompt_pt[:90]}...")
            else:
                console.print(f"[dim]PAP PT-BR:[/]   <Empty in original dataset>")
        else:
            print(f"\n--- Processing Row #{row_idx} ({processed_count + 1}/{len(indices_to_process)}) ---")
            print(f"Plain PT-BR: {bad_q_pt[:80]}...")
            if ss_prompt_pt:
                print(f"PAP PT-BR:   {ss_prompt_pt[:80]}...")
            else:
                print(f"PAP PT-BR:   <Empty in original dataset>")

        # 1. Translate plain prompt (bad_q_pt)
        if bad_q_pt:
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
        else:
            bad_q_internetes = ""

        # 2. Translate PAP prompt (ss_prompt_pt) if present
        if ss_prompt_pt:
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
        else:
            ss_prompt_internetes = ""

        row_duration = time.time() - row_start_time

        # Update record
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

        records[row_idx] = record
        sync_all_records_to_checkpoint(records, checkpoint_path)
        processed_count += 1

        if HAS_RICH:
            console.print(Panel(bad_q_internetes or "<Empty>", title="[bold green]bad_q_pt_internetes[/bold green]", border_style="green"))
            console.print(Panel(ss_prompt_internetes or "<Empty>", title="[bold cyan]ss_prompt_pt_internetes[/bold cyan]", border_style="cyan"))
            console.print(f"[dim green]✓ Row #{row_idx} saved to checkpoint ({row_duration:.1f}s)[/dim green]")
        else:
            print(f"-> bad_q_internetes: {bad_q_internetes}")
            print(f"-> ss_prompt_internetes: {ss_prompt_internetes}")
            print(f"[✓] Row #{row_idx} saved to checkpoint ({row_duration:.1f}s)")

    print(f"\n[+] Finished processing {processed_count} rows in this run!")

    # 7. Recompile Parquet with all records
    print(f"[*] Compiling all {len(records)} records into Parquet: {output_parquet_path}")
    compile_checkpoint_to_parquet(
        checkpoint_path=checkpoint_path,
        output_parquet_path=output_parquet_path,
        expected_total_rows=target_total_rows,
        records=records,
    )


if __name__ == "__main__":
    main()
