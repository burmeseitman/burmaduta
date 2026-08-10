# Base image for Python applications
FROM python:3.12-slim AS base

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

# Pin the HuggingFace cache to an explicit path rather than relying on $HOME
# resolution (appuser's home is /app, not /home/appuser). docker-compose mounts a
# named volume here so the ~471MB embedding model survives container recreation.
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p /app/.cache/huggingface

# NOTE: cmdstan is no longer installed by hand. prophet's manylinux wheels ship a
# prebuilt prophet_model.bin alongside cmdstan 2.37.0, so the previous
# `cmdstanpy.install_cmdstan()` step compiled a toolchain the wheel already
# contained — minutes of build time and ~1GB of image for nothing.

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code. The frontend is deployed separately to Cloudflare and
# the API mounts no static files, so it is not copied into this image.
COPY backend ./backend

# Ensure the appuser owns the app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8081

# No image-level HEALTHCHECK: the scraper service reuses this image and never
# binds a port, so it would be permanently unhealthy. The probe is defined on the
# api service in docker-compose.yml instead.

# Command to run API
CMD ["python", "backend/api.py"]
