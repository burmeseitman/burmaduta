<p align="center">
  <img src="./assets/logo.png" width="200" alt="Burma Duta Logo">
</p>

# 🇲🇲 Burma Duta (ဗမာဒူတ)
> **Real-time News Intelligence & Visualization for Myanmar.**
> **Live Demo:** [https://www.burmaduta.com](https://www.burmaduta.com)

Burma Duta is a sophisticated news intelligence platform designed to monitor public data streams in real-time. It leverages an advanced AI-powered analytical engine to transform raw, unstructured text into categorized, geo-tagged incident reports, visualized through a high-performance interactive dashboard.

![Burma Duta Dashboard Runtime](./assets/screenshot.png)

## ✨ Key Features

-   📡 **Real-time Multi-Channel Monitoring**: Continuously tracks diverse news sources and public announcement channels for instantaneous awareness.
-   🧠 **Advanced AI Categorization**: Implements a hierarchical classification system (Conflict, Crime, Accident, Disaster, General) with granular sub-category extraction (e.g., Airstrikes, IDPs, Robbery).
-   📍 **Intelligent Geospatial Mapping**: Automatically geocodes incident locations using both AI logic and fallback OpenStreetMap (Nominatim) integration.
-   📊 **Interactive Narrative Dashboard**: Professional-grade visualizations using ECharts, including temporal trends, category distributions, and correlation analysis (e.g., IDP vs. Conflict).
-   🔄 **Optimized AI Processing**: Features context caching for batch processing, significantly reducing latency and operational costs while maintaining high extraction accuracy.
-   🛡️ **Decoupled & Secure Architecture**: Built with a modular approach (FastAPI + Vanilla JS + PostgreSQL), ensuring easy scaling and secure deployment.
-   🐳 **Automated Deployment**: One-command setup script for cloud environments with full Docker & Docker Compose support.

## 🛠️ Technology Stack

<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet">
  <img src="https://img.shields.io/badge/ECharts-AA0000?style=for-the-badge&logo=apache-echarts&logoColor=white" alt="ECharts">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google-gemini&logoColor=white" alt="Google Gemini AI">
</p>

## 🏗️ System Architecture

The project is architected for maximum flexibility. The frontend is entirely static, enabling global distribution via CDNs, while the backend handles high-concurrency data ingestion and AI processing.

```mermaid
graph TD
    A[Public Data Channels] -->|Real-time feed| B(Scraper Service)
    B -->|Batch Raw Text| C{AI Analytical Engine}
    C -->|Structured JSON| D[(PostgreSQL Database)]
    
    D -->|REST Endpoints| E(FastAPI Backend)
    
    F[End User] <-->|HTTPS| G[Frontend App]
    G <-->|AJAX Calls| E
    
    classDef frontend fill:#f7b731,stroke:#333,stroke-width:2px,color:#000;
    classDef backend fill:#eb3b5a,stroke:#333,stroke-width:2px,color:#fff;
    classDef database fill:#2980b9,stroke:#333,stroke-width:2px,color:#fff;
    classDef external fill:#4b6584,stroke:#333,stroke-width:2px,color:#fff;
    
    class G frontend;
    class B,C,E backend;
    class D database;
    class A external;
```

### Components
1. **Frontend**: Pure HTML5/CSS3/Vanilla JS. No complex frameworks, ensuring ultra-fast load times and zero dependency bloat.
2. **Backend API**: Optimized FastAPI services providing efficient data retrieval with CORS support.
3. **Scraper & AI Processor**: A dedicated worker utilizing LLM intelligence for entity recognition (Location, Event Type, Timestamp, People involved) and data cleaning.
4. **Database**: Robust PostgreSQL schema designed for incident tracking and system-wide configuration management.

## 🚀 Deployment

Burma Duta is designed to be deployed effortlessly on any Linux-based VPS or cloud provider.

### 1. Pre-requisites
Ensure you have the following **private** files ready (do not commit these to source control):
-   `.env`: Containing your `DATABASE_URL` and `PROCESSOR_KEY`.
-   `burmaduta_session.session`: Your authenticated data source session file.

### 2. Automated Installation
Run the deployment script to prepare your server environment (Docker, Docker Compose, Swap configuration):
```bash
curl -O https://raw.githubusercontent.com/[your-repo]/main/deploy.sh && chmod +x deploy.sh && ./deploy.sh
```

### 3. Launching the Stack
Once your configuration files are in place, start the entire ecosystem:
```bash
docker-compose up -d --build
```
The API will be accessible at `http://[your-ip]:8081`.

### 4. Frontend Global Deployment
For optimal performance, host the `frontend` directory on a CDN (e.g., Cloudflare Pages, Netlify). Update `frontend/app.js` with your production API URL before deployment.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
"Building software at the speed of thought."
