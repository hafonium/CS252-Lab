import uvicorn
from pyngrok import ngrok
import os
from app.util.load_env import load_env_variable

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.app:app", host="0.0.0.0", port=port, reload=False)