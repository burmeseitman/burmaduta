from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Query, Request, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from db_manager import DBManager
from ai_processor import AIProcessor
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
import uvicorn
import os
import time
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

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
          "Set explicit origins in production (e.g., https://example.com)")
    allowed_origins = ["*"]
else:
    allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True, # Allowed credentials for user sessions
    allow_methods=["GET", "POST", "OPTIONS"], # Allowed POST for auth and comments
    allow_headers=["*"],
)

db = DBManager()
ai = AIProcessor(db=db)

# --- User Auth Models & Handlers ---
class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class CommentRequest(BaseModel):
    comment_text: str

def hash_password(password: str) -> str:
    salt = uuid.uuid4().hex
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt, hashed = hashed_password.split("$")
        check_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return check_hash == hashed
    except ValueError:
        return False

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication credentials missing or invalid")
    token = authorization.split(" ")[1]
    session = db.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session token invalid or expired")
    
    expires_at = session.get("expires_at")
    if expires_at and expires_at < datetime.now(timezone.utc):
        db.delete_session(token)
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return session

# --- Cache Configuration (Bounded) ---
CACHE_TTL = 30       # Cache duration in seconds
MAX_CACHE_ENTRIES = 10  # Prevent unbounded memory growth from unique cache keys
news_cache = {}

# --- API Key Authentication ---
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    print("⚠️ Warning: API_KEY environment variable is not set. Fallback to mock API Key: 'your_secret_api_key_here'")
    API_KEY = "your_secret_api_key_here"

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return x_api_key

def _evict_oldest_cache():
    """Remove the oldest cache entry if we exceed MAX_CACHE_ENTRIES."""
    while len(news_cache) > MAX_CACHE_ENTRIES:
        oldest_key = min(news_cache, key=lambda k: news_cache[k].get("timestamp", 0))
        del news_cache[oldest_key]

# --- Stats Cache ---
stats_cache = {}

