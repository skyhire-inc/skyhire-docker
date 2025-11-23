@echo off
echo Activation de l'environnement virtuel...
call .\venv\Scripts\activate

echo Lancement du serveur FastAPI...
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause