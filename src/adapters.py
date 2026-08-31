from typing import List, Dict, Any
import pandas as pd

class DatasetAdapter:
    """Base adapter class for dataset handling."""
    
    def format_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Optional pre-processing step for the dataset.
        Useful if a specific test needs to run an algorithm to format the data.
        """
        return df

    def get_tests(self, row: pd.Series) -> List[Dict[str, str]]:
        """
        Returns a list of test cases for a single row.
        Each test must be a dict with at least 'lang', 'style', and 'text'.
        """
        raise NotImplementedError("Subclasses must implement get_tests")

    def get_metadata(self, row: pd.Series, dataset_path: str, index: int) -> Dict[str, Any]:
        """
        Returns dataset-specific metadata to be included in the log payload.
        """
        raise NotImplementedError("Subclasses must implement get_metadata")


class PAPAdapter(DatasetAdapter):
    """Adapter for the PAP dataset."""

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


def get_adapter(dataset_type: str) -> DatasetAdapter:
    """Factory function to get the appropriate adapter."""
    dataset_type = dataset_type.lower().strip()
    if dataset_type == "pap":
        return PAPAdapter()
    else:
        raise ValueError(f"Unknown dataset type: {dataset_type}")
