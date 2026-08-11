#!/usr/bin/env bash
# Lance BatiSelf (backend + frontend) en local

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

echo "▶ Démarrage du backend FastAPI..."
cd "$BACKEND_DIR"
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "▶ Démarrage du frontend Vite..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ BatiSelf démarré !"
echo "   → Application : http://localhost:5173"
echo "   → API docs    : http://localhost:8000/docs"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Arrêt.'" INT TERM
wait
