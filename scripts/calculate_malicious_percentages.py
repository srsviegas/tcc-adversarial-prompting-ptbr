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
    ("regional_indicator", "Regional Indicator"),
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

            rows.append(
                {
                    "model": display_name,
                    "en_asr": en_bucket.format_asr(include_counts),
                    "pt_asr": pt_bucket.format_asr(include_counts),
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
            columns=["model", "en_asr", "pt_asr", "total_asr"],
        )(_make_stylized_builder(slug))


_register_stylized_tables()


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
        choices=[*TABLE_REGISTRY.keys(), "stylized", "all"],
        default="all",
        help="Which table(s) to compute (default: all; 'stylized' runs all stylized_* tables).",
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["table", "markdown", "csv", "json"],
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
