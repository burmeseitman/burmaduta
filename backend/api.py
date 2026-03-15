from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db_manager import DBManager
from dotenv import load_dotenv
import uvicorn
import os
import time

# Load environment variables
load_dotenv()

app = FastAPI()

# Fetch Allowed Origins from ENV
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",")] if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False, 
    allow_methods=["GET", "OPTIONS"], # Hardened: Only allow GET and OPTIONS for public API
    allow_headers=["*"],
)

db = DBManager()

import time

CACHE_TTL = 30  # Cache duration in seconds
news_cache = {} # Initialize as an empty dictionary to hold multiple cache keys

@app.get("/api/news")
async def get_news(days: int = 90):
    current_time = time.time()
    
    # Simple cache key
    cache_key = f"news_{days}"
    
    # Initialize cache for this key if it doesn't exist
    if cache_key not in news_cache or news_cache[cache_key] is None or (current_time - news_cache[cache_key].get("timestamp", 0)) > CACHE_TTL:
        print(f"🔄 Fetching fresh news ({days} days) from database...")
        data = db.get_all_news(days=days)
        news_cache[cache_key] = {"data": data, "timestamp": current_time}
        
    return news_cache[cache_key]["data"]

# Serve Frontend Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
