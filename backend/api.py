from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Query, Request, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from db_manager import DBManager
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
import os
import time

# Load environment variables
load_dotenv()

# --- Rate Limiter Setup ---
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Burma Duta API",
    docs_url=None,   # Disable Swagger UI in production
    redoc_url=None,  # Disable ReDoc in production
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS Configuration (Hardened) ---
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if not allowed_origins_str or allowed_origins_str.strip() == "*":
    print("⚠️ WARNING: ALLOWED_ORIGINS is not set or is wildcard '*'. "
          "Set explicit origins in production (e.g., https://burmaduta.com)")
    allowed_origins = ["*"]
else:
    allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False, 
    allow_methods=["GET", "OPTIONS"], # Hardened: Only allow GET and OPTIONS for public API
    allow_headers=["*"],
)

db = DBManager()

# --- Cache Configuration (Bounded) ---
CACHE_TTL = 30       # Cache duration in seconds
MAX_CACHE_ENTRIES = 10  # Prevent unbounded memory growth from unique cache keys
news_cache = {}

# --- API Key Authentication ---
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise ValueError("FATAL ERROR: API_KEY environment variable is not set. Please set it in your .env file.")

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return x_api_key

def _evict_oldest_cache():
    """Remove the oldest cache entry if we exceed MAX_CACHE_ENTRIES."""
    while len(news_cache) > MAX_CACHE_ENTRIES:
        oldest_key = min(news_cache, key=lambda k: news_cache[k].get("timestamp", 0))
        del news_cache[oldest_key]

@app.get("/api/news")
@limiter.limit("30/minute")
async def get_news(request: Request, days: int = Query(default=90, ge=1, le=365), api_key: str = Depends(verify_api_key)):
    """Fetch news events. Rate limited to 30 requests/minute per IP."""
    current_time = time.time()
    
    # Simple cache key
    cache_key = f"news_{days}"
    
    # Check if cache is valid
    if (cache_key not in news_cache 
        or news_cache[cache_key] is None 
        or (current_time - news_cache[cache_key].get("timestamp", 0)) > CACHE_TTL):
        print(f"🔄 Fetching fresh news ({days} days) from database...")
        data = db.get_all_news(days=days)
        news_cache[cache_key] = {"data": data, "timestamp": current_time}
        _evict_oldest_cache()
        
    return news_cache[cache_key]["data"]

# Health check endpoint (useful for monitoring, excluded from rate limit)
@app.get("/api/health")
async def health_check(api_key: str = Depends(verify_api_key)):
    return {"status": "ok"}

# Root endpoint message
@app.get("/")
async def root():
    return {"message": "Burma Duta API Access Restricted. Valid API Key required."}

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8081,
        proxy_headers=True, 
        forwarded_allow_ips="*"
    )
