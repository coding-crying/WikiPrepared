#!/usr/bin/env bash
# chmod +x start-maps.sh
# ──────────────────────────────────────────────────────────────────────
# WikiPrepared Maps — Launcher (Linux / macOS)
# Starts Martin tile server + miniserve SPA, opens browser.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Platform detection ────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  MARTIN_BIN="./bin/martin-linux-x86_64";  MINISERVE_BIN="./bin/miniserve-linux-x86_64" ;;
  Darwin*) MARTIN_BIN="./bin/martin-darwin-arm64";  MINISERVE_BIN="./bin/miniserve-darwin-arm64" ;;
  *)       echo "⚠ Unsupported OS: $OS"; exit 1 ;;
esac

# Fallback: check if generic names exist
if [ ! -f "$MARTIN_BIN" ]; then
  if [ -f "./bin/martin-linux-x86_64" ]; then
    MARTIN_BIN="./bin/martin-linux-x86_64"
  else
    echo "⚠ Martin binary not found at $MARTIN_BIN"
  fi
fi
if [ ! -f "$MINISERVE_BIN" ]; then
  if [ -f "./bin/miniserve-linux-x86_64" ]; then
    MINISERVE_BIN="./bin/miniserve-linux-x86_64"
  else
    echo "⚠ miniserve binary not found at $MINISERVE_BIN"
  fi
fi

chmod +x "$MARTIN_BIN" 2>/dev/null || true
chmod +x "$MINISERVE_BIN" 2>/dev/null || true

# ── Find free ports ──────────────────────────────────────────────────
find_free_port() {
  local start="${1:-3111}"
  local port="$start"
  while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":${port} "; do
    port=$((port + 1))
    if [ "$port" -gt 65535 ]; then
      echo "❌ No free port found starting from $start" >&2
      exit 1
    fi
  done
  echo "$port"
}

MARTIN_PORT="$(find_free_port 3111)"
MINISERVE_PORT="$(find_free_port 3001)"

# Ensure miniserve port != martin port
if [ "$MINISERVE_PORT" -eq "$MARTIN_PORT" ]; then
  MINISERVE_PORT="$(find_free_port $((MARTIN_PORT + 1)))"
fi

echo "──────────────────────────────────────"
echo " WikiPrepared Maps Launcher"
echo "──────────────────────────────────────"
echo " Platform     : $OS"
echo " Martin       : $MARTIN_BIN"
echo " Miniserve    : $MINISERVE_BIN"
echo " Martin port  : $MARTIN_PORT"
echo " Miniserve    : $MINISERVE_PORT"
echo "──────────────────────────────────────"

# ── Temp config for Martin (patch port) ──────────────────────────────
MARTIN_CONFIG="$SCRIPT_DIR/config/martin-config.yaml"
if [ -f "$MARTIN_CONFIG" ]; then
  echo "✓ Martin config found: $MARTIN_CONFIG"
else
  echo "⚠ Martin config not found at $MARTIN_CONFIG — using defaults"
fi

# ── Start Martin ────────────────────────────────────────────────────
MARTIN_PID=""
cleanup() {
  echo ""
  echo "🛑 Shutting down servers..."
  [ -n "$MARTIN_PID" ] && kill "$MARTIN_PID" 2>/dev/null || true
  [ -n "$MINISERVE_PID" ] && kill "$MINISERVE_PID" 2>/dev/null || true
  wait 2>/dev/null
  echo "✓ Clean exit."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "🗺️  Starting Martin tile server on port $MARTIN_PORT..."
"$MARTIN_BIN" --config "$MARTIN_CONFIG" --port "$MARTIN_PORT" &
MARTIN_PID=$!

# Give Martin a moment to bind
sleep 1

# ── Start miniserve ─────────────────────────────────────────────────
echo "🌐 Starting miniserve SPA on port $MINISERVE_PORT..."
"$MINISERVE_BIN" --port "$MINISERVE_PORT" --index index.html --spa web/ &
MINISERVE_PID=$!

# ── Patch style-dark.json with correct Martin port (if needed) ──────
STYLE_FILE="$SCRIPT_DIR/web/style-dark.json"
if [ -f "$STYLE_FILE" ] && [ "$MARTIN_PORT" -ne 3111 ]; then
  echo "🔧 Patching style-dark.json to use port $MARTIN_PORT..."
  if command -v sed >/dev/null 2>&1; then
    sed -i.bak "s|localhost:3000|localhost:$MARTIN_PORT|g" "$STYLE_FILE"
    rm -f "$STYLE_FILE.bak"
  fi
fi

# ── Open browser ────────────────────────────────────────────────────
SPA_URL="http://localhost:${MINISERVE_PORT}"
echo ""
echo "✅ WikiPrepared Maps ready!"
echo "   Tile server : http://localhost:${MARTIN_PORT}"
echo "   SPA         : $SPA_URL"
echo ""

# Small delay then open browser
sleep 1.5
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$SPA_URL" 2>/dev/null &
elif command -v open >/dev/null 2>&1; then
  open "$SPA_URL" 2>/dev/null &
elif command -v sensible-browser >/dev/null 2>&1; then
  sensible-browser "$SPA_URL" 2>/dev/null &
fi

echo "Press Ctrl+C to stop."
wait