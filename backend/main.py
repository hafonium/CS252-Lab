import uvicorn
from pyngrok import ngrok
import os
from app.util.load_env import load_env_variable

if __name__ == "__main__":
    # Load ngrok auth token
    try:
        ngrok_token = load_env_variable("NGROK_AUTH_TOKEN")
        ngrok.set_auth_token(ngrok_token)
        
        # Start ngrok tunnel
        public_url = ngrok.connect(8000)
        print(f"\n{'='*60}")
        print(f"Ngrok tunnel created: {public_url}")
        print(f"Local server: http://127.0.0.1:8000")
        print(f"Swagger UI (Local): http://127.0.0.1:8000/docs")
        print(f"Swagger UI (Public): {public_url}/docs")
        print(f"{'='*60}\n")
    except Exception as e:
        print(f"Warning: Could not start ngrok tunnel: {e}")
        print("Starting server without ngrok...")
        print("Local server: http://127.0.0.1:8000")
        print("Swagger UI: http://127.0.0.1:8000/docs")
    
    uvicorn.run("app.app:app", host="127.0.0.1", port=8000, reload=False)