import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory - get absolute path
backend_dir = Path(__file__).parent.parent.parent
env_path = backend_dir / ".env"

# Force load with override
load_dotenv(env_path, override=True)

def load_env_variable(var_name: str) -> str:
    value = os.getenv(var_name)
    if not value:
        print(f"Warning: Environment variable {var_name} is not set.")
    return value