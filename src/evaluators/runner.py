import json
import os
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.evaluators.base import BaseEvaluator
from src.evaluators.registry import EvaluatorRegistry
from src.evaluators.ui import EvaluationUI


def get_record_key(record: dict, fallback_idx: int) -> str:
    """Generates a deterministic unique key for a log record."""
    pid = record.get("dataset_metadata", {}).get("original_row_index")
    mname = record.get("model_config", {}).get("model_name")
    lang = record.get("inputs", {}).get("prompt_language")
    style = record.get("inputs", {}).get("attack_style")
    iteration = record.get("run_metadata", {}).get("iteration")

    if pid is not None and all([mname, lang, style, iteration]):
        return f"{pid}::{mname}::{lang}::{style}::{iteration}"
    return f"line_{fallback_idx}"


def resolve_log_path(log_path: str) -> Path:
    """Resolves the log path, checking absolute, relative, and ./logs directory."""
    path_obj = Path(log_path)
    if path_obj.is_file():
        return path_obj.resolve()

    logs_dir_path = Path("logs") / log_path
    if logs_dir_path.is_file():
        return logs_dir_path.resolve()

    logs_dir_basename = Path("logs") / path_obj.name
    if logs_dir_basename.is_file():
        return logs_dir_basename.resolve()

    raise FileNotFoundError(f"Log file not found at '{log_path}' or in 'logs/' directory.")


