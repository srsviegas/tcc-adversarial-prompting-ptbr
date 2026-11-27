import argparse
import csv
import io
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from rich.console import Console
from rich.table import Table

console = Console(highlight=False, width=None if sys.stdout.isatty() else 220)

# Ordered display names for known models (keys are normalized substrings/prefixes)
KNOWN_MODELS: List[Tuple[str, str]] = [
    ("Meta-Llama-3.1-8B-Instruct", "Meta-Llama-3.1-8B-Instruct"),
    ("DeepSeek-R1-Distill-Qwen-14B", "DeepSeek-R1-Distill-Qwen-14B"),
    ("Qwen3-14B", "Qwen3-14B"),
    ("gemma-4-12B-it", "Gemma-4-12B-it"),
    ("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite"),
]


@dataclass
class StatsBucket:
    """Tracks quorum and dangerous counts for a slice of evaluation records."""

    total_rows: int = 0
    quorum_rows: int = 0
    dangerous: int = 0
    safe: int = 0

    def add(self, has_quorum: bool, is_dangerous: Optional[bool]) -> None:
        self.total_rows += 1
        if not has_quorum:
            return
        self.quorum_rows += 1
        if is_dangerous is True:
            self.dangerous += 1
        elif is_dangerous is False:
            self.safe += 1

    def merge(self, other: "StatsBucket") -> None:
        self.total_rows += other.total_rows
        self.quorum_rows += other.quorum_rows
        self.dangerous += other.dangerous
        self.safe += other.safe

    @property
    def asr(self) -> Optional[float]:
        if self.quorum_rows == 0:
            return None
        return (self.dangerous / self.quorum_rows) * 100.0

    def format_asr(self, include_counts: bool = False) -> str:
        val = self.asr
        if val is None:
            return "N/A"
        if include_counts:
            return f"{val:.2f}% ({self.dangerous}/{self.quorum_rows})"
        return f"{val:.2f}%"


def normalize_lang(raw_lang: str) -> str:
    lower = raw_lang.lower()
    if "pt" in lower:
        return "pt-BR"
    if "en" in lower:
        return "en"
    return raw_lang


