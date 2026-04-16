#!/usr/bin/env bash
# ============================================================
# StreamMatch — Production Deployment Script
# ============================================================
set -euo pipefail

COMPOSE_FILES="-f docker-compose.yml"
ENV_FILE=".env"

echo "=========================================="
echo " StreamMatch — Production Deploy"
echo "=========================================="

# 1. Pre-flight checks
echo "[1/6] Pre-flight checks..."

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found. Copy .env.example and fill in values."
    exit 1
fi

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker is not installed."
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "ERROR: Docker daemon is not running."
    exit 1
fi

echo "  ✓ .env exists"
echo "  ✓ Docker is available"

# 2. Pull latest code (if in git repo)
#if [ -d ".git" ]; then
#    echo "[2/6] Pulling latest code..."
#    git pull --ff-only || echo "  WARNING: git pull failed, continuing with local code"
#else
#    echo "[2/6] Not a git repo, skipping pull"
#fi

# 3. Build images
echo "[3/6] Building Docker images..."
docker compose $COMPOSE_FILES build --no-cache

# 4. Run database migrations
echo "[4/6] Running database migrations..."
docker compose $COMPOSE_FILES run --rm backend alembic upgrade head

# 5. Start services
echo "[5/6] Starting services..."
docker compose $COMPOSE_FILES up -d --remove-orphans

# 6. Health check
echo "[6/6] Waiting for services to be healthy..."
sleep 10

BACKEND_HEALTH=$(curl -sf http://localhost:80/api/health 2>/dev/null || echo "FAIL")
NGINX_HEALTH=$(curl -sf http://localhost:80/health 2>/dev/null || echo "FAIL")

echo ""
echo "=========================================="
echo " Deployment Status"
echo "=========================================="
echo "  Backend API:  ${BACKEND_HEALTH}"
echo "  Nginx proxy:  ${NGINX_HEALTH}"
echo ""
docker compose $COMPOSE_FILES ps
echo ""
echo "=========================================="
echo " StreamMatch is live at http://localhost"
echo "=========================================="
