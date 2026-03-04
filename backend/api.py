from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db_manager import DBManager
import uvicorn
import os

app = FastAPI()

# Allow CORS
# Allow CORS (Restricted for Security)
raw_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in raw_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"], # Only allow GET for this public API
    allow_headers=["*"],
)

db = DBManager()

@app.get("/api/news")
async def get_news():
    return db.get_all_news()

# Serve Frontend Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
