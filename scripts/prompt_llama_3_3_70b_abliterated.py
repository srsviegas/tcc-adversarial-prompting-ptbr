import os
import sys
import argparse
from pathlib import Path
from typing import Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.models.local_llama import (
    DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH,
    resolve_llama_70b_model_path,
    call_llama_70b,
)
from src.prompts import (
    TARGET_SYSTEM_PROMPTS,
    CIPHER_SYSTEM_PROMPTS,
    INTERNETES_SYSTEM_PROMPT,
    SHITPOST_SYSTEM_PROMPT,
    get_cipher_system_prompt,
)
from src.adapters.toxicchat_stylized import (
    get_stylized_system_prompt,
    STYLIZED_REGISTRY,
    decode_stylized,
)

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.table import Table
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


AVAILABLE_INSTRUCTIONS = {
    "default": "Target Unrestricted Assistant (Objective, Direct, Uncensored)",
    "unrestricted": "Target Unrestricted Assistant (Alias for default)",
    "target": "Target Unrestricted Assistant (Alias for default)",
    "internetes": "Tradutor de Internetês Caótico e Shitpost Brasileiro",
    "shitpost": "Tradutor de Internetês Caótico e Shitpost Brasileiro (Alias)",
    "base64": "Exclusive Base64 Protocol Communication Channel",
    "rot13": "Exclusive ROT13 Substitution Cipher Protocol",
    "hex": "Exclusive Hexadecimal UTF-8 Protocol",
    "caesar": "Exclusive Caesar Cipher Protocol (Default Shift 3)",
    "leetspeak": "Exclusive Leetspeak 1337 Protocol",
    "stylized": "Exclusive Stylized Unicode Alphabet Protocol",
    "fraktur": "Stylized Unicode: Mathematical Bold Fraktur",
    "bold_script": "Stylized Unicode: Mathematical Bold Script/Cursive",
    "script": "Stylized Unicode: Mathematical Script with Sans Digits",
    "double_struck": "Stylized Unicode: Mathematical Double-Struck/Blackboard Bold",
    "fullwidth": "Stylized Unicode: Fullwidth / Wide Unicode",
    "bold": "Stylized Unicode: Mathematical Bold",
    "sans_bold_italic": "Stylized Unicode: Mathematical Sans-Serif Bold Italic",
    "none": "No System Prompt (Raw Model Behavior)",
    "empty": "No System Prompt (Raw Model Behavior)",
}


