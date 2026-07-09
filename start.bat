@echo off
REM ============================================================================
REM KLG Metrology - Lancement complet (Windows)
REM ============================================================================
REM Ce script :
REM   1. Installe les dependances Python si besoin
REM   2. Build le frontend React (une seule fois, ou si modifie)
REM   3. Demarre le serveur (backend + frontend sur http://localhost:8000)
REM ============================================================================

cd %~dp0

echo [1/3] Verification des dependances Python...
cd backend
pip install -r requirements.txt --quiet
cd ..

if not exist "frontend\dist\index.html" (
    echo [2/3] Build du frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
) else (
    echo [2/3] Frontend deja build, on passe. ^(supprimez frontend\dist pour rebuild^)
)

echo [3/3] Demarrage du serveur sur http://localhost:8000 ...
echo Ouvrez votre navigateur sur http://localhost:8000
echo Appuyez sur CTRL+C pour arreter.
cd backend
python server.py --camera 0
