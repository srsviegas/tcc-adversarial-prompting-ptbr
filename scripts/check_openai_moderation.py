import os
import sys
from pathlib import Path

# Ensure project root in path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def check_moderation(api_key: str = None):
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        print("[ERROR] No OPENAI_API_KEY found in environment or passed as argument.")
        print("        Set it using: export OPENAI_API_KEY=\"your-key\" or in .env")
        return

    masked_key = key[:7] + "..." + key[-4:] if len(key) > 12 else "***"
    print(f"[*] Testing OpenAI Moderation with API Key: {masked_key}")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
    except ImportError:
        print("[ERROR] openai package is not installed. Run: pip install openai")
        return

    models_to_test = ["omni-moderation-latest", "text-moderation-latest"]
    test_input = "Hello, world! This is a benign test message."

    for model in models_to_test:
        print(f"\n--- Testing model: {model} ---")
        try:
            response = client.moderations.create(
                model=model,
                input=test_input,
            )
            result = response.results[0]
            print(f"[SUCCESS] Model '{model}' responded successfully!")
            print(f"  Flagged: {result.flagged}")
            print(f"  Sample scores: {dict(list(result.category_scores.model_dump().items())[:3])}")
        except Exception as e:
            err_msg = str(e)
            print(f"[FAILED] Error code / message: {err_msg}")
            if "429" in err_msg:
                print("\n[DIAGNOSIS FOR 429]:")
                print("  OpenAI returned '429 Too Many Requests' (type: invalid_request_error).")
                print("  Even though Moderation API calls cost $0.00, OpenAI requires accounts")
                print("  to have a funded platform billing balance (at least $5 prepaid credits deposited)")
                print("  at https://platform.openai.com/settings/organization/billing/overview.")
                print("  If your credit balance is $0.00, OpenAI rejects API requests with a 429 code.")


if __name__ == "__main__":
    passed_key = sys.argv[1] if len(sys.argv) > 1 else None
    check_moderation(passed_key)
