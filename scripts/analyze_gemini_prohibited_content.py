import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from rich.console import Console
from rich.table import Table

console = Console(highlight=False, width=None if sys.stdout.isatty() else 220)


@dataclass
class BlockStats:
    """Tracks total runs and PROHIBITED_CONTENT guardrail blocks (input vs output)."""

    total: int = 0
    input_blocked: int = 0
    output_blocked: int = 0
    consensus_quorum: int = 0
    consensus_safe: int = 0
    consensus_dangerous: int = 0
    blocked_in_quorum: int = 0

    @property
    def total_blocked(self) -> int:
        return self.input_blocked + self.output_blocked

    @property
    def blocked_pct(self) -> float:
        return (self.total_blocked / self.total * 100.0) if self.total else 0.0

    @property
    def input_blocked_pct(self) -> float:
        return (self.input_blocked / self.total * 100.0) if self.total else 0.0

    @property
    def output_blocked_pct(self) -> float:
        return (self.output_blocked / self.total * 100.0) if self.total else 0.0

    def add(
        self,
        is_input_block: bool,
        is_output_block: bool,
        consensus_dangerous: Optional[bool] = None,
    ) -> None:
        self.total += 1
        is_blk = is_input_block or is_output_block
        if is_input_block:
            self.input_blocked += 1
        elif is_output_block:
            self.output_blocked += 1

        if consensus_dangerous is not None:
            self.consensus_quorum += 1
            if is_blk:
                self.blocked_in_quorum += 1
            if consensus_dangerous:
                self.consensus_dangerous += 1
            else:
                self.consensus_safe += 1

    def merge(self, other: "BlockStats") -> None:
        self.total += other.total
        self.input_blocked += other.input_blocked
        self.output_blocked += other.output_blocked
        self.consensus_quorum += other.consensus_quorum
        self.consensus_safe += other.consensus_safe
        self.consensus_dangerous += other.consensus_dangerous
        self.blocked_in_quorum += other.blocked_in_quorum

    def format_cell(self, show_split: bool = False) -> str:
        if self.total == 0:
            return "--"
        base = f"{self.blocked_pct:.2f}% ({self.total_blocked}/{self.total})"
        if show_split and self.total_blocked > 0:
            return f"{base} [in:{self.input_blocked}, out:{self.output_blocked}]"
        return base


def normalize_lang(raw: str) -> str:
    lower = (raw or "").lower()
    if "pt" in lower:
        return "pt-BR"
    if "en" in lower:
        return "en"
    return raw or "unknown"


def detect_prohibited_block(record: dict) -> Tuple[bool, bool]:
    """
    Detects external PROHIBITED_CONTENT blocks from Gemini API payload.
    Returns (is_input_block, is_output_block).
    """
    raw = record.get("raw_api_payload") or {}
    if isinstance(raw, dict):
        pf = raw.get("prompt_feedback") or {}
        if isinstance(pf, dict) and pf.get("block_reason") == "PROHIBITED_CONTENT":
            return True, False

        candidates = raw.get("candidates") or []
        if isinstance(candidates, list) and candidates:
            if candidates[0].get("finish_reason") == "PROHIBITED_CONTENT":
                return False, True

    out_fr = (record.get("output") or {}).get("finish_reason")
    if out_fr == "PROHIBITED_CONTENT":
        return False, True

    return False, False


