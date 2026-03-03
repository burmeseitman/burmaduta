# 🇲🇲 Burma Duta (ဗမာဒူတ)
> **Real-time News Intelligence & Visualization for Myanmar.**

Burma Duta is a sophisticated news intelligence platform that monitors Telegram channels in real-time, extracts meaningful data using Artificial Intelligence, and visualizes incidents on a high-end interactive map.

## ✨ Core Features

-   🕵️ **Multi-Channel Monitoring**: Simultaneously tracks multiple Telegram news sources (e.g., Khit Thit, Mizzima, etc.).
-   🧠 **AI Intelligence**: Leverages **Google Gemini Flash** to parse raw Burmese text into structured JSON data.
-   ⚔️ **Incident Categorization**: Automatically classifies news into five distinct categories:
    -   **Conflict (တိုက်ပွဲသတင်း)**: ⚔️ Military actions, clashes, and air strikes.
    -   **Crime (မှုခင်းသတင်း)**: 🚨 Robberies, murders, and security incidents.
    -   **Accident (မတော်တဆဖြစ်မှု)**: ⚠️ Fire, car crashes, and emergencies.
    -   **Natural Disaster (သဘာဝဘေးအန္တရာယ်)**: 🌊 Floods, storms, and earthquakes.
    -   **General (အထွေထွေ)**: ℹ️ Infrastructure, health, and public announcements.
-   📍 **Emoji-Based Map**: Visualizes events using category-specific emojis on a dark-themed geospatial interface.
-   🕒 **Dual Timestamping**: Distinguishes between when the **incident occurred** (Event Time) and when it was **reported** (Publish Time).
-   🛡️ **Smart Deduplication**: Intelligently combines multiple reports of the same incident into a single map marker.

## 🛠️ Technology Stack

-   **Backend**: Python, FastAPI
-   **AI**: Google Generative AI (Gemini 1.5 Flash)
-   **Database**: PostgreSQL (Supabase)
-   **Messaging**: Telethon (Telegram MTProto)
-   **Frontend**: Vanilla HTML/JS, Leaflet.js, Lucide Icons
-   **Styling**: Glassmorphism CSS with Inter & Outfit typography

## 🚀 Setup & Installation

### 1. Requirements
Ensure you have Python 3.10+ installed.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Rename `.env.example` to `.env` and configure your credentials:
- `TELEGRAM_API_ID` & `TELEGRAM_API_HASH`: Get from [my.telegram.org](https://my.telegram.org)
- `TELEGRAM_CHANNELS`: Comma-separated list (e.g., `@khitthitnews,@mizzimatv`)
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com)
- `DATABASE_URL`: Your Supabase/PostgreSQL connection string.

## 🏃 Execution

1.  **Start the Data Engine (Scraper)**:
    ```bash
    python backend/scraper.py
    ```
2.  **Launch the API Service**:
    ```bash
    python backend/api.py
    ```
3.  **View the Intelligence Map**:
    Open `frontend/index.html` in your web browser.

## 📁 Project Architecture

```bash
├── backend/
│   ├── scraper.py       # Real-time Telegram listener
│   ├── ai_processor.py  # Gemini-powered analytical brain
│   ├── db_manager.py    # PostgreSQL interface & deduplication
│   └── api.py           # REST API for the frontend
├── frontend/
│   ├── app.js           # Map logic & dynamic UI management
│   ├── style.css        # Premium glassmorphic styling
│   └── index.html       # Main application entry
└── .env                 # Sensitive configuration
```

---
"Building software at the speed of thought."
