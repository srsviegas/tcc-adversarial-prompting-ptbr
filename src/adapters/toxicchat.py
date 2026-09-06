from typing import List, Dict, Any
import pandas as pd

from src.adapters.base import DatasetAdapter


class ToxicChatPlainAdapter(DatasetAdapter):
    """
    Adapter for the ToxicChat dataset configured to run plain user prompts
    in both English and Portuguese (PT-BR) to evaluate model refusal and safety.
    """

    def format_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter out rows without valid English and Portuguese user prompts."""
        valid_mask = (
            df["user_input"].notna() & (df["user_input"].astype(str).str.strip() != "") &
            df["user_input_pt"].notna() & (df["user_input_pt"].astype(str).str.strip() != "")
        )
        return df[valid_mask].copy()

    def get_tests(self, row: pd.Series) -> List[Dict[str, str]]:
        """Returns plain prompt tests for English and Portuguese (PT-BR)."""
        tests = []
        en_text = str(row.get("user_input", "")).strip()
        pt_text = str(row.get("user_input_pt", "")).strip()

        if en_text:
            tests.append({"lang": "en", "style": "plain", "text": en_text})
        if pt_text:
            tests.append({"lang": "pt-BR", "style": "plain", "text": pt_text})

        return tests

    def get_metadata(self, row: pd.Series, dataset_path: str, index: int) -> Dict[str, Any]:
        """Extracts dataset-specific metadata including toxicity and jailbreak labels."""
        return {
            "source_dataset": dataset_path,
            "original_row_index": index,
            "conv_id": str(row.get("conv_id", "")),
            "toxicity": int(row.get("toxicity")) if pd.notna(row.get("toxicity")) else None,
            "jailbreaking": int(row.get("jailbreaking")) if pd.notna(row.get("jailbreaking")) else None,
            "human_annotation": bool(row.get("human_annotation")) if pd.notna(row.get("human_annotation")) else None,
            "openai_moderation": str(row.get("openai_moderation", "")),
            "baseline_model_output": str(row.get("model_output", "")),
        }