def load_consensus_map(consensus_path: Path) -> Dict[Tuple[int, str, str, int], bool]:
    """
    Loads consensus verdicts keyed by (original_row_index, lang, style, iteration).
    """
    verdicts: Dict[Tuple[int, str, str, int], bool] = {}
    if not consensus_path.exists():
        return verdicts

    with open(consensus_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            if not rec.get("has_quorum"):
                continue
            rkey = rec.get("record_key", "")
            parts = rkey.split("::")
            if len(parts) < 5:
                continue
            try:
                pid = int(parts[0])
                lang = normalize_lang(parts[2])
                style = parts[3].lower()
                iteration = int(parts[4])
            except ValueError:
                continue
            is_dang = rec.get("consensus_dangerous")
            if is_dang is not None:
                verdicts[(pid, lang, style, iteration)] = bool(is_dang)
    return verdicts


def classify_record(filename: str, attack_style: str) -> Tuple[str, str]:
    """
    Maps (filename, attack_style) to (high_level_group, detailed_category).
    """
    style = (attack_style or "plain").lower()
    if "toxicchat_prefix" in filename:
        return "Prefix Injection", "Prefix Injection"
    if "toxicchat_eval" in filename:
        return "ToxicChat (Plain)", "ToxicChat (Plain)"
    if "toxicchat_base64" in filename:
        return "Ciphers (All)", "Cipher: Base64"
    if "toxicchat_rot13" in filename:
        return "Ciphers (All)", "Cipher: ROT13"
    if "toxicchat_hex" in filename:
        return "Ciphers (All)", "Cipher: Hexadecimal"
    if "toxicchat_caesar" in filename:
        return "Ciphers (All)", "Cipher: Caesar"
    if "toxicchat_leetspeak" in filename:
        return "Ciphers (All)", "Cipher: Leetspeak"
    if "toxicchat_stylized_" in filename:
        font = filename.split("toxicchat_stylized_")[-1].replace("_eval.jsonl", "")
        font_label = font.replace("_", " ").title()
        return "Stylized Unicode (All)", f"Stylized: {font_label}"
    if "pap_internetes" in filename:
        if style == "persuasive":
            return "Netspeak", "Netspeak: PAP"
        return "Netspeak", "Netspeak: Plain"
    if "pap_eval" in filename:
        if style == "persuasive":
            return "PAP", "PAP: Persuasive"
        return "PAP", "PAP: Plain"
    if "emoji_eval" in filename:
        if style == "emoji":
            return "Emoji", "Emoji: Obfuscated"
        return "Emoji", "Emoji: Plain"
    return "Other", filename


def analyze_gemini_logs(
    logs_dir: Path,
    consensus_dir: Path,
    include_regional: bool = False,
) -> Tuple[Dict[str, Dict[str, BlockStats]], Dict[str, Dict[str, BlockStats]]]:
    detailed: Dict[str, Dict[str, BlockStats]] = defaultdict(lambda: defaultdict(BlockStats))
    grouped: Dict[str, Dict[str, BlockStats]] = defaultdict(lambda: defaultdict(BlockStats))

    for log_file in sorted(logs_dir.glob("gemini_gemini-3.5-flash-lite_*.jsonl")):
        if not include_regional and "regional_indicator" in log_file.name:
            continue

        consensus_file = consensus_dir / log_file.name
        consensus_map = load_consensus_map(consensus_file)

        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                rec = json.loads(line)
                inputs = rec.get("inputs") or {}
                lang = normalize_lang(inputs.get("prompt_language", ""))
                style = (inputs.get("attack_style") or "").lower()
                pid = (rec.get("dataset_metadata") or {}).get("original_row_index")
                iteration = (rec.get("run_metadata") or {}).get("iteration")

                verdict = None
                if pid is not None and iteration is not None:
                    verdict = consensus_map.get((int(pid), lang, style, int(iteration)))

                in_blk, out_blk = detect_prohibited_block(rec)
                grp_name, det_name = classify_record(log_file.name, style)

                detailed[det_name][lang].add(in_blk, out_blk, verdict)
                detailed[det_name]["total"].add(in_blk, out_blk, verdict)

                grouped[grp_name][lang].add(in_blk, out_blk, verdict)
                grouped[grp_name]["total"].add(in_blk, out_blk, verdict)

    return grouped, detailed


def render_table(
    title: str,
    data: Dict[str, Dict[str, BlockStats]],
    order: List[str],
    show_split: bool = False,
    show_alignment_breakdown: bool = False,
) -> None:
    table = Table(title=title, show_lines=True)
    table.add_column("Category", style="bold cyan", no_wrap=True)
    table.add_column("EN Blocked", justify="right")
    table.add_column("pt-BR Blocked", justify="right")
    table.add_column("Total Blocked", justify="right")
    table.add_column("Delta (pt - en)", justify="right")

    if show_alignment_breakdown:
        table.add_column("EN (Ext / Align / Bypass)", justify="right")
        table.add_column("pt-BR (Ext / Align / Bypass)", justify="right")

    grand_en = BlockStats()
    grand_pt = BlockStats()
    grand_tot = BlockStats()

    keys = [k for k in order if k in data] + [k for k in sorted(data.keys()) if k not in order]

    for key in keys:
        en_s = data[key]["en"]
        pt_s = data[key]["pt-BR"]
        tot_s = data[key]["total"]

        grand_en.merge(en_s)
        grand_pt.merge(pt_s)
        grand_tot.merge(tot_s)

        if en_s.total > 0 and pt_s.total > 0:
            delta = pt_s.blocked_pct - en_s.blocked_pct
            delta_str = f"{delta:+.2f} pp"
        else:
            delta_str = "--"

        row = [
            key,
            en_s.format_cell(show_split=show_split),
            pt_s.format_cell(show_split=show_split),
            tot_s.format_cell(show_split=show_split),
            delta_str,
        ]

        if show_alignment_breakdown:
            row.append(_format_breakdown(en_s))
            row.append(_format_breakdown(pt_s))

        table.add_row(*row)

    # Grand Total row
    g_delta = (grand_pt.blocked_pct - grand_en.blocked_pct) if (grand_en.total and grand_pt.total) else 0.0
    total_row = [
        "OVERALL TOTAL",
        grand_en.format_cell(show_split=show_split),
        grand_pt.format_cell(show_split=show_split),
        grand_tot.format_cell(show_split=show_split),
        f"{g_delta:+.2f} pp",
    ]
    if show_alignment_breakdown:
        total_row.append(_format_breakdown(grand_en))
        total_row.append(_format_breakdown(grand_pt))
    table.add_row(*total_row, style="bold")

    console.print(table)


def _format_breakdown(s: BlockStats) -> str:
    """Formats percentage of (External Guardrail / Intrinsic Refusal / Bypassed) over quorum rows."""
    if s.total == 0:
        return "--"
    if s.consensus_quorum == 0:
        return f"{s.blocked_pct:.1f}% / -- / --"

    denom = s.consensus_quorum
    ext_pct = s.blocked_in_quorum / denom * 100.0
    # Intrinsic alignment refusals = consensus safe rows minus rows already blocked by external guardrail
    intrinsic_safe = max(0, s.consensus_safe - s.blocked_in_quorum)
    align_pct = intrinsic_safe / denom * 100.0
    bypass_pct = s.consensus_dangerous / denom * 100.0
    return f"{ext_pct:.1f}% / {align_pct:.1f}% / {bypass_pct:.1f}%"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyze PROHIBITED_CONTENT external guardrail blocks in Gemini 3.5 Flash Lite logs by language and category."
    )
    parser.add_argument("--logs-dir", type=Path, default=Path("logs"))
    parser.add_argument("--consensus-dir", type=Path, default=Path("evaluations/consensus"))
    parser.add_argument("--split", action="store_true", help="Show input vs output block counts.")
    parser.add_argument(
        "--alignment",
        action="store_true",
        help="Show External Guardrail vs Intrinsic Alignment Refusal vs Bypassed percentages.",
    )
    parser.add_argument("--include-regional", action="store_true", help="Include 20-row regional_indicator test.")
    args = parser.parse_args()

    grouped, detailed = analyze_gemini_logs(
        args.logs_dir,
        args.consensus_dir,
        include_regional=args.include_regional,
    )

    group_order = [
        "ToxicChat (Plain)",
        "Prefix Injection",
        "Ciphers (All)",
        "Stylized Unicode (All)",
        "PAP",
        "Netspeak",
        "Emoji",
    ]
    detail_order = [
        "ToxicChat (Plain)",
        "Prefix Injection",
        "Cipher: Base64",
        "Cipher: ROT13",
        "Cipher: Hexadecimal",
        "Cipher: Caesar",
        "Cipher: Leetspeak",
        "Stylized: Bold",
        "Stylized: Bold Script",
        "Stylized: Double Struck",
        "Stylized: Fraktur",
        "Stylized: Fullwidth",
        "Stylized: Sans Bold Italic",
        "Stylized: Script",
        "PAP: Plain",
        "PAP: Persuasive",
        "Netspeak: Plain",
        "Netspeak: PAP",
        "Emoji: Plain",
        "Emoji: Obfuscated",
    ]

    render_table(
        "Gemini 3.5 Flash Lite — External Guardrail (PROHIBITED_CONTENT) Summary by Group",
        grouped,
        group_order,
        show_split=args.split,
        show_alignment_breakdown=args.alignment,
    )
    console.print()
    render_table(
        "Gemini 3.5 Flash Lite — External Guardrail (PROHIBITED_CONTENT) Detailed Breakdown",
        detailed,
        detail_order,
        show_split=args.split,
        show_alignment_breakdown=args.alignment,
    )


if __name__ == "__main__":
    main()
