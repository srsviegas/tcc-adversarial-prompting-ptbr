import json
import os
from pathlib import Path

class BenchmarkLogger:

    def __init__(self, log_filename: str):
        self.log_dir = Path(__file__).parent.parent / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.log_filepath = self.log_dir / log_filename
        self.processed_keys = set()
        self._load_existing_checkpoint()


    def _get_unique_key(self, prompt_id: str, model: str, lang: str, style: str, iteration: int) -> str:
        return f"{prompt_id}::{model}::{lang}::{style}::{iteration}"


    def _load_existing_checkpoint(self):
        if not self.log_filepath.exists():
            return
        
        valid_lines = []
        failed_count = 0
        
        with open(self.log_filepath, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)

                    is_failed = record.get("error_log", {}).get("failed", False)
                    if is_failed:
                        failed_count += 1
                        continue

                    pid = record.get("dataset_metadata", {}).get("original_row_index")
                    mname = record.get("model_config", {}).get("model_name")
                    lang = record.get("inputs", {}).get("prompt_language")
                    style = record.get("inputs", {}).get("attack_style")
                    iteration = record.get("run_metadata", {}).get("iteration")
                    
                    if pid is not None and all([mname, lang, style, iteration]):
                        key = self._get_unique_key(pid, mname, lang, style, iteration)
                        self.processed_keys.add(key)
                        valid_lines.append(line if line.endswith("\n") else line + "\n")
                except json.JSONDecodeError:
                    continue

        if failed_count > 0:
            with open(self.log_filepath, "w", encoding="utf-8") as f:
                f.writelines(valid_lines)
            print(f"[*] Checkpoint loaded: {len(self.processed_keys)} successful executions. Found {failed_count} failed execution(s) queued for retry.")
        else:
            print(f"[*] Checkpoint loaded: {len(self.processed_keys)} executions already completed.")


    def is_already_processed(self, prompt_id: str, model: str, lang: str, style: str, iteration: int) -> bool:
        key = self._get_unique_key(prompt_id, model, lang, style, iteration)
        return key in self.processed_keys


    def _json_serializable_default(self, obj):
        if isinstance(obj, bytes):
            try:
                return obj.decode("utf-8")
            except UnicodeDecodeError:
                import base64
                return base64.b64encode(obj).decode("ascii")
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="json")
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        return str(obj)

    def log_result(self, record: dict):
        with open(self.log_filepath, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, default=self._json_serializable_default) + "\n")
            f.flush()
            os.fsync(f.fileno())
        
        is_failed = record.get("error_log", {}).get("failed", False)
        if not is_failed:
            pid = record["dataset_metadata"]["original_row_index"]
            mname = record["model_config"]["model_name"]
            lang = record["inputs"]["prompt_language"]
            style = record["inputs"]["attack_style"]
            iteration = record["run_metadata"]["iteration"]
            
            self.processed_keys.add(self._get_unique_key(pid, mname, lang, style, iteration))