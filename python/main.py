import sys
import json
import os
from dotenv import load_dotenv

# Load env vars
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Ensure core imports work
sys.path.append(os.path.dirname(__file__))

from core.pagent import run_agent

def main():
    try:
        run_agent()
    except Exception as e:
        print(
            json.dumps({
                "type": "error",
                "message": str(e)
            }),
            flush=True
        )
        sys.exit(1)

if __name__ == "__main__":
    main()