@app.get("/api/news")
@limiter.limit("30/minute")
async def get_news(
    request: Request, 
    days: int = Query(default=90, ge=1, le=365), 
    limit: int = Query(default=30, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    minimal: bool = Query(default=False),
    api_key: str = Depends(verify_api_key)
):
    """Fetch news events. Rate limited to 30 requests/minute per IP."""
    current_time = time.time()
    
    # Simple cache key incorporating pagination and minimal parameters
    cache_key = f"news_{days}_{limit}_{offset}_{minimal}"
    
    # Check if cache is valid
    if (cache_key not in news_cache 
        or news_cache[cache_key] is None 
        or (current_time - news_cache[cache_key].get("timestamp", 0)) > CACHE_TTL):
        print(f"🔄 Fetching fresh news ({days} days, limit={limit}, offset={offset}, minimal={minimal}) from database...")
        data = db.get_all_news(days=days, limit=limit, offset=offset, minimal=minimal)
        news_cache[cache_key] = {"data": data, "timestamp": current_time}
        _evict_oldest_cache()
        
    return news_cache[cache_key]["data"]

@app.get("/api/stats")
@limiter.limit("30/minute")
async def get_stats(
    request: Request,
    days: int = Query(default=90, ge=1, le=365),
    api_key: str = Depends(verify_api_key)
):
    """Fetch pre-aggregated statistics (charts and township lists). Cached."""
    current_time = time.time()
    cache_key = f"stats_{days}"
    
    # Cache duration set to 60 seconds to avoid server computation loops
    if (cache_key not in stats_cache 
        or stats_cache[cache_key] is None 
        or (current_time - stats_cache[cache_key].get("timestamp", 0)) > 60):
        print(f"🔄 Calculating fresh aggregated stats ({days} days) from database...")
        data = db.get_aggregated_stats(days=days)
        stats_cache[cache_key] = {"data": data, "timestamp": current_time}
        
    return stats_cache[cache_key]["data"]

forecasts_cache = {"data": None, "timestamp": 0}

@app.get("/api/forecasts")
@limiter.limit("30/minute")
async def get_forecasts(
    request: Request,
    api_key: str = Depends(verify_api_key)
):
    """Fetch active conflict trend forecasts. Cached for 10 minutes."""
    current_time = time.time()
    
    if (forecasts_cache["data"] is None 
        or (current_time - forecasts_cache["timestamp"]) > 600):
        print("🔄 Fetching fresh conflict forecasts from database...")
        data = db.get_active_forecasts()
        forecasts_cache["data"] = data
        forecasts_cache["timestamp"] = current_time
        
    return forecasts_cache["data"]

@app.post("/api/register")
async def register(req: RegisterRequest, api_key: str = Depends(verify_api_key)):
    # Validate username/password constraints
    username_cleaned = req.username.strip()
    if len(username_cleaned) < 3 or len(username_cleaned) > 20:
        raise HTTPException(status_code=400, detail="Username must be between 3 and 20 characters.")
    if not username_cleaned.isalnum():
        raise HTTPException(status_code=400, detail="Username must contain only letters and numbers.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    
    # Check if user already exists
    existing = db.get_user_by_username(username_cleaned)
    if existing:
        raise HTTPException(status_code=400, detail="Username is already taken.")
        
    pw_hash = hash_password(req.password)
    user_id = db.create_user(username_cleaned, pw_hash)
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to register user.")
        
    return {"message": "User registered successfully", "user_id": user_id}

@app.post("/api/login")
async def login(req: LoginRequest, api_key: str = Depends(verify_api_key)):
    username_cleaned = req.username.strip()
    user = db.get_user_by_username(username_cleaned)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    # Generate random session token
    token = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    success = db.create_session(token, user["id"], expires_at)
    if not success:
        raise HTTPException(status_code=500, detail="Session creation failed")
        
    return {"token": token, "username": user["username"], "message": "Login successful"}

@app.get("/api/auth/me")
async def auth_me(current_user: dict = Depends(get_current_user), api_key: str = Depends(verify_api_key)):
    return {"id": current_user["user_id"], "username": current_user["username"]}

@app.get("/api/news/{news_id}/comments")
async def get_comments(news_id: int, api_key: str = Depends(verify_api_key)):
    comments = db.get_comments(news_id)
    return comments

@app.post("/api/news/{news_id}/comments")
@limiter.limit("15/minute")
async def post_comment(request: Request, news_id: int, req: CommentRequest, current_user: dict = Depends(get_current_user), api_key: str = Depends(verify_api_key)):
    text = req.comment_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment content cannot be empty.")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Comment must be under 500 characters.")
        
    # Safety Check validation moderation filter rules: hate speech, harassment, spam, explicit, dangerous
    # Using AIProcessor moderation engine (regex + low cost Gemini filter API)
    moderation_result = ai.moderate_comment(text)
    if not moderation_result.get("allowed", True):
        # Return HTTP 400 with specific safety reason
        raise HTTPException(status_code=400, detail=moderation_result.get("reason", "Comment rejected due to safety policies."))
        
    comment_id = db.add_comment(news_id, current_user["user_id"], current_user["username"], text)
    if not comment_id:
        raise HTTPException(status_code=500, detail="Failed to post comment.")
        
    return {"message": "Comment posted successfully", "comment_id": comment_id}

@app.get("/api/news/{news_id}")
@limiter.limit("60/minute")
async def get_news_detail(
    news_id: int,
    request: Request,
    api_key: str = Depends(verify_api_key)
):
    """Fetch details for a single news event."""
    data = db.get_news_by_id(news_id)
    if not data:
        raise HTTPException(status_code=404, detail="News event not found.")
    return data

# Health check endpoint (useful for monitoring, excluded from rate limit)
@app.get("/api/health")
async def health_check(api_key: str = Depends(verify_api_key)):
    return {"status": "ok"}

# Root endpoint message
@app.get("/")
async def root():
    return {"message": "Burma Duta API Access Restricted. Valid API Key required."}

if __name__ == "__main__":
    pass

# Background task to run forecaster daily at 3:00 AM Singapore Time (SGT / UTC+8)
async def schedule_daily_forecaster():
    """Background loop that checks SGT time hourly and triggers forecaster at 03:00 AM SGT."""
    print("⏰ Daily Forecaster Scheduler started.")
    while True:
        try:
            # Singapore Time is UTC+8
            sgt_now = datetime.now(timezone(timedelta(hours=8)))
            if sgt_now.hour == 3:
                print(f"⏰ SGT time is {sgt_now.strftime('%H:%M')}. Launching Prophet conflict trend prediction calculations...")
                from forecaster import run_forecast
                # Run the forecasting process inside a thread executor to avoid blocking the event loop
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, run_forecast)
                print("✅ Prophet prediction calculations completed successfully.")
                
                # Sleep for 1 hour + 5 minutes to prevent re-triggering during the 3 AM hour
                await asyncio.sleep(3900)
            else:
                # Sleep for 15 minutes before checking time again
                await asyncio.sleep(900)
        except Exception as e:
            print(f"Error in daily forecaster scheduler loop: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    # Start the daily forecaster background task
    import asyncio
    asyncio.create_task(schedule_daily_forecaster())


if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8081,
        proxy_headers=True, 
        forwarded_allow_ips="*"
    )
