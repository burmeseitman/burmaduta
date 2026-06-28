#!/bin/bash

# ==========================================
# 🇲🇲 Burma Duta - Automated Deployment Script
# Optimized for 1GB RAM VPS (GCP, Vultr, etc.)
# ==========================================

set -e

echo "🚀 Starting Burma Duta deployment setup..."

# 1. Update and Install Base Dependencies
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw

# 2. Setup 2GB Swap Memory (Crucial for 1GB RAM servers)
if [ $(sudo swapon --show | wc -l) -gt 0 ]; then
    echo "✅ Swap memory already exists. Skipping..."
else
    echo "🧠 Creating 2GB Swap file for stability..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap memory activated."
fi

# 3. Install Docker
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is already installed."
else
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully."
fi

# 4. Install Docker Compose
if command -v docker-compose >/dev/null 2>&1; then
    echo "✅ Docker Compose is already installed."
else
    echo "🐙 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed."
fi

# 5. Configure Firewall (UFW)
echo "🛡️ Configuring Firewall..."
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# NOTE: Port 8081 is intentionally NOT exposed. API is behind Caddy reverse proxy.
sudo ufw --force enable
echo "✅ Firewall configured (SSH, HTTP/80, HTTPS/443 only)."

echo ""
echo "===================================================="
echo "🎉 Setup Complete! Next Steps:"
echo "1. Log out and log back in to apply Docker group changes."
echo "2. Copy your project files (or git clone) to this server."
echo "3. Create your .env file in the project root."
echo "4. Create 'sessions' directory and copy your 'burmaduta.session' there."
echo "5. Run: docker-compose up -d --build"
echo "===================================================="