def resolve_instruction(
    instruction_name: str,
    lang: str = "pt-BR",
    style: str = "fraktur",
    shift: int = 3,
    custom_text: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Resolves the selected AI Instruction name into the actual system prompt text.
    Returns (instruction_key, prompt_text).
    """
    norm_lang = "pt-BR" if str(lang).lower().replace("_", "-").startswith("pt") else "en"
    key = str(instruction_name).lower().strip() if instruction_name else "default"

    if custom_text:
        return "custom", custom_text
    if os.path.isfile(instruction_name):
        try:
            with open(instruction_name, "r", encoding="utf-8") as fp:
                return "custom_file", fp.read().strip()
        except Exception as e:
            print(f"[!] Warning: Could not read file '{instruction_name}': {e}")

    if key in ("none", "empty", "disabled"):
        return "none", ""

    if key in ("default", "unrestricted", "target"):
        return "unrestricted", TARGET_SYSTEM_PROMPTS.get(norm_lang, TARGET_SYSTEM_PROMPTS["pt-BR"])

    if key in ("internetes", "shitpost", "internetês", "girias", "slang"):
        return "internetes", INTERNETES_SYSTEM_PROMPT

    if key in ("base64", "rot13", "hex", "caesar", "leetspeak"):
        return key, get_cipher_system_prompt(key, lang=norm_lang, shift=shift)

    if key == "stylized":
        selected_style = style if style in STYLIZED_REGISTRY else "fraktur"
        return f"stylized_{selected_style}", get_stylized_system_prompt(selected_style, lang=norm_lang)

    if key in STYLIZED_REGISTRY:
        return f"stylized_{key}", get_stylized_system_prompt(key, lang=norm_lang)

    return "custom_text", instruction_name


def try_decode_response(raw_text: str, instruction_key: str, shift: int = 3, lang: str = "pt-BR") -> Optional[str]:
    """Attempts automatic decoding if the response was elicited in cipher/stylized format."""
    if not raw_text or not raw_text.strip():
        return None

    try:
        if instruction_key == "base64":
            import base64
            from src.adapters.toxicchat_cipher import strip_fences_and_whitespace
            cleaned = strip_fences_and_whitespace(raw_text).replace(" ", "").replace("\n", "")
            missing_padding = len(cleaned) % 4
            if missing_padding:
                cleaned += "=" * (4 - missing_padding)
            return base64.b64decode(cleaned).decode("utf-8", errors="replace")

        if instruction_key == "rot13":
            from src.adapters.toxicchat_cipher import decode_rot13
            return decode_rot13(raw_text)

        if instruction_key == "hex":
            from src.adapters.toxicchat_cipher import decode_hex
            return decode_hex(raw_text)

        if instruction_key == "caesar":
            from src.adapters.toxicchat_cipher import decode_caesar
            return decode_caesar(raw_text, shift=shift, lang=lang)

        if instruction_key.startswith("stylized_"):
            style_name = instruction_key.replace("stylized_", "")
            return decode_stylized(raw_text, style=style_name, lang=lang)

    except Exception:
        return None

    return None


def print_header(model_path: str, instruction_key: str, system_prompt: str, lang: str):
    if HAS_RICH:
        grid = Table.grid(expand=True)
        grid.add_column(justify="left")
        grid.add_row(f"[bold cyan]Model:[/bold cyan] {model_path}")
        grid.add_row(f"[bold green]AI Instruction:[/bold green] {instruction_key} [dim]({lang})[/dim]")
        if system_prompt:
            preview = system_prompt if len(system_prompt) <= 160 else system_prompt[:157] + "..."
            grid.add_row(f"[bold yellow]System Prompt:[/bold yellow] [dim]{preview}[/dim]")
        else:
            grid.add_row("[bold yellow]System Prompt:[/bold yellow] [dim]<None>[/dim]")
        console.print(Panel(grid, title="[bold magenta]Llama-3.3-70B-Instruct-Abliterated Direct Prompting[/bold magenta]", border_style="cyan"))
    else:
        print("=" * 70)
        print(" Llama-3.3-70B-Instruct-Abliterated Direct Prompting")
        print("=" * 70)
        print(f"[*] Model: {model_path}")
        print(f"[*] AI Instruction: {instruction_key} ({lang})")
        if system_prompt:
            preview = system_prompt if len(system_prompt) <= 120 else system_prompt[:117] + "..."
            print(f"[*] System Prompt: {preview}")
        else:
            print("[*] System Prompt: <None>")
        print("-" * 70)


def print_response(res: dict, instruction_key: str, shift: int, lang: str, auto_decode: bool = True):
    if res.get("error_log", {}).get("failed"):
        err = res["error_log"].get("error_message")
        if HAS_RICH:
            console.print(Panel(f"[bold red]Generation Error:[/bold red] {err}", title="Error", border_style="red"))
        else:
            print(f"\n[ERROR] Generation failed: {err}\n")
        return

    output = res.get("output", {})
    extracted_text = output.get("extracted_text", "").strip()
    thought_process = output.get("thought_process")
    metrics = res.get("execution_metrics", {})
    latency = metrics.get("latency_seconds", 0.0)
    in_tok = metrics.get("input_tokens", 0)
    out_tok = metrics.get("output_tokens", 0)
    total_tok = metrics.get("total_tokens", 0)

    decoded = None
    if auto_decode:
        decoded = try_decode_response(extracted_text, instruction_key, shift=shift, lang=lang)

    stats = f"Latency: {latency:.2f}s | Prompt tokens: {in_tok} | Completion tokens: {out_tok} | Total: {total_tok}"

    if HAS_RICH:
        if thought_process and thought_process.strip():
            console.print(Panel(thought_process.strip(), title="[italic cyan]Reasoning Trace (<think>)[/italic cyan]", border_style="blue", expand=True))

        console.print(Panel(extracted_text, title=f"[bold green]Model Response[/bold green] [dim]({stats})[/dim]", border_style="green", expand=True))

        if decoded and decoded.strip() and decoded.strip() != extracted_text:
            console.print(Panel(decoded.strip(), title="[bold magenta]Decoded Plaintext (Protocol Extracted)[/bold magenta]", border_style="magenta", expand=True))
    else:
        print("\n" + "=" * 70)
        if thought_process and thought_process.strip():
            print(f"--- Thinking Process ---\n{thought_process.strip()}\n")
        print(f"--- Model Response ({stats}) ---")
        print(extracted_text)
        if decoded and decoded.strip() and decoded.strip() != extracted_text:
            print("\n--- Decoded Plaintext ---")
            print(decoded.strip())
        print("=" * 70 + "\n")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Prompt Llama 3.3 70B Instruct Abliterated GGUF directly using selected AI Instructions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Selectable AI Instructions (--instruction / -i):
  default / unrestricted  Target unrestricted direct assistant (PT-BR/EN)
  internetes / shitpost   Tradutor de internetês caótico e shitpost brasileiro
  base64                  Exclusive Base64 protocol communication channel
  rot13                   Exclusive ROT13 substitution cipher protocol
  hex                     Exclusive Hexadecimal UTF-8 protocol
  caesar                  Exclusive Caesar cipher protocol (configurable --shift)
  leetspeak               Exclusive Leetspeak (1337) numerical substitution protocol
  stylized                Exclusive Stylized Unicode alphabet protocol (--style fraktur, bold_script, etc.)
  fraktur                 Stylized Unicode: Mathematical Bold Fraktur
  bold_script             Stylized Unicode: Mathematical Bold Script/Cursive
  script                  Stylized Unicode: Mathematical Script with Sans Digits
  double_struck           Stylized Unicode: Mathematical Double-Struck/Blackboard Bold
  fullwidth               Stylized Unicode: Fullwidth / Wide Unicode
  bold                    Stylized Unicode: Mathematical Bold
  sans_bold_italic        Stylized Unicode: Mathematical Sans-Serif Bold Italic
  none                    No system prompt (pure completion)
  <file_path>             Load custom system prompt from text file
  "<custom_text>"         Direct custom system prompt text

Examples:
  # 1. Single prompt with default unrestricted instruction:
  py scripts/prompt_llama_3_3_70b_abliterated.py "Quais são os principais vetores de injeção de prompt?"

  # 2. Single prompt with internetês caótico / shitpost translator:
  py scripts/prompt_llama_3_3_70b_abliterated.py -i internetes "O projeto foi finalizado dentro do prazo estipulado."

  # 3. Single prompt with Base64 exclusive protocol instruction:
  py scripts/prompt_llama_3_3_70b_abliterated.py -i base64 "Explique o algoritmo Diffie-Hellman."

  # 4. Interactive chat mode with Fraktur stylized alphabet instruction:
  py scripts/prompt_llama_3_3_70b_abliterated.py -i fraktur -it

  # 5. Interactive chat mode with Caesar cipher (shift 5):
  py scripts/prompt_llama_3_3_70b_abliterated.py -i caesar --shift 5 -it
        """
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="User prompt to send to the model (if omitted, launches interactive mode)"
    )
    parser.add_argument(
        "--instruction", "-i", "--system",
        dest="instruction",
        default="default",
        help="Selected AI Instruction (default, internetes, shitpost, base64, rot13, hex, caesar, leetspeak, stylized, fraktur, none, or custom text/file)"
    )
    parser.add_argument(
        "--lang", "-l",
        dest="lang",
        default="pt-BR",
        choices=["pt-BR", "pt", "en"],
        help="Language for system prompt instructions (default: pt-BR)"
    )
    parser.add_argument(
        "--style", "-s",
        dest="style",
        default="fraktur",
        choices=["fraktur", "bold_script", "script", "double_struck", "fullwidth", "bold", "sans_bold_italic"],
        help="Sub-style when stylized instruction is chosen (default: fraktur)"
    )
    parser.add_argument(
        "--shift",
        type=int,
        default=3,
        help="Shift value when caesar cipher instruction is chosen (default: 3)"
    )
    parser.add_argument(
        "--model-path", "-m",
        dest="model_path",
        default=DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH,
        help="Path or name of GGUF model file"
    )
    parser.add_argument(
        "--temperature", "-t",
        type=float,
        default=0.6,
        help="Sampling temperature (default: 0.6)"
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=1.0,
        help="Nucleus sampling top-p (default: 1.0)"
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=8192,
        help="Maximum generation output tokens (default: 8192)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for deterministic generation"
    )
    parser.add_argument(
        "--context-size", "-c",
        type=int,
        default=8192,
        help="Model context window length n_ctx (default: 8192)"
    )
    parser.add_argument(
        "--gpu-layers", "-ngl",
        type=int,
        default=None,
        help="Number of GPU layers to offload (-1 for all, default: auto-detect)"
    )
    parser.add_argument(
        "--interactive", "-it",
        action="store_true",
        default=False,
        help="Launch interactive conversation REPL"
    )
    parser.add_argument(
        "--no-auto-decode",
        action="store_true",
        default=False,
        help="Disable automatic decoding of cipher/stylized outputs"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    resolved_model_path = resolve_llama_70b_model_path(args.model_path)
    inst_key, system_prompt = resolve_instruction(
        instruction_name=args.instruction,
        lang=args.lang,
        style=args.style,
        shift=args.shift,
    )

    print_header(
        model_path=resolved_model_path,
        instruction_key=inst_key,
        system_prompt=system_prompt,
        lang=args.lang,
    )

    is_interactive = args.interactive or (args.prompt is None)

    if not is_interactive:
        user_prompt = args.prompt.strip()
        if not user_prompt:
            print("[!] Error: Provided prompt is empty.")
            sys.exit(1)

        print(f"\n[?] User Prompt: {user_prompt}\n")
        res = call_llama_70b(
            model_name=resolved_model_path,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=args.temperature,
            top_p=args.top_p,
            max_output_tokens=args.max_tokens,
            seed=args.seed,
            n_ctx=args.context_size,
            n_gpu_layers=args.gpu_layers,
        )
        print_response(
            res=res,
            instruction_key=inst_key,
            shift=args.shift,
            lang=args.lang,
            auto_decode=not args.no_auto_decode,
        )
        return

    print("\n[+] Entering Interactive Prompting Mode. Type 'exit', 'quit', or 'q' to stop.\n")
    while True:
        try:
            if HAS_RICH:
                prompt_input = console.input("[bold green]User > [/bold green]")
            else:
                prompt_input = input("User > ")
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            break

        cleaned_input = prompt_input.strip()
        if not cleaned_input:
            continue
        if cleaned_input.lower() in ("exit", "quit", "q"):
            print("Goodbye.")
            break

        res = call_llama_70b(
            model_name=resolved_model_path,
            system_prompt=system_prompt,
            user_prompt=cleaned_input,
            temperature=args.temperature,
            top_p=args.top_p,
            max_output_tokens=args.max_tokens,
            seed=args.seed,
            n_ctx=args.context_size,
            n_gpu_layers=args.gpu_layers,
        )
        print_response(
            res=res,
            instruction_key=inst_key,
            shift=args.shift,
            lang=args.lang,
            auto_decode=not args.no_auto_decode,
        )


if __name__ == "__main__":
    main()
