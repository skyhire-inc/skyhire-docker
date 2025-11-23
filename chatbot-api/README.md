# Aeronautics Chatbot 

Un petit serveur FastAPI qui sert de démonstrateur RAG simple pour des questions liées à la cabine / aéronautique.

## Pré-requis
- Python 3.9+ (venv recommandé)
- Clé Gemini (GEMINI_API_KEY)

## Installation rapide
1. Cloner le dépôt
2. Créer et activer un environnement virtuel :

```powershell
python -m venv .\venv
.\venv\Scripts\Activate
```

3. Installer les dépendances :

```powershell
pip install -r requirements.txt
```

4. Créer un fichier `.env` à la racine (ne pas committer) :

```
GEMINI_API_KEY=sk-xxxxx
# optionnel: GEMINI_MODEL_NAME=models/gemini-2.5-flash
```

> Important : ajoutez `.env` à `.gitignore` et ne poussez jamais vos clés vers un dépôt public. Si une clé a été commise, révoquez/rotatez-la immédiatement.

## Lancer le serveur

```powershell
.\venv\Scripts\Activate
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```





## Sécurité Git
- Ajoutez `.env` à `.gitignore` :

```
echo ".env" >> .gitignore
```

- Si une clé a été poussée accidentellement, révoquez-la et utilisez `git rm --cached .env` puis réécrivez l'historique (BFG/git-filter-repo) si nécessaire.