def normalize_model_name(filename: str) -> Tuple[int, str]:
    """Returns (sort_order, display_name) for a consensus filename."""
    for idx, (needle, display) in enumerate(KNOWN_MODELS):
        if needle.lower() in filename.lower():
            return idx, display
    # Fallback: strip known dataset suffixes
    stem = Path(filename).stem
    for suffix in ("_pap_internetes_eval", "_pap_eval", "_emoji_eval", "_eval"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    return len(KNOWN_MODELS), stem


def extract_record_parts(record_key: str) -> Tuple[str, str, str, str, str]:
    """Parses record_key of shape pid::model::lang::style::iter."""
    parts = record_key.split("::")
    pid = parts[0] if len(parts) > 0 else ""
    model = parts[1] if len(parts) > 1 else ""
    lang = normalize_lang(parts[2]) if len(parts) > 2 else "other"
    style = parts[3].lower() if len(parts) > 3 else "unknown"
    iteration = parts[4] if len(parts) > 4 else ""
    return pid, model, lang, style, iteration


def aggregate_consensus_file(file_path: Path) -> Dict[Tuple[str, str], StatsBucket]:
    """Aggregates a consensus JSONL file by (lang, style)."""
    buckets: Dict[Tuple[str, str], StatsBucket] = defaultdict(StatsBucket)
    if not file_path.is_file():
        return buckets

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                rec = json.loads(line_str)
            except json.JSONDecodeError:
                continue
            rkey = rec.get("record_key", "")
            _, _, lang, style, _ = extract_record_parts(rkey)
            has_quorum = bool(rec.get("has_quorum", False))
            is_dangerous = rec.get("consensus_dangerous")
            buckets[(lang, style)].add(has_quorum, is_dangerous)

    return buckets


def combine_buckets(
    buckets: Dict[Tuple[str, str], StatsBucket],
    lang: str,
    styles: Optional[List[str]] = None,
) -> StatsBucket:
    """Combines StatsBuckets for a given language and optional list of styles."""
    combined = StatsBucket()
    for (b_lang, b_style), bucket in buckets.items():
        if b_lang != lang:
            continue
        if styles is not None and b_style not in styles:
            continue
        combined.merge(bucket)
    return combined


@dataclass
class TableDefinition:
    name: str
    title: str
    description: str
    columns: List[str]
    builder: Callable[[Path, bool], List[Dict[str, str]]]


TABLE_REGISTRY: Dict[str, TableDefinition] = {}


def register_table(
    name: str,
    title: str,
    description: str,
    columns: List[str],
):
    """Decorator to register a new ASR summary table."""

    def decorator(
        fn: Callable[[Path, bool], List[Dict[str, str]]],
    ) -> Callable[[Path, bool], List[Dict[str, str]]]:
        TABLE_REGISTRY[name] = TableDefinition(
            name=name,
            title=title,
            description=description,
            columns=columns,
            builder=fn,
        )
        return fn

    return decorator


@register_table(
    name="pap_netspeak",
    title="PAP & Netspeak Attack Success Rate (ASR %)",
    description="Malicious percentages across English, Portuguese, and Portuguese Netspeak (plain vs PAP persuasive).",
    columns=[
        "model",
        "en_plain_asr",
        "en_pap_asr",
        "en_asr (total)",
        "pt_plain_asr",
        "pt_pap_asr",
        "pt_asr (total)",
        "netspeak_pt_plain_asr",
        "netspeak_pt_pap_asr",
        "netspeak_pt_asr (total)",
    ],
)
def build_pap_netspeak_table(
    consensus_dir: Path, include_counts: bool = False
) -> List[Dict[str, str]]:
    """Builds rows for the PAP and Netspeak ASR comparison table."""
    pap_files = {
        normalize_model_name(p.name): p
        for p in consensus_dir.glob("*_pap_eval.jsonl")
    }
    netspeak_files = {
        normalize_model_name(p.name): p
        for p in consensus_dir.glob("*_pap_internetes_eval.jsonl")
    }

    all_models = sorted(set(pap_files.keys()) | set(netspeak_files.keys()))
    rows: List[Dict[str, str]] = []

    for model_key in all_models:
        _, display_name = model_key
        pap_buckets = (
            aggregate_consensus_file(pap_files[model_key])
            if model_key in pap_files
            else {}
        )
        net_buckets = (
            aggregate_consensus_file(netspeak_files[model_key])
            if model_key in netspeak_files
            else {}
        )

        en_plain = combine_buckets(pap_buckets, "en", ["plain"])
        en_pap = combine_buckets(pap_buckets, "en", ["persuasive"])
        en_total = combine_buckets(pap_buckets, "en")

        pt_plain = combine_buckets(pap_buckets, "pt-BR", ["plain"])
        pt_pap = combine_buckets(pap_buckets, "pt-BR", ["persuasive"])
        pt_total = combine_buckets(pap_buckets, "pt-BR")

        net_plain = combine_buckets(net_buckets, "pt-BR", ["plain"])
        net_pap = combine_buckets(net_buckets, "pt-BR", ["persuasive"])
        net_total = combine_buckets(net_buckets, "pt-BR")

        rows.append(
            {
                "model": display_name,
                "en_plain_asr": en_plain.format_asr(include_counts),
                "en_pap_asr": en_pap.format_asr(include_counts),
                "en_asr (total)": en_total.format_asr(include_counts),
                "pt_plain_asr": pt_plain.format_asr(include_counts),
                "pt_pap_asr": pt_pap.format_asr(include_counts),
                "pt_asr (total)": pt_total.format_asr(include_counts),
                "netspeak_pt_plain_asr": net_plain.format_asr(include_counts),
                "netspeak_pt_pap_asr": net_pap.format_asr(include_counts),
                "netspeak_pt_asr (total)": net_total.format_asr(include_counts),
            }
        )

    return rows


@register_table(
    name="emoji",
    title="Emoji Attack Success Rate (ASR %)",
    description="Malicious percentages across English and Portuguese (plain vs emoji).",
    columns=[
        "model",
        "en_plain_asr",
        "en_emoji_asr",
        "pt_plain_asr",
        "pt_emoji_asr",
    ],
)
def build_emoji_table(
    consensus_dir: Path, include_counts: bool = False
) -> List[Dict[str, str]]:
    """Builds rows for the Emoji ASR comparison table."""
    emoji_files = {
        normalize_model_name(p.name): p
        for p in consensus_dir.glob("*_emoji_eval.jsonl")
    }

    rows: List[Dict[str, str]] = []
    for model_key in sorted(emoji_files.keys()):
        _, display_name = model_key
        buckets = aggregate_consensus_file(emoji_files[model_key])

        en_plain = combine_buckets(buckets, "en", ["plain"])
        en_emoji = combine_buckets(buckets, "en", ["emoji"])
        pt_plain = combine_buckets(buckets, "pt-BR", ["plain"])
        pt_emoji = combine_buckets(buckets, "pt-BR", ["emoji"])

        rows.append(
            {
                "model": display_name,
                "en_plain_asr": en_plain.format_asr(include_counts),
                "en_emoji_asr": en_emoji.format_asr(include_counts),
                "pt_plain_asr": pt_plain.format_asr(include_counts),
                "pt_emoji_asr": pt_emoji.format_asr(include_counts),
            }
        )

    return rows


STYLIZED_STRATEGIES: List[Tuple[str, str]] = [
    ("bold", "Bold"),
    ("bold_script", "Bold Script"),
    ("double_struck", "Double Struck"),
    ("fraktur", "Fraktur"),
    ("fullwidth", "Fullwidth"),
    ("sans_bold_italic", "Sans Bold Italic"),
    ("script", "Script"),
]


def _make_stylized_builder(
    slug: str,
) -> Callable[[Path, bool], List[Dict[str, str]]]:
    pattern = f"*_toxicchat_stylized_{slug}_eval.jsonl"

    def builder(
        consensus_dir: Path, include_counts: bool = False
    ) -> List[Dict[str, str]]:
        files = {
            normalize_model_name(p.name): p
            for p in consensus_dir.glob(pattern)
        }
        rows: List[Dict[str, str]] = []
        for model_key in sorted(files.keys()):
            _, display_name = model_key
            buckets = aggregate_consensus_file(files[model_key])

            en_bucket = combine_buckets(buckets, "en")
            pt_bucket = combine_buckets(buckets, "pt-BR")
            total_bucket = StatsBucket()
            total_bucket.merge(en_bucket)
            total_bucket.merge(pt_bucket)

            en_val = en_bucket.asr
            pt_val = pt_bucket.asr
            if en_val is not None and pt_val is not None:
                delta = pt_val - en_val
                delta_str = f"{delta:+.2f}%"
            else:
                delta_str = "N/A"

            rows.append(
                {
                    "model": display_name,
                    "en_asr": en_bucket.format_asr(include_counts),
                    "pt_asr": pt_bucket.format_asr(include_counts),
                    "delta (pt - en)": delta_str,
                    "total_asr": total_bucket.format_asr(include_counts),
                }
            )
        return rows

    return builder


def _register_stylized_tables() -> None:
    for slug, label in STYLIZED_STRATEGIES:
        register_table(
            name=f"stylized_{slug}",
            title=f"Stylized ({label}) Attack Success Rate (ASR %)",
            description=f"Malicious percentages for ToxicChat stylized ({label}) across English and Portuguese.",
            columns=["model", "en_asr", "pt_asr", "delta (pt - en)", "total_asr"],
        )(_make_stylized_builder(slug))


_register_stylized_tables()


@register_table(
    name="stylized_summary",
    title="Stylized Unicode Summary (Total ASR & Delta pt-en)",
    description="Cross-model summary of Total ASR and Delta (pt - en) across stylized fonts.",
    columns=[
        "style",
        "llama_asr",
        "deepseek_asr",
        "qwen_asr",
        "gemma_asr",
        "gemini_asr",
        "overall_mean",
    ],
)
def build_stylized_summary_table(
    consensus_dir: Path, include_counts: bool = False
) -> List[Dict[str, str]]:
    """Builds a compact summary table comparing all stylized fonts across models."""
    rows: List[Dict[str, str]] = []
    model_totals: Dict[str, List[float]] = defaultdict(list)

    for slug, label in STYLIZED_STRATEGIES:
        pattern = f"*_toxicchat_stylized_{slug}_eval.jsonl"
        files = {
            normalize_model_name(p.name): p
            for p in consensus_dir.glob(pattern)
        }
        row_dict: Dict[str, str] = {"style": label}
        style_asrs: List[float] = []

        for model_key in sorted(files.keys()):
            _, display_name = model_key
            buckets = aggregate_consensus_file(files[model_key])
            en_bucket = combine_buckets(buckets, "en")
            pt_bucket = combine_buckets(buckets, "pt-BR")
            total_bucket = StatsBucket()
            total_bucket.merge(en_bucket)
            total_bucket.merge(pt_bucket)

            tot_val = total_bucket.asr
            en_val = en_bucket.asr
            pt_val = pt_bucket.asr

            if tot_val is not None:
                style_asrs.append(tot_val)
                model_totals[display_name].append(tot_val)

            if en_val is not None and pt_val is not None and tot_val is not None:
                delta = pt_val - en_val
                cell_str = f"{tot_val:.1f}% ({delta:+.1f}%)"
            elif tot_val is not None:
                cell_str = f"{tot_val:.1f}%"
            else:
                cell_str = "N/A"

            if "llama" in display_name.lower():
                row_dict["llama_asr"] = cell_str
            elif "deepseek" in display_name.lower():
                row_dict["deepseek_asr"] = cell_str
            elif "qwen" in display_name.lower():
                row_dict["qwen_asr"] = cell_str
            elif "gemma" in display_name.lower():
                row_dict["gemma_asr"] = cell_str
            elif "gemini" in display_name.lower():
                row_dict["gemini_asr"] = cell_str

        mean_val = (sum(style_asrs) / len(style_asrs)) if style_asrs else 0.0
        row_dict["overall_mean"] = f"{mean_val:.1f}%"
        rows.append(row_dict)

    # Average row
    avg_row: Dict[str, str] = {"style": "Average"}
    all_means: List[float] = []
    for dname, vals in model_totals.items():
        if vals:
            m_avg = sum(vals) / len(vals)
            all_means.append(m_avg)
            m_str = f"{m_avg:.1f}%"
        else:
            m_str = "N/A"

        if "llama" in dname.lower():
            avg_row["llama_asr"] = m_str
        elif "deepseek" in dname.lower():
            avg_row["deepseek_asr"] = m_str
        elif "qwen" in dname.lower():
            avg_row["qwen_asr"] = m_str
        elif "gemma" in dname.lower():
            avg_row["gemma_asr"] = m_str
        elif "gemini" in dname.lower():
            avg_row["gemini_asr"] = m_str

    overall = sum(all_means) / len(all_means) if all_means else 0.0
    avg_row["overall_mean"] = f"{overall:.1f}%"
    rows.append(avg_row)

    return rows


CIPHER_STRATEGIES: List[Tuple[str, str]] = [
    ("base64", "Base64"),
    ("rot13", "ROT13"),
    ("hex", "Hexadecimal"),
    ("caesar", "Caesar"),
    ("leetspeak", "Leetspeak"),
]

MIN_CIPHER_CONVERGENCE_ROWS = 200
MIN_CIPHER_QUORUM_ROWS = 50
MIN_CIPHER_TABLE_QUORUM = 700


def _make_cipher_builder(
    slug: str,
) -> Callable[[Path, bool], List[Dict[str, str]]]:
    pattern = f"*_toxicchat_{slug}_eval.jsonl"

    def builder(
        consensus_dir: Path, include_counts: bool = False
    ) -> List[Dict[str, str]]:
        files = {
            normalize_model_name(p.name): p
            for p in consensus_dir.glob(pattern)
        }
        rows: List[Dict[str, str]] = []
        for model_key in sorted(files.keys()):
            _, display_name = model_key
            filepath = files[model_key]
            buckets = aggregate_consensus_file(filepath)

            total_lines = 0
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        total_lines += 1

            en_bucket = combine_buckets(buckets, "en")
            pt_bucket = combine_buckets(buckets, "pt-BR")
            total_bucket = StatsBucket()
            total_bucket.merge(en_bucket)
            total_bucket.merge(pt_bucket)

            instances_str = f"{total_bucket.quorum_rows}/{total_lines}"

            # Check convergence
            if total_lines < MIN_CIPHER_CONVERGENCE_ROWS or total_bucket.quorum_rows < MIN_CIPHER_QUORUM_ROWS:
                rows.append(
                    {
                        "model": display_name,
                        "en_asr": "No Convergence",
                        "pt_asr": "No Convergence",
                        "delta (pt - en)": "N/A",
                        "total_asr": "No Convergence",
                        "instances": instances_str,
                    }
                )
                continue

            en_val = en_bucket.asr
            pt_val = pt_bucket.asr
            if en_val is not None and pt_val is not None:
                delta = pt_val - en_val
                delta_str = f"{delta:+.2f}%"
            else:
                delta_str = "N/A"

            rows.append(
                {
                    "model": display_name,
                    "en_asr": en_bucket.format_asr(include_counts),
                    "pt_asr": pt_bucket.format_asr(include_counts),
                    "delta (pt - en)": delta_str,
                    "total_asr": total_bucket.format_asr(include_counts),
                    "instances": instances_str,
                }
            )
        return rows

    return builder


def _register_cipher_tables() -> None:
    for slug, label in CIPHER_STRATEGIES:
        register_table(
            name=f"cipher_{slug}",
            title=f"Cipher ({label}) Attack Success Rate (ASR %)",
            description=f"Malicious percentages for ToxicChat cipher ({label}) across English and Portuguese.",
            columns=["model", "en_asr", "pt_asr", "delta (pt - en)", "total_asr", "instances"],
        )(_make_cipher_builder(slug))


_register_cipher_tables()


@register_table(
    name="cipher_summary",
    title="Cipher Obfuscation Summary (ASR, Language-Stratified Means, and Instances N)",
    description="Cross-model summary of Total ASR, Delta (pt - en), and language-stratified means (EN / PT) for converged columns (quorum >= 700).",
    columns=[
        "cipher",
        "llama_asr",
        "deepseek_asr",
        "qwen_asr",
        "gemma_asr",
        "gemini_asr",
        "en_mean",
        "pt_mean",
    ],
)
def build_cipher_summary_table(
    consensus_dir: Path, include_counts: bool = False
) -> List[Dict[str, str]]:
    """Builds a compact summary table comparing all cipher strategies across models with language-stratified means."""
    rows: List[Dict[str, str]] = []
    model_en_totals: Dict[str, List[float]] = defaultdict(list)
    model_pt_totals: Dict[str, List[float]] = defaultdict(list)
    model_totals: Dict[str, List[float]] = defaultdict(list)
    model_instance_totals: Dict[str, int] = defaultdict(int)
    all_row_en_means: List[float] = []
    all_row_pt_means: List[float] = []

    for slug, label in CIPHER_STRATEGIES:
        pattern = f"*_toxicchat_{slug}_eval.jsonl"
        files = {
            normalize_model_name(p.name): p
            for p in consensus_dir.glob(pattern)
        }
        row_dict: Dict[str, str] = {"cipher": label}
        cipher_en_asrs: List[float] = []
        cipher_pt_asrs: List[float] = []

        for model_key in sorted(files.keys()):
            _, display_name = model_key
            filepath = files[model_key]
            buckets = aggregate_consensus_file(filepath)

            en_bucket = combine_buckets(buckets, "en")
            pt_bucket = combine_buckets(buckets, "pt-BR")
            total_bucket = StatsBucket()
            total_bucket.merge(en_bucket)
            total_bucket.merge(pt_bucket)

            q_count = total_bucket.quorum_rows
            if q_count < MIN_CIPHER_TABLE_QUORUM:
                cell_str = f"--% (N={q_count})"
            else:
                tot_val = total_bucket.asr
                en_val = en_bucket.asr
                pt_val = pt_bucket.asr

                if en_val is not None:
                    cipher_en_asrs.append(en_val)
                    model_en_totals[display_name].append(en_val)
                if pt_val is not None:
                    cipher_pt_asrs.append(pt_val)
                    model_pt_totals[display_name].append(pt_val)
                if tot_val is not None:
                    model_totals[display_name].append(tot_val)
                    model_instance_totals[display_name] += q_count

                if en_val is not None and pt_val is not None and tot_val is not None:
                    delta = pt_val - en_val
                    cell_str = f"{tot_val:.1f}% ({delta:+.1f}%) [N={q_count}]"
                elif tot_val is not None:
                    cell_str = f"{tot_val:.1f}% [N={q_count}]"
                else:
                    cell_str = "N/A"

            if "llama" in display_name.lower():
                row_dict["llama_asr"] = cell_str
            elif "deepseek" in display_name.lower():
                row_dict["deepseek_asr"] = cell_str
            elif "qwen" in display_name.lower():
                row_dict["qwen_asr"] = cell_str
            elif "gemma" in display_name.lower():
                row_dict["gemma_asr"] = cell_str
            elif "gemini" in display_name.lower():
                row_dict["gemini_asr"] = cell_str

        en_mean = (sum(cipher_en_asrs) / len(cipher_en_asrs)) if cipher_en_asrs else None
        pt_mean = (sum(cipher_pt_asrs) / len(cipher_pt_asrs)) if cipher_pt_asrs else None
        if en_mean is not None:
            all_row_en_means.append(en_mean)
            row_dict["en_mean"] = f"{en_mean:.1f}%"
        else:
            row_dict["en_mean"] = "--%"
        if pt_mean is not None:
            all_row_pt_means.append(pt_mean)
            row_dict["pt_mean"] = f"{pt_mean:.1f}%"
        else:
            row_dict["pt_mean"] = "--%"
        rows.append(row_dict)

    # Average row
    avg_row: Dict[str, str] = {"cipher": "Model Average"}
    for _, dname in KNOWN_MODELS:
        vals = model_totals.get(dname, [])
        if vals:
            m_avg = sum(vals) / len(vals)
            m_str = f"{m_avg:.1f}% [N={model_instance_totals[dname]}]"
        else:
            m_str = "--%"

        if "llama" in dname.lower():
            avg_row["llama_asr"] = m_str
        elif "deepseek" in dname.lower():
            avg_row["deepseek_asr"] = m_str
        elif "qwen" in dname.lower():
            avg_row["qwen_asr"] = m_str
        elif "gemma" in dname.lower():
            avg_row["gemma_asr"] = m_str
        elif "gemini" in dname.lower():
            avg_row["gemini_asr"] = m_str

    avg_row["en_mean"] = f"{sum(all_row_en_means) / len(all_row_en_means):.1f}%" if all_row_en_means else "--%"
    avg_row["pt_mean"] = f"{sum(all_row_pt_means) / len(all_row_pt_means):.1f}%" if all_row_pt_means else "--%"
    rows.append(avg_row)

    return rows


def format_cipher_latex(consensus_dir: Path) -> str:
    """Generates the full-width LaTeX table* for cipher obfuscation stratified by EN and PT."""
    model_order = [
        ("Meta-Llama-3.1-8B-Instruct", "Llama 3.1"),
        ("DeepSeek-R1-Distill-Qwen-14B", "DeepSeek-R1"),
        ("Qwen3-14B", "Qwen3"),
        ("gemma-4-12B-it", "Gemma 4"),
        ("gemini-3.5-flash-lite", "Gemini 3.5 Lite"),
    ]
    model_en_lists: Dict[str, List[float]] = defaultdict(list)
    model_pt_lists: Dict[str, List[float]] = defaultdict(list)
    row_en_means: List[float] = []
    row_pt_means: List[float] = []

    latex_rows: List[str] = []

    for slug, label in CIPHER_STRATEGIES:
        pattern = f"*_toxicchat_{slug}_eval.jsonl"
        files = {
            normalize_model_name(p.name): p
            for p in consensus_dir.glob(pattern)
        }
        cells: List[str] = []
        row_en_vals: List[float] = []
        row_pt_vals: List[float] = []

        for needle, _ in model_order:
            matched_file = None
            for (_, dname), fpath in files.items():
                if needle.lower() in fpath.name.lower() or needle.lower() == dname.lower():
                    matched_file = fpath
                    break

            if not matched_file:
                cells.extend(["--\\%", "--\\%"])
                continue

            buckets = aggregate_consensus_file(matched_file)
            en_bucket = combine_buckets(buckets, "en")
            pt_bucket = combine_buckets(buckets, "pt-BR")
            total_bucket = StatsBucket()
            total_bucket.merge(en_bucket)
            total_bucket.merge(pt_bucket)

            if total_bucket.quorum_rows < MIN_CIPHER_TABLE_QUORUM:
                cells.extend(["--\\%", "--\\%"])
            else:
                en_val = en_bucket.asr
                pt_val = pt_bucket.asr
                if en_val is not None:
                    row_en_vals.append(en_val)
                    model_en_lists[needle].append(en_val)
                    cells.append(f"{en_val:.1f}\\%")
                else:
                    cells.append("--\\%")

                if pt_val is not None:
                    row_pt_vals.append(pt_val)
                    model_pt_lists[needle].append(pt_val)
                    cells.append(f"{pt_val:.1f}\\%")
                else:
                    cells.append("--\\%")

        if row_en_vals:
            r_en = sum(row_en_vals) / len(row_en_vals)
            row_en_means.append(r_en)
            cells.append(f"{r_en:.1f}\\%")
        else:
            cells.append("--\\%")

        if row_pt_vals:
            r_pt = sum(row_pt_vals) / len(row_pt_vals)
            row_pt_means.append(r_pt)
            cells.append(f"{r_pt:.1f}\\%")
        else:
            cells.append("--\\%")

        latex_rows.append(f"{label:<11} & " + " & ".join(cells) + r" \\")

    # Model Average row
    avg_cells: List[str] = []
    partial_notes: List[str] = []
    for needle, short_name in model_order:
        en_l = model_en_lists[needle]
        pt_l = model_pt_lists[needle]
        if not en_l:
            avg_cells.extend([r"\textbf{--\%}", r"\textbf{--\%}"])
        else:
            suffix = r"\textsuperscript{*}" if len(en_l) < len(CIPHER_STRATEGIES) else ""
            if suffix:
                converged_names = []
                # Determine which ciphers converged for this model
                for slug, clabel in CIPHER_STRATEGIES:
                    flist = list(consensus_dir.glob(f"*{needle}*_toxicchat_{slug}_eval.jsonl"))
                    if flist:
                        b = aggregate_consensus_file(flist[0])
                        tb = StatsBucket()
                        tb.merge(combine_buckets(b, "en"))
                        tb.merge(combine_buckets(b, "pt-BR"))
                        if tb.quorum_rows >= MIN_CIPHER_TABLE_QUORUM:
                            converged_names.append(clabel)
                partial_notes.append(f"{short_name} ({', '.join(converged_names)})")

            avg_cells.append(rf"\textbf{{{sum(en_l)/len(en_l):.1f}\%}}{suffix}")
            avg_cells.append(rf"\textbf{{{sum(pt_l)/len(pt_l):.1f}\%}}{suffix}")

    if row_en_means:
        avg_cells.append(rf"\textbf{{{sum(row_en_means)/len(row_en_means):.1f}\%}}")
    else:
        avg_cells.append(r"\textbf{--\%}")
    if row_pt_means:
        avg_cells.append(rf"\textbf{{{sum(row_pt_means)/len(row_pt_means):.1f}\%}}")
    else:
        avg_cells.append(r"\textbf{--\%}")

    avg_line = r"\textbf{Model Average} & " + " & ".join(avg_cells) + r" \\"

    lines = [
        r"\begin{table*}[htbp]",
        r"\centering",
        r"\small",
        r"\caption{ASR across cipher obfuscation channels.}",
        r"\label{tab:res_cipher}",
        r"\resizebox{\textwidth}{!}{%",
        r"\begin{tabular}{l cc cc cc cc cc cc}",
        r"\toprule",
        r"& \multicolumn{2}{c}{\textbf{Llama 3.1}} ",
        r"& \multicolumn{2}{c}{\textbf{DeepSeek-R1}} ",
        r"& \multicolumn{2}{c}{\textbf{Qwen3}} ",
        r"& \multicolumn{2}{c}{\textbf{Gemma 4}} ",
        r"& \multicolumn{2}{c}{\textbf{Gemini 3.5 Lite}} ",
        r"& \multicolumn{2}{c}{\textbf{Overall Mean}} \\",
        r"\cmidrule(lr){2-3} \cmidrule(lr){4-5} \cmidrule(lr){6-7} \cmidrule(lr){8-9} \cmidrule(lr){10-11} \cmidrule(lr){12-13}",
        r"\textbf{Cipher Strategy} & \textbf{EN} & \textbf{PT} & \textbf{EN} & \textbf{PT} & \textbf{EN} & \textbf{PT} & \textbf{EN} & \textbf{PT} & \textbf{EN} & \textbf{PT} & \textbf{EN} & \textbf{PT} \\",
        r"\midrule",
        *latex_rows,
        r"\midrule",
        avg_line,
        r"\bottomrule",
        rf"\multicolumn{{13}}{{l}}{{\footnotesize \textit{{Note:}} Cells with fewer than {MIN_CIPHER_TABLE_QUORUM} valid converged instances are omitted ($--\%$) due to decoding convergence failures.}} \\",
    ]
    if partial_notes:
        lines.append(
            rf"\multicolumn{{13}}{{l}}{{\footnotesize \textsuperscript{{*}} Computed across the converged strategies for {', '.join(partial_notes)}.}} \\"
        )
    lines.extend([
        r"\end{tabular}%",
        r"}",
        r"\end{table*}",
    ])
    return "\n".join(lines)


def render_rich_table(table_def: TableDefinition, rows: List[Dict[str, str]]) -> None:
    table = Table(title=table_def.title, show_lines=True)
    for idx, col in enumerate(table_def.columns):
        justify = "left" if idx == 0 else "right"
        style = "bold cyan" if idx == 0 else None
        table.add_column(col, justify=justify, style=style, no_wrap=(idx == 0))

    for row in rows:
        table.add_row(*[row.get(col, "N/A") for col in table_def.columns])

    console.print(table)


def format_markdown(table_def: TableDefinition, rows: List[Dict[str, str]]) -> str:
    lines = [f"### {table_def.title}", ""]
    header = "| " + " | ".join(table_def.columns) + " |"
    sep = "| " + " | ".join(["---" if i == 0 else "---:" for i in range(len(table_def.columns))]) + " |"
    lines.extend([header, sep])
    for row in rows:
        vals = [row.get(col, "N/A") for col in table_def.columns]
        lines.append("| " + " | ".join(vals) + " |")
    return "\n".join(lines)


def format_csv(table_def: TableDefinition, rows: List[Dict[str, str]]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=table_def.columns)
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def format_generic_latex(table_def: TableDefinition, rows: List[Dict[str, str]]) -> str:
    col_spec = "l " + " ".join(["r"] * (len(table_def.columns) - 1))
    headers = " & ".join(rf"\textbf{{{c.replace('_', ' ')}}}" for c in table_def.columns)
    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        r"\small",
        rf"\caption{{{table_def.title}}}",
        rf"\label{{tab:{table_def.name}}}",
        rf"\begin{{tabular}}{{{col_spec}}}",
        r"\toprule",
        headers + r" \\",
        r"\midrule",
    ]
    for row in rows:
        vals = [str(row.get(c, "N/A")).replace("%", r"\%") for c in table_def.columns]
        lines.append(" & ".join(vals) + r" \\")
    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calculate malicious percentages (ASR) from consensus evaluation files."
    )
    parser.add_argument(
        "--consensus-dir",
        "-d",
        type=Path,
        default=Path("evaluations/consensus"),
        help="Directory containing consensus JSONL files (default: evaluations/consensus).",
    )
    parser.add_argument(
        "--table",
        "-t",
        choices=[*TABLE_REGISTRY.keys(), "stylized", "cipher", "all"],
        default="all",
        help="Which table(s) to compute (default: all; 'stylized' runs all stylized_* tables, 'cipher' runs all cipher_* tables).",
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["table", "markdown", "csv", "json", "latex"],
        default="table",
        help="Output format (default: table).",
    )
    parser.add_argument(
        "--counts",
        "-c",
        action="store_true",
        help="Include (dangerous/quorum) counts alongside percentages.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        help="Optional file path to write the formatted output.",
    )
    args = parser.parse_args()

    if not args.consensus_dir.is_dir():
        console.print(f"[red]Consensus directory not found: {args.consensus_dir}[/red]")
        sys.exit(1)

    if args.table == "all":
        selected_names = list(TABLE_REGISTRY.keys())
    elif args.table == "stylized":
        selected_names = [
            name for name in TABLE_REGISTRY.keys() if name.startswith("stylized_")
        ]
    elif args.table == "cipher":
        selected_names = [
            name for name in TABLE_REGISTRY.keys() if name.startswith("cipher_")
        ]
    else:
        selected_names = [args.table]

    output_chunks: List[str] = []
    json_payload: Dict[str, List[Dict[str, str]]] = {}

    for name in selected_names:
        table_def = TABLE_REGISTRY[name]
        rows = table_def.builder(args.consensus_dir, args.counts)

        if args.format == "table":
            render_rich_table(table_def, rows)
        elif args.format == "markdown":
            output_chunks.append(format_markdown(table_def, rows))
        elif args.format == "csv":
            output_chunks.append(format_csv(table_def, rows))
        elif args.format == "json":
            json_payload[name] = rows
        elif args.format == "latex":
            if name == "cipher_summary":
                output_chunks.append(format_cipher_latex(args.consensus_dir))
            else:
                output_chunks.append(format_generic_latex(table_def, rows))

    if args.format == "json":
        text_out = json.dumps(json_payload, indent=2, ensure_ascii=False)
    else:
        text_out = "\n\n".join(output_chunks)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text_out, encoding="utf-8")
        console.print(f"[green]Saved output to {args.output}[/green]")
    elif text_out:
        print(text_out)


if __name__ == "__main__":
    main()
