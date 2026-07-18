# Base image for Python applications
FROM python:3.11-slim as base

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

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install cmdstan for Prophet (fixes stan_backend missing attribute error)
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()"

# Copy application code
COPY backend ./backend
COPY frontend ./frontend

# Ensure the appuser owns the app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8081

# Command to run API
CMD ["python", "backend/api.py"]
