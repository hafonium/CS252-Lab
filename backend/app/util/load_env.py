import os
from dotenv import load_dotenv
from pathlib import Path

for env_file in Path.cwd().rglob(".env"):
    load_dotenv(env_file, override=True)

def load_env_variable(var_name: str) -> str | None:
    value = os.getenv(var_name)
    if value is None:
        print(f"Warning: Environment variable '{var_name}' is not set.")
    return value
