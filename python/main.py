import os
import sys
import json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

def emit_error(message: str):
    print(json.dumps({
        "type": "error",
        "message": message
    }), flush=True)
    sys.exit(1)

def main():
    """
    Main entry point of the extension.

    Checks if OPENAI_API_KEY is present in the environment variables.
    If not present, emits an error message and exits with code 1.
    Otherwise, runs the agent.
    """
    if not os.getenv("OPENAI_API_KEY"):
        emit_error(
            "OPENAI_API_KEY is missing.\n"
            "Please add it to python/.env"
        )

    from core.pagent import run_agent
    run_agent()

if __name__ == "__main__":
    main()
