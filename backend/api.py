from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db_manager import DBManager
import uvicorn
import os

app = FastAPI()

import os

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
news_cache = {"data": None, "timestamp": 0}

@app.get("/api/news")
async def get_news():
    current_time = time.time()
    # Check if cache is empty or expired
    if news_cache["data"] is None or (current_time - news_cache["timestamp"]) > CACHE_TTL:
        print("🔄 Fetching fresh news from database...")
        news_cache["data"] = db.get_all_news()
        news_cache["timestamp"] = current_time
    return news_cache["data"]

# Serve Frontend Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
