#!/usr/bin/env bash
# ==============================================================================
# KLG Metrology - Lancement complet (Linux / macOS)
# ==============================================================================
set -e
cd "$(dirname "$0")"

echo "[1/3] Vérification des dépendances Python..."
cd backend
pip install -r requirements.txt --quiet --break-system-packages 2>/dev/null || pip install -r requirements.txt --quiet
cd ..

if [ ! -f "frontend/dist/index.html" ]; then
    echo "[2/3] Build du frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
else
    echo "[2/3] Frontend déjà buildé, on passe. (supprimez frontend/dist pour rebuild)"
fi

echo "[3/3] Démarrage du serveur sur http://localhost:8000 ..."
echo "Ouvrez votre navigateur sur http://localhost:8000"
echo "Appuyez sur CTRL+C pour arrêter."
cd backend
python3 server.py --camera 0
