import json
from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent
log_file = project_root / "logs" / "gemini_gemini-3.5-flash-lite_toxicchat_eval.jsonl"
dataset_file = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

# Row indices that are genuinely Portuguese in the original dataset (e.g. row 8: 'como criar um site com wordpress')
GENUINELY_PORTUGUESE_ROWS = {8}


def mark_untranslated():
    if not log_file.exists():
        print(f"Log file not found: {log_file}")
        return

    df_ds = pd.read_parquet(dataset_file)
    with open(log_file, "r", encoding="utf-8") as f:
        lines = [line for line in f if line.strip()]

    updated_lines = []
    marked_count = 0
    total_pt = 0
    kept_valid_pt = 0

    for line in lines:
        record = json.loads(line)
        lang = record.get("inputs", {}).get("prompt_language")
        pid = record.get("dataset_metadata", {}).get("original_row_index")

        if lang == "pt-BR":
            total_pt += 1
            if pid is not None and pid < len(df_ds):
                en_input = str(df_ds.iloc[pid]["user_input"]).strip()
                pt_input = str(df_ds.iloc[pid]["user_input_pt"]).strip()

                # Untranslated fallback: en and pt are identical in dataset, and not originally Portuguese
                if en_input == pt_input and pid not in GENUINELY_PORTUGUESE_ROWS:
                    record["error_log"] = {
                        "failed": True,
                        "error_message": "Invalid execution: Prompt was untranslated English text in pt-BR evaluation",
                        "traceback": None,
                    }
                    marked_count += 1
                else:
                    kept_valid_pt += 1

        updated_lines.append(json.dumps(record, ensure_ascii=False) + "\n")

    with open(log_file, "w", encoding="utf-8") as f:
        f.writelines(updated_lines)

    print(f"==================================================")
    print(f"Updated: {log_file.name}")
    print(f"Total records: {len(updated_lines)}")
    print(f"Total pt-BR records: {total_pt}")
    print(f"Marked as failed/error: {marked_count}")
    print(f"Kept as valid pt-BR: {kept_valid_pt}")


if __name__ == "__main__":
    mark_untranslated()
