from typing import List, Dict, Any, Optional
import pandas as pd

from src.adapters.base import DatasetAdapter


class EmojiAdapter(DatasetAdapter):
    """
    Adapter for the Emoji Attack dataset (adversarial emoji prompts).
    Tests both plain prompts (query) and adversarial emoji prompts (input_prompt)
    in English and Brazilian Portuguese (pt-BR).
    """

    def __init__(
        self,
        filter_label: str = "all",
        include_raw_emoji: bool = False,
        attack_style_only: bool = False,
    ):
        self.filter_label = filter_label.lower().strip() if filter_label else "all"
        self.include_raw_emoji = include_raw_emoji
        self.attack_style_only = attack_style_only

    def format_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter out rows that do not contain valid English and Portuguese prompts."""
        valid_mask = (
            df["query"].notna() & (df["query"].astype(str).str.strip() != "") &
            df["query_pt"].notna() & (df["query_pt"].astype(str).str.strip() != "") &
            df["input_prompt"].notna() & (df["input_prompt"].astype(str).str.strip() != "") &
            df["input_prompt_pt"].notna() & (df["input_prompt_pt"].astype(str).str.strip() != "")
        )

        if self.filter_label in ("jailbreak", "jailbroken", "success", "1"):
            valid_mask = valid_mask & (df.get("label", 0) == 1)
        elif self.filter_label in ("refusal", "refused", "safe", "0"):
            valid_mask = valid_mask & (df.get("label", 0) == 0)

        return df[valid_mask].copy()

    def get_tests(self, row: pd.Series) -> List[Dict[str, str]]:
        """
        Returns tests for a single row:
        - Plain harmful query in English and Portuguese (pt-BR)
        - Adversarial emoji input prompt in English and Portuguese (pt-BR)
        - Optionally raw emoji prompts if include_raw_emoji is True
        """
        tests = []

        if not self.attack_style_only:
            tests.append({"lang": "en", "style": "plain", "text": str(row["query"]).strip()})

        tests.append({"lang": "en", "style": "emoji", "text": str(row["input_prompt"]).strip()})

        if not self.attack_style_only:
            tests.append({"lang": "pt-BR", "style": "plain", "text": str(row["query_pt"]).strip()})

        tests.append({"lang": "pt-BR", "style": "emoji", "text": str(row["input_prompt_pt"]).strip()})

        if self.include_raw_emoji:
            tests.append({"lang": "en", "style": "raw_emoji", "text": str(row["emoji_prompt"]).strip()})
            tests.append({"lang": "pt-BR", "style": "raw_emoji", "text": str(row["emoji_prompt_pt"]).strip()})

        return tests

    def get_metadata(self, row: pd.Series, dataset_path: str, index: int) -> Dict[str, Any]:
        """Returns metadata for the evaluation log entry."""
        return {
            "source_dataset": dataset_path,
            "original_row_index": index,
            "id": int(row.get("id")) if pd.notna(row.get("id")) else index,
            "label": int(row.get("label")) if pd.notna(row.get("label")) else None,
            "gpt_raw_label": int(row.get("gpt_raw_label")) if pd.notna(row.get("gpt_raw_label")) else None,
            "baseline_model_output": str(row.get("output", "")),
            "raw_emoji_prompt_en": str(row.get("emoji_prompt", "")),
            "raw_emoji_prompt_pt": str(row.get("emoji_prompt_pt", "")),
        }
