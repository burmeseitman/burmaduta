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

## 🚀 Deployment (AWS/GCP/Vultr)

The easiest way to deploy Burma Duta is using the automated setup script, optimized for **1GB RAM** servers (e.g., GCP e2-micro).

### 1. Automated Setup
Once you have your VPS, run this single command to install Docker, Docker Compose, and configure 2GB Swap:
```bash
curl -O https://raw.githubusercontent.com/[your-repo]/main/deploy.sh && chmod +x deploy.sh && ./deploy.sh
```

### 2. Configuration
Copy your `.env` and `burmaduta_session.session` (data session file) to the project root.

### 3. Launch
```bash
docker-compose up -d --build
```
The dashboard will be available at `http://[your-vps-ip]:8081`.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
"Building software at the speed of thought."
