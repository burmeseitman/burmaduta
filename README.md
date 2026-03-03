# 🇲🇲 Burma Duta (ဗမာဒူတ)
Real-time news extraction and visualization map.

## 🚀 Features
- **Real-time Scraper**: Monitors Telegram channels using Telethon.
- **AI Analytics**: Uses Google Gemini Flash to parse news into structured data.
- **Geospatial View**: Highlights events on an interactive OpenStreetMap.
- **Supabase Integration**: Stores data in PostgreSQL for persistence.

## 🛠️ Setup
1.  **Clone/Download** this project.
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Configure Environment**:
    Rename `.env.example` to `.env` and fill in:
    - `TELEGRAM_API_ID` & `TELEGRAM_API_HASH`: Get from [my.telegram.org](https://my.telegram.org)
    - `TELEGRAM_CHANNEL`: The username of the news channel (e.g., `myanmarnews`)
    - `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com)
    - `DATABASE_URL`: Connection string from [Supabase](https://supabase.com) (Project Settings -> Database -> Connection string -> URI)

## 🏃 Running the Application
1.  **Start the API Server**:
    ```bash
    python backend/api.py
    ```
2.  **Start the Real-time Scraper**:
    ```bash
    python backend/scraper.py
    ```
3.  **View the Map**:
    Open `frontend/index.html` in your browser.

## 📂 Project Structure
- `backend/api.py`: FastAPI server for fetching news.
- `backend/scraper.py`: The "Listener" that processes Telegram messages.
- `backend/ai_processor.py`: Brain that extracts data using Gemini.
- `backend/db_manager.py`: Connects to Supabase PostgreSQL.
- `frontend/`: Beautiful glassmorphic UI with Leaflet.js.
