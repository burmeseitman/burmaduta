from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db_manager import DBManager
import uvicorn
import os

app = FastAPI()

# Allow CORS (Enable all during setup for Cloudflare connectivity)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Wildcard with credentials is not allowed
    allow_methods=["*"],
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
