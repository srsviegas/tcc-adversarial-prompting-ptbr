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
