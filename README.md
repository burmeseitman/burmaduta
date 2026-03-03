# 🇲🇲 Burma Duta (ဗမာဒူတ)
> **Real-time News Intelligence & Visualization for Myanmar.**

Burma Duta is a sophisticated news intelligence platform that monitors secure data channels in real-time, extracts meaningful data using an Advanced Analytical Engine, and visualizes incidents on a high-end interactive map with integrated statistical analytics.

## ✨ Core Features

-   🕵️ **Multi-Channel Monitoring**: Simultaneously tracks multiple secure news sources for real-time awareness.
-   🧠 **AI Intelligence**: Leverages a state-of-the-art **Analytical Engine** to parse raw text into structured data with high precision.
-   ⚔️ **Hierarchical Categorization**: Automatically classifies news into five main categories with granular sub-categories:
    -   **Military (စစ်ရေးသတင်း)**: ⚔️ Clashes (#တိုက်ပွဲဖြစ်ပွားမှု), Artillery/Airstrikes (#လက်နက်ကြီး/လေကြောင်းရန်), IDPs (#စစ်ဘေးရှောင်သတင်း).
    -   **Crime (မှုခင်းသတင်း)**: 🚨 Robbery, Murder, Burglary, Drugs, etc.
    -   **Accident (မတော်တဆဖြစ်မှု)**: ⚠️ Fire, Car/Motorcycle Crashes, Drowning.
    -   **Natural Disaster (သဘာဝဘေးအန္တရာယ်)**: 🌊 Floods, Storms, Earthquakes, Landslides.
    -   **General (အထွေထွေ)**: ℹ️ Infrastructure, health, and public announcements.
-   📊 **Interactive Analytics**: High-end data visualization using a professional charting suite:
    -   **Doughnut Chart**: Category distribution with interactive legends.
    -   **Monthly Bar Chart**: Historical trends for the current year.
    -   **Interactive Stats**: Top-right floating cards that expand to show sub-category breakdowns on click.
-   📍 **Intelligent Mapping**: Visualizes events using an interactive geospatial interface with category-specific custom icons and interactive hashtag popups.
-   ⚙️ **Database-Centric Config**: Sensitive access keys and monitoring settings are managed securely within the internal store, eliminating the need for plain-text environment variables.
-   🛡️ **Smart Deduplication**: Intelligently identifies and merges redundant reports of the same incident to maintain a clean and accurate intelligence map.

## 🛠️ Technology Stack

-   **Backend**: Python-based High-Performance API
-   **AI Engine**: Advanced Large Language Model Broker
-   **Database**: Relational Database Service (Internal Store)
-   **Messaging**: Secure Channel Protocol Listener
-   **Frontend**: Modern JS Interface with Geospatial & Analytical Visualizations
-   **Styling**: Premium Glassmorphism UI with elegant typography

## 🚀 Setup & Installation

### 1. Requirements
- Python 3.10+
- Relational Database Instance

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file with your storage URI:
```env
INTERNAL_STORE_URI="postgresql://user:password@localhost/dbname"
```

### 4. Configuration Migration
Run the migration tool to transfer local settings to the secure internal store:
```bash
python backend/migrate_config.py
```
*Note: Ensure your `PROCESSOR_KEY`, `CHANNEL_API_ID`, and `MONITOR_LIST` are correctly configured within the system storage.*

## 🏃 Execution

1.  **Launch the System**:
    ```bash
    # Start the API & Dashboard Server
    python backend/api.py
    
    # Start the Intelligence Scraper
    python backend/scraper.py
    ```
2.  **Access the Dashboard**:
    Open the local server address in your browser.

## 📁 Project Architecture

```bash
├── backend/
│   ├── scraper.py       # Real-time channel listener & AI orchestrator
│   ├── ai_processor.py  # Analytical brain (hierarchical parsing)
│   ├── db_manager.py    # Database interface & system configuration
│   └── api.py           # API service & dashboard server
├── frontend/
│   ├── app.js           # Reactive interface & visualization logic
│   ├── style.css        # Premium glassmorphic design system
│   └── index.html       # Single-panel dashboard entry
└── .env                 # Core storage connection URI
```

---
"Building software at the speed of thought."
