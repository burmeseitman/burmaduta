<p align="center">
  <img src="./assets/logo.png" width="200" alt="Burma Duta Logo">
</p>

# 🇲🇲 Burma Duta (ဗမာဒူတ)
> **Real-time News Intelligence & Visualization for Myanmar.**

Burma Duta is a news intelligence platform that monitors public data channels in real-time, extracts meaningful information using an AI-powered analytical engine, and visualizes incidents on an interactive map with integrated statistical analytics.

![Burma Duta Dashboard Runtime](./assets/screenshot.png)

## ✨ Key Features

-   📡 **Real-time Monitoring**: Simultaneously tracks multiple news sources for up-to-the-minute awareness.
-   🧠 **AI-Powered Analysis**: Automatically parses raw news text into structured data (category, location, time, and summary).
-   🚩 **Incident Ranking**: Visualizes areas with high incident density to help identify regional trends.
-   📊 **Interactive Dashboard**: High-end data visualization using a professional charting suite and status indicators.
-   📍 **Geospatial Mapping**: Visualizes events using an interactive map interface with category-specific categorization and filters.
-   🐳 **Easy Deployment**: Full support for Docker and Docker Compose for fast setup on any environment.

## 🛠️ Technology Stack

-   **Backend**: Python (FastAPI)
-   **AI Engine**: Advanced Generative AI (Content Analysis)
-   **Database**: PostgreSQL (Relational Storage)
-   **Frontend**: Modern JS with Glassmorphism UI
-   **Containerization**: Docker & Docker Compose

## 🚀 Getting Started (Docker)

The recommended way to run Burma Duta is using Docker.

### 1. Requirements
- Docker & Docker Compose
- Environment configuration (`.env` file)

### 2. Configuration
Create a `.env` file in the project root:
```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=burmaduta

SOURCE_API_ID=your_api_id
SOURCE_API_HASH=your_api_hash
PROCESSOR_KEY=your_ai_key
```

### 3. Launch
```bash
docker-compose up -d --build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
"Building software at the speed of thought."
