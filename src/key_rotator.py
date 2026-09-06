import os
import re
import json
import threading
from typing import List, Optional, Union


class KeyRotator:
    """
    Modular API key manager and round-robin rotator.
    Supports single keys and key pools loaded from parameters or environment variables.
    """

    def __init__(
        self,
        keys: Optional[Union[str, List[str]]] = None,
        env_var_name: str = "GEMINI_API_KEYS",
        fallback_env_var: str = "GEMINI_API_KEY",
    ):
        self._lock = threading.Lock()
        self.env_var_name = env_var_name
        self.fallback_env_var = fallback_env_var
        self._keys: List[str] = self._resolve_keys(keys)
        self._current_idx: int = 0

    @classmethod
    def _parse_key_string(cls, raw: str) -> List[str]:
        """Parses a string containing one or multiple keys."""
        if not raw:
            return []
        raw = raw.strip()

        # ["key1", "key2"]
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(k).strip() for k in parsed if str(k).strip()]
            except json.JSONDecodeError:
                # [key1, key2, key3]
                inner = raw[1:-1].strip()
                tokens = [t.strip().strip("'\"") for t in inner.split(",")]
                return [t for t in tokens if t]

        # Separators
        if any(sep in raw for sep in [",", ";", "\n"]):
            tokens = re.split(r"[,;\n]+", raw)
            return [t.strip().strip("'\"") for t in tokens if t.strip()]

        # Single key string
        return [raw.strip().strip("'\"")] if raw.strip() else []

    def _resolve_keys(self, keys: Optional[Union[str, List[str]]]) -> List[str]:
        """Resolves key list from input argument or environment variables."""
        if keys is not None:
            if isinstance(keys, list):
                resolved = [str(k).strip() for k in keys if str(k).strip()]
            elif isinstance(keys, str):
                resolved = self._parse_key_string(keys)
            else:
                resolved = []
            if resolved:
                return resolved

        env_keys_raw = os.environ.get(self.env_var_name)
        if env_keys_raw:
            resolved = self._parse_key_string(env_keys_raw)
            if resolved:
                return resolved

        env_single_key = os.environ.get(self.fallback_env_var)
        if env_single_key:
            resolved = self._parse_key_string(env_single_key)
            if resolved:
                return resolved

        return []

    @property
    def total_keys(self) -> int:
        """Returns the total number of currently available keys."""
        with self._lock:
            return len(self._keys)

    @property
    def is_multi_key(self) -> bool:
        """Returns True if there are multiple keys in rotation."""
        with self._lock:
            return len(self._keys) > 1

    def get_next_key(self) -> Optional[str]:
        """
        Retrieves the next key in the round-robin cycle.
        Returns None if no keys are available.
        """
        with self._lock:
            if not self._keys:
                return None

            key = self._keys[self._current_idx % len(self._keys)]
            self._current_idx = (self._current_idx + 1) % len(self._keys)
            return key

    def peek_current_key(self) -> Optional[str]:
        """Returns the current key without advancing the round-robin pointer."""
        with self._lock:
            if not self._keys:
                return None
            return self._keys[self._current_idx % len(self._keys)]

    def mark_exhausted(self, key: str) -> bool:
        """
        Removes an exhausted key from the active pool.
        Returns True if active keys remain, False if the pool is now empty.
        """
        with self._lock:
            if key in self._keys:
                idx = self._keys.index(key)
                self._keys.remove(key)
                if self._keys:
                    if idx < self._current_idx:
                        self._current_idx -= 1
                    self._current_idx = self._current_idx % len(self._keys)
                else:
                    self._current_idx = 0

            return len(self._keys) > 0

    @staticmethod
    def mask_key(key: Optional[str]) -> str:
        """Returns a safe masked version of an API key for logs (e.g. '...a1b2')."""
        if not key:
            return "<none>"
        key_str = str(key)
        if len(key_str) <= 8:
            return f"...{key_str[-4:]}"
        return f"{key_str[:4]}...{key_str[-4:]}"
