from typing import List, Dict, Any
import pandas as pd

from src.adapters.base import DatasetAdapter


class PAPInternetesAdapter(DatasetAdapter):
    """
    Adapter for the Brazilian Portuguese Internetês Persuasive Adversarial Prompts (PAP) dataset.
    Tests each prompt in plain internetês and persuasive (PAP) internetês (PT-BR only).
    """

    def format_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter out rows that do not contain valid plain and persuasive internetes prompts."""
        bad_q_col = "bad_q_pt_internetes" if "bad_q_pt_internetes" in df.columns else "bad_q_internetes"
        ss_col = "ss_prompt_pt_internetes" if "ss_prompt_pt_internetes" in df.columns else "ss_prompt_internetes"

        if bad_q_col not in df.columns or ss_col not in df.columns:
            raise KeyError(
                f"Required internetes columns not found in dataset. "
                f"Expected '{bad_q_col}' and '{ss_col}'. Available columns: {list(df.columns)}"
            )

        valid_mask = (
            df[bad_q_col].notna() & (df[bad_q_col].astype(str).str.strip() != "") &
            df[ss_col].notna() & (df[ss_col].astype(str).str.strip() != "")
        )
        return df[valid_mask].copy()

    def get_tests(self, row: pd.Series) -> List[Dict[str, str]]:
        bad_q_text = str(row.get("bad_q_pt_internetes") or row.get("bad_q_internetes") or "").strip()
        ss_text = str(row.get("ss_prompt_pt_internetes") or row.get("ss_prompt_internetes") or "").strip()

        return [
            {"lang": "pt-BR", "style": "plain", "text": bad_q_text},
            {"lang": "pt-BR", "style": "persuasive", "text": ss_text},
        ]

    def get_metadata(self, row: pd.Series, dataset_path: str, index: int) -> Dict[str, Any]:
        return {
            "source_dataset": dataset_path,
            "original_row_index": row.get("row_index", index),
            "attack_category": row.get("ss_category", ""),
            "baseline_refusal_en": row.get("ori_output", ""),
            "baseline_jailbreak_en": row.get("jb_output", ""),
            "bad_q_pt": row.get("bad_q_pt", ""),
            "ss_prompt_pt": row.get("ss_prompt_pt", ""),
            "bad_q_pt_internetes": row.get("bad_q_pt_internetes") or row.get("bad_q_internetes", ""),
            "ss_prompt_pt_internetes": row.get("ss_prompt_pt_internetes") or row.get("ss_prompt_internetes", ""),
            "translation_model": row.get("translation_model", ""),
        }