def run_evaluation(
    log_file: str,
    evaluator_name: str = "openai_moderation",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    force_reevaluate: bool = False,
    delay_sec: float = 0.0,
    ui: Optional[EvaluationUI] = None,
    **kwargs: Any,
) -> Path:
    """
    Evaluates responses from an existing benchmark JSONL log file using the specified evaluator.
    Saves results line-by-line into logs/evaluated/<filename>.jsonl with checkpoint support.
    """
    resolved_input_path = resolve_log_path(log_file)
    project_root = Path(__file__).resolve().parent.parent.parent
    evaluated_dir = project_root / "logs" / "evaluated"
    evaluated_dir.mkdir(parents=True, exist_ok=True)
    output_path = evaluated_dir / resolved_input_path.name

    eval_kwargs = dict(kwargs)
    if api_key:
        eval_kwargs["api_key"] = api_key
    if model:
        eval_kwargs["model"] = model
        eval_kwargs["model_id"] = model

    evaluator = EvaluatorRegistry.get_evaluator(
        evaluator_name,
        **eval_kwargs,
    )

    if ui is None:
        ui = EvaluationUI()

    # 1. Read all source records
    source_records: List[Dict[str, Any]] = []
    with open(resolved_input_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                try:
                    source_records.append(json.loads(line_str))
                except json.JSONDecodeError:
                    continue

    total_records = len(source_records)
    if total_records == 0:
        ui.log_error(f"Source log file '{resolved_input_path.name}' is empty.")
        return output_path

    # 2. Checkpoint recovery from output_path
    completed_cache: Dict[str, Dict[str, Any]] = {}
    valid_existing_lines: List[str] = []

    if output_path.exists() and not force_reevaluate:
        with open(output_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    record = json.loads(line_str)
                    key = get_record_key(record, idx)
                    evaluations = record.get("evaluations", [])
                    # Check if already evaluated by this evaluator and successful or skipped
                    has_eval = any(
                        ev.get("evaluator") == evaluator.name
                        and ev.get("status") in ("success", "skipped")
                        for ev in evaluations
                    )
                    if has_eval:
                        completed_cache[key] = record
                        valid_existing_lines.append(json.dumps(record, ensure_ascii=False) + "\n")
                except json.JSONDecodeError:
                    continue

    checkpoint_count = len(completed_cache)

    # Clean write any valid checkpoint lines (recovers from partial line writes)
    if not force_reevaluate and checkpoint_count > 0:
        with open(output_path, "w", encoding="utf-8") as f:
            f.writelines(valid_existing_lines)
            f.flush()
            os.fsync(f.fileno())
    elif force_reevaluate:
        checkpoint_count = 0
        if output_path.exists():
            output_path.unlink()

    # 3. UI Header
    ui.show_header(
        source_log=resolved_input_path.name,
        output_log=f"logs/evaluated/{output_path.name}",
        evaluator_name=evaluator.name,
        model=getattr(evaluator, "model", model),
        total_rows=total_records,
        checkpoint_count=checkpoint_count,
    )

    # 4. Process records line-by-line
    ui.start_live(total=total_records, completed=checkpoint_count)

    start_time = time.time()
    evaluated_now = 0
    flagged_count = 0
    clean_count = 0
    skipped_count = 0
    error_count = 0
    consecutive_errors = 0
    category_counter = Counter()

    # Count existing checkpoint metrics
    for record in completed_cache.values():
        for ev in record.get("evaluations", []):
            if ev.get("evaluator") == evaluator.name:
                if ev.get("status") == "skipped":
                    skipped_count += 1
                elif ev.get("status") == "error":
                    error_count += 1
                elif ev.get("flagged"):
                    flagged_count += 1
                    for cat in ev.get("flagged_categories", []):
                        category_counter[cat] += 1
                else:
                    clean_count += 1

    with open(output_path, "a", encoding="utf-8") as out_f:
        for idx, record in enumerate(source_records):
            key = get_record_key(record, idx)

            # Skip if already evaluated in checkpoint
            if key in completed_cache:
                continue

            extracted_text = record.get("output", {}).get("extracted_text", "")
            is_failed_execution = record.get("error_log", {}).get("failed", False)

            # Evaluate response
            if is_failed_execution or not extracted_text or not str(extracted_text).strip():
                skip_reason = "Execution marked as failed in error_log" if is_failed_execution else "Empty extracted_text"
                now_utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                eval_result = {
                    "evaluator": evaluator.name,
                    "model": getattr(evaluator, "model", model),
                    "evaluated_at": now_utc,
                    "latency_seconds": 0.0,
                    "status": "skipped",
                    "skip_reason": skip_reason,
                    "flagged": None,
                    "flagged_categories": [],
                    "highest_scoring_category": None,
                    "highest_score": 0.0,
                    "categories": {},
                    "category_scores": {},
                    "category_applied_input_types": {},
                    "raw_response": None,
                }
            else:
                eval_result = evaluator.evaluate(extracted_text)

            # Update evaluations list
            if "evaluations" not in record or not isinstance(record["evaluations"], list):
                record["evaluations"] = []

            # Replace existing evaluator entry if any, otherwise append
            replaced = False
            for e_idx, existing_ev in enumerate(record["evaluations"]):
                if existing_ev.get("evaluator") == evaluator.name:
                    record["evaluations"][e_idx] = eval_result
                    replaced = True
                    break
            if not replaced:
                record["evaluations"].append(eval_result)

            # Stream line-by-line to disk
            line_str = json.dumps(record, ensure_ascii=False) + "\n"
            out_f.write(line_str)
            out_f.flush()
            os.fsync(out_f.fileno())

            # Update counts
            status = eval_result.get("status", "success")
            flagged = eval_result.get("flagged")
            flagged_cats = eval_result.get("flagged_categories", [])
            highest_cat = eval_result.get("highest_scoring_category")
            highest_score = eval_result.get("highest_score", 0.0)
            latency = eval_result.get("latency_seconds", 0.0)

            evaluated_now += 1
            if status == "skipped":
                skipped_count += 1
            elif status == "error":
                error_count += 1
                consecutive_errors += 1
            elif flagged:
                consecutive_errors = 0
                flagged_count += 1
                for cat in flagged_cats:
                    category_counter[cat] += 1
            else:
                consecutive_errors = 0
                clean_count += 1

            # Update UI
            row_idx = record.get("dataset_metadata", {}).get("original_row_index", idx)
            ui.log_task_completion(
                row_idx=row_idx,
                status=status,
                flagged=flagged,
                flagged_categories=flagged_cats,
                highest_category=highest_cat,
                highest_score=highest_score,
                latency_sec=latency,
            )
            ui.update_progress(advance=1)

            # Fail-fast if multiple consecutive API errors occur (e.g. 429 quota / unfunded account)
            if consecutive_errors >= 3:
                last_err = eval_result.get("error_message", "Unknown API error")
                ui.stop_live()
                ui.log_error(f"Halting run: 3 consecutive API errors encountered.")
                ui.log_warning(f"Last error: {last_err}")
                if "429" in last_err:
                    ui.log_warning("OpenAI returned '429 Too Many Requests'. This usually indicates:")
                    ui.log_warning("  1. Your OpenAI account balance is $0.00. Add prepaid credits ($5) at https://platform.openai.com/billing.")
                    ui.log_warning("  2. Your organization has reached its Requests-Per-Minute (RPM) limit.")
                    ui.log_warning("You can diagnose your key by running: python scripts/check_openai_moderation.py")
                ui.log_info("All progress evaluated so far has been safely saved to the checkpoint.")
                break

            if delay_sec > 0:
                time.sleep(delay_sec)

    ui.stop_live()

    total_elapsed = time.time() - start_time
    ui.show_summary(
        total_records=total_records,
        evaluated_now=evaluated_now,
        flagged_count=flagged_count,
        clean_count=clean_count,
        skipped_count=skipped_count,
        error_count=error_count,
        category_breakdown=dict(category_counter),
        elapsed_sec=total_elapsed,
        output_filepath=str(output_path),
    )

    return output_path
