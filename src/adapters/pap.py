from typing import List, Dict, Any
import pandas as pd

from src.adapters.base import DatasetAdapter


class PAPAdapter(DatasetAdapter):
    """Adapter for the Persuasive Adversarial Prompts (PAP) dataset."""

    def format_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter out rows that do not contain valid persuasive PAP prompts."""
        valid_mask = (
            df["bad_q"].notna() & (df["bad_q"].astype(str).str.strip() != "") &
            df["ss_prompt"].notna() & (df["ss_prompt"].astype(str).str.strip() != "") &
            df["bad_q_pt"].notna() & (df["bad_q_pt"].astype(str).str.strip() != "") &
            df["ss_prompt_pt"].notna() & (df["ss_prompt_pt"].astype(str).str.strip() != "")
        )
        return df[valid_mask].copy()

    def get_tests(self, row: pd.Series) -> List[Dict[str, str]]:
        return [
            {"lang": "en",    "style": "plain",      "text": str(row["bad_q"]).strip()},
            {"lang": "en",    "style": "persuasive", "text": str(row["ss_prompt"]).strip()},
            {"lang": "pt-BR", "style": "plain",      "text": str(row["bad_q_pt"]).strip()},
            {"lang": "pt-BR", "style": "persuasive", "text": str(row["ss_prompt_pt"]).strip()}
        ]

    def get_metadata(self, row: pd.Series, dataset_path: str, index: int) -> Dict[str, Any]:
        return {
            "source_dataset": dataset_path,
            "original_row_index": index,
            "attack_category": row.get("ss_category", ""),
            "baseline_refusal_en": row.get("ori_output", ""),
            "baseline_jailbreak_en": row.get("jb_output", "")
        }
