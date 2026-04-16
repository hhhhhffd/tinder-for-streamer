#!/usr/bin/env bash
# ============================================================
# StreamMatch — Health Check Script
# Verifies all services are running and responding
# ============================================================
set -euo pipefail

BASE_URL="${1:-http://localhost}"
EXIT_CODE=0

echo "StreamMatch Health Check — ${BASE_URL}"
echo "=========================================="

# Check nginx
printf "  Nginx proxy:     "
if curl -sf "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "OK"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Check backend API
printf "  Backend API:      "
BACKEND_RESP=$(curl -sf "${BASE_URL}/api/health" 2>/dev/null || echo "")
if [ -n "$BACKEND_RESP" ]; then
    echo "OK"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Check frontend
printf "  Frontend:         "
if curl -sf "${BASE_URL}/" >/dev/null 2>&1; then
    echo "OK"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Docker services
echo ""
echo "Docker Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (docker compose not available)"

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "All checks PASSED"
else
    echo "Some checks FAILED"
fi

exit $EXIT_CODE
