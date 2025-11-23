from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
import logging
from typing import List, Optional
import re
from dotenv import load_dotenv

# Charge le .env
load_dotenv()

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Aeronautics Chatbot API",
    description="Chatbot spécialisé en aéronautique utilisant Gemini 2",
    version="2.0.0"
)

# Debug: Vérification de la clé API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
print("=== CONFIGURATION GEMINI 2 ===")
print("🔑 Clé API présente:", "OUI" if GEMINI_API_KEY else "NON")
if GEMINI_API_KEY:
    print("📏 Longueur clé:", len(GEMINI_API_KEY))
print("==============================")


def list_available_gemini_models(api_key: str, timeout: int = 8) -> None:
    """Safe helper: calls the ListModels endpoint and logs available model names.

    This does not print the API key. It helps diagnose which model names and
    API versions are supported for your key (useful when you get 404s).
    """
    try:
        url = "https://generativelanguage.googleapis.com/v1/models"
        resp = requests.get(f"{url}?key={api_key}", timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            models = []
            # The response usually contains a 'models' list with 'name' fields
            for m in data.get("models", []):
                # name examples: "models/text-bison-001" or full resource names
                name = m.get("name") or m.get("model") or str(m)
                models.append(name)

            if models:
                logger.info("Liste des modèles disponibles récupérée (%d) : %s", len(models), ", ".join(models))
                # Helpful hint (no secrets): recommend picking a model from the list
                logger.info("Conseil: choisissez un modèle listé ci-dessus et adaptez GEMINI_API_URL en conséquence.")
            else:
                logger.warning("ListModels renvoyé sans modèles ou format inattendu: %s", resp.text[:400])
        else:
            logger.warning("ListModels returned HTTP %s: %s", resp.status_code, resp.text[:400])
    except Exception as e:
        logger.warning("Impossible d'appeler ListModels: %s", str(e))


if GEMINI_API_KEY:
    # Try to list models at startup to help debugging 404s like 'model not found'
    list_available_gemini_models(GEMINI_API_KEY)

# Autoriser les requêtes depuis partout
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles de données
class ChatRequest(BaseModel):
    question: str
    language: Optional[str] = None  # 'fr' or 'en' or None for auto-detect
    include_sources: Optional[bool] = True
    brief: Optional[bool] = False

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

# Model selection: prefer GEMINI_MODEL_NAME env var (resource name like "models/gemini-2.5-pro")
# If not set, default to a commonly available model returned by ListModels above.
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "models/gemini-2.5-flash")
# Construct the v1 endpoint for generateContent using the model resource name
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1/{GEMINI_MODEL_NAME}:generateContent"

# Base de connaissances cabine (chargée depuis cabin_docs.json)
class CabinCrewRetriever:
    def __init__(self, json_path: str = None):
        import json
        self.docs = []
        if json_path is None:
            json_path = os.path.join(os.path.dirname(__file__), "cabin_docs.json")
        try:
            with open(json_path, "r", encoding="utf-8") as fh:
                self.docs = json.load(fh)
        except FileNotFoundError:
            logger.warning("cabin_docs.json non trouvé; utilisation d'un jeu de données vide.")
            self.docs = []
        except Exception as e:
            logger.warning("Erreur lecture cabin_docs.json: %s", str(e))
            self.docs = []

    def retrieve(self, question: str, top_k: int = 3) -> List[dict]:
        """Simple in-memory retrieval by token overlap. Returns top_k docs with highest overlap.

        This is intentionally simple so it works offline without external embedding services.
        """
        logger.info(f"Recherche de documents cabine pour: {question}")
        q_tokens = set(re.findall(r"\w+", question.lower()))
        scores = []
        for doc in self.docs:
            text = (doc.get("text") or "") + " " + (doc.get("source") or "")
            doc_tokens = set(re.findall(r"\w+", text.lower()))
            overlap = len(q_tokens & doc_tokens)
            scores.append((overlap, doc))

        # sort by overlap desc, tie-breaker: original order
        scores.sort(key=lambda x: x[0], reverse=True)
        # If all scores are zero, fall back to returning first top_k docs
        if scores and scores[0][0] == 0:
            selected = [d for _, d in scores[:top_k]] if scores else []
            if not selected and self.docs:
                return self.docs[:top_k]
            return selected

        return [d for _, d in scores[:top_k]]


mock_retriever = CabinCrewRetriever()

def detect_language(text: str) -> str:
    """Very small heuristic to detect French vs English. Returns 'fr' or 'en'."""
    if not text:
        return 'fr'
    t = text.lower()
    # French indicators
    fr_indicators = ['quoi', 'quelle', 'quelles', 'quel', 'comment', 'pourquoi', 'bonjour', 'salut', 'est-ce', 'à', 'â', 'é', 'è', 'ê', 'ù']
    en_indicators = ['what', 'which', 'how', 'why', 'hello', 'hi', 'the', 'is', 'are']
    fr_score = sum(1 for w in fr_indicators if w in t)
    en_score = sum(1 for w in en_indicators if w in t)
    return 'fr' if fr_score >= en_score else 'en'


def build_prompt(question: str, retrieved_docs: List[dict], language: str = 'fr', include_sources: bool = True, brief: bool = False) -> str:
    if language == 'en':
        system_prompt = """You are an expert aeronautics assistant. Follow these rules:

1. Prefer to answer using the provided sources and always cite them when used.
2. If the provided sources are insufficient, you may answer using your broader knowledge; when you do so, clearly indicate that the information comes from your own knowledge (for example prefix with "[No source]") and recommend verifying with the airline.
3. If you combine sources and your own knowledge, cite the sources used and clearly label any added general-knowledge content.
4. Be technical and precise in your explanations.
5. Answer in English unless requested otherwise.
6. If the question is unrelated to aeronautics, politely decline and state your specialization."""
    else:
        system_prompt = """Tu es un assistant expert en aéronautique. Suis ces règles :

1. Privilégie les informations issues des sources fournies et cite-les systématiquement lorsqu'elles sont utilisées.
2. Si les sources fournies sont insuffisantes, tu peux compléter la réponse en t'appuyant sur tes connaissances générales ; dans ce cas indique clairement que l'information provient de tes connaissances (par exemple en préfixant par "[Sans source]") et conseille de vérifier auprès de la compagnie.
3. Si tu combines des informations provenant des sources et des connaissances générales, cite les sources utilisées et marque clairement les éléments ajoutés par tes connaissances.
4. Sois technique et précis dans tes explications.
5. Réponds dans la langue demandée (français par défaut), sauf indication contraire.
6. Si la question n'est pas liée à l'aéronautique, décline poliment et explique ta spécialisation."""

    # Build two variants of the retrieved-docs text: one that includes source names
    # (used when include_sources=True) and a plain text variant (used when include_sources=False)
    sources_text_with_names = "\n\n".join([
        f"Source #{i+1} [Source: {doc['source']}]: {doc['text']}" 
        for i, doc in enumerate(retrieved_docs)
    ])

    sources_text_plain = "\n\n".join([doc.get("text", "") for doc in retrieved_docs])

    if language == 'en':
        # choose which retrieved-docs block to include in the prompt
        docs_block = sources_text_with_names if include_sources else sources_text_plain
        brief_instr = "Be concise and give a short, step-by-step answer." if brief else "Provide a clear, detailed answer."
        prompt = f"""{system_prompt}

RETRIEVED INFORMATION:
{docs_block}

QUESTION: {question}

INSTRUCTIONS: {brief_instr} Prefer to use the retrieved information above when relevant. If the retrieved information is insufficient, you may answer using your broader knowledge but clearly mark such parts with the prefix "[No source]" and recommend verification with the airline. If you combine retrieved information and general knowledge, indicate which parts come from the retrieved data and which are general knowledge."""
    else:
        docs_block = sources_text_with_names if include_sources else sources_text_plain
        brief_instr = "Sois concis·e et donne une réponse courte, en étapes." if brief else "Donne une réponse claire et détaillée."
        prompt = f"""{system_prompt}

INFORMATIONS RÉCUPÉRÉES:
{docs_block}

QUESTION: {question}

INSTRUCTIONS: {brief_instr} Privilégie les informations récupérées ci-dessus lorsqu'elles sont pertinentes. Si ces informations sont insuffisantes, tu peux compléter avec tes connaissances générales mais indique clairement ces parties avec le préfixe "[Sans source]" et conseille de vérifier auprès de la compagnie. Si tu combines informations récupérées et connaissances générales, précise l'origine de chaque élément."""

    return prompt

def call_gemini_api(prompt: str) -> str:
    if not GEMINI_API_KEY:
        return "❌ ERREUR: Clé API Gemini manquante. Vérifie ton fichier .env"
    
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "topK": 40,
            "topP": 0.8,
            "maxOutputTokens": 1024,
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH", 
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    }
    
    try:
        print(f"🔧 Appel de Gemini 2.0 Flash...")
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"🔧 Statut HTTP: {response.status_code}")
        
        if response.status_code != 200:
            # Essayons avec le modèle Gemini Pro standard si Gemini 2 échoue
            if "flash-exp" in GEMINI_API_URL:
                print("🔄 Gemini 2.0 Flash non disponible, tentative avec Gemini Pro...")
                fallback_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
                response = requests.post(
                    f"{fallback_url}?key={GEMINI_API_KEY}",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
            if response.status_code != 200:
                return f"❌ Erreur API ({response.status_code}): {response.text}"
        
        result = response.json()

        # Try several common response shapes from Gemini / Generative Language APIs.
        # Be permissive: return the first textual content we can find.
        def extract_text_from_candidate(cand: dict):
            # Common new v1 shape: cand["content"]["parts"][0]["text"]
            try:
                content = cand.get("content")
                if isinstance(content, dict):
                    parts = content.get("parts")
                    if isinstance(parts, list) and len(parts) > 0:
                        first = parts[0]
                        # either a dict with 'text' or a string
                        if isinstance(first, dict) and "text" in first:
                            return first["text"]
                        if isinstance(first, str):
                            return first
                # Older/alternate shape: cand.get('content') may be a string
                if isinstance(content, str):
                    return content
            except Exception:
                pass
            # Fallback: try top-level text-like keys
            for key in ("text", "output", "message", "answer"):
                v = cand.get(key)
                if isinstance(v, str):
                    return v
            return None

        # 1) 'candidates' list (common)
        if isinstance(result, dict) and "candidates" in result and isinstance(result["candidates"], list) and len(result["candidates"]) > 0:
            text = extract_text_from_candidate(result["candidates"][0])
            if text:
                return text

        # 2) Some responses include an 'output' or 'outputs' field
        if isinstance(result, dict):
            # check 'output' list
            out = result.get("output") or result.get("outputs")
            if isinstance(out, list) and len(out) > 0:
                # try to extract text from first output element
                first = out[0]
                if isinstance(first, dict):
                    # sometimes it's {'content': [{'type':'output_text','text': '...'}]}
                    # try several nested shapes
                    # shape: first['content'][0]['text']
                    c = first.get("content")
                    if isinstance(c, list) and len(c) > 0:
                        el = c[0]
                        if isinstance(el, dict) and "text" in el:
                            return el["text"]
                        if isinstance(el, str):
                            return el
                    # or: first.get('text')
                    if "text" in first and isinstance(first["text"], str):
                        return first["text"]

        # 3) Some APIs return a direct 'text' or 'response' field
        for top_key in ("text", "response", "answer", "message"):
            if top_key in result and isinstance(result[top_key], str):
                return result[top_key]

        # If we couldn't find a textual result, log the raw result for debugging and return an informative error
        logger.warning("Réponse API Gemini inattendue / non parsable. Clés présentes: %s", list(result.keys()) if isinstance(result, dict) else type(result))
        logger.debug("Réponse brute Gemini: %s", result)
        return f"❌ Erreur API: format inattendu de la réponse (clés: {','.join(list(result.keys())) if isinstance(result, dict) else str(type(result))})"
            
    except Exception as e:
        return f"❌ Erreur API: {str(e)}"


def sanitize_answer(answer: str, include_sources: bool) -> str:
    """Sanitize the model answer when include_sources is False.

    Removes any inline source markers or lines that explicitly list sources so the
    final returned text does not expose references when the caller requested no refs.
    """
    if include_sources:
        return answer

    if not answer:
        return answer

    # Remove bracketed source markers like [Source: Name]
    ans = re.sub(r"\[Source:\s*[^\]]+\]", "", answer)

    # Remove common 'Sources:' lines (English/French) and following content on same line
    ans = re.sub(r"(?im)^\s*(?:sources|📚 sources|sources utilisées)[:\s].*$", "", ans)

    # Remove patterns like 'Sources: ...' appearing inline
    ans = re.sub(r"(?i)sources?:\s*[^\n]+", "", ans)

    # If the mock fallback appended a Sources list after a newline, remove that block
    ans = re.sub(r"(?is)\(MOCK\).*?Sources?:.*$", lambda m: m.group(0).split('Sources:')[0], ans)

    # Trim extra whitespace and blank lines
    lines = [line.rstrip() for line in ans.splitlines()]
    # keep non-empty lines or preserve short message structure
    cleaned = "\n".join([l for l in lines if l.strip()])
    return cleaned.strip()


def reduce_answer_to_brief(answer: str, max_sentences: int = 1) -> str:
    """Reduce the model answer to a short paragraph or a single sentence.

    Strategy:
    - If the answer contains multiple paragraphs, keep the first non-empty paragraph.
    - Then keep at most `max_sentences` sentences from that paragraph (split on .!?).
    - Fall back to returning the original answer if splitting fails.
    """
    if not answer:
        return answer

    # 1) Keep first paragraph
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", answer) if p.strip()]
    para = paragraphs[0] if paragraphs else answer.strip()

    # 2) Split into sentences (basic heuristic)
    # Keep punctuation for clarity
    sentence_end_re = re.compile(r'(?<=[\.\!\?])\s+')
    sentences = sentence_end_re.split(para)
    if not sentences:
        return para.strip()

    brief_sentences = sentences[:max_sentences]
    brief = " ".join(s.strip() for s in brief_sentences).strip()

    # If the brief result looks empty, fallback to first 100 chars
    if not brief:
        return para.strip()[:200].strip()

    return brief


def fallback_answer_from_docs(question: str, retrieved_docs: List[dict], language: str = 'fr', include_sources: bool = True, brief: bool = False) -> str:
    """Build a simple answer from the retrieved docs when the LLM API isn't available (e.g., 429 quota).

    Strategy:
    - Extract a few key sentences from top docs (first ~300 chars per doc)
    - Prepend a clear note that this is a temporary, source-based summary
    """
    header_en = "Temporary fallback: showing a brief summary based on available sources (model quota exceeded)."
    header_fr = "Mode secours: résumé basé sur les sources disponibles (quota modèle dépassé)."

    max_docs = 1 if brief else 3
    parts: List[str] = []
    for i, doc in enumerate(retrieved_docs[:max_docs]):
        text = (doc.get("text") or "").strip()
        src = (doc.get("source") or "Unknown")
        limit = 160 if brief else 300
        snippet = text[:limit].strip()
        if len(text) > limit:
            snippet += "…"
        if snippet:
            if include_sources:
                parts.append(f"- [{src}] {snippet}")
            else:
                parts.append(f"- {snippet}")

    body = "\n".join(parts) if parts else ("- No local sources available for this query." if language == 'en' else "- Aucune source locale disponible pour cette question.")

    if language == 'en':
        return f"{header_en}\n\nQuestion: {question}\n\n{body}\n\nNote: Verify with the airline for official guidance."
    return f"{header_fr}\n\nQuestion: {question}\n\n{body}\n\nNote: Vérifiez auprès de la compagnie pour des informations officielles."

@app.get("/")
async def root():
    return {
        "message": "🚀 API Chatbot Aéronautique avec Gemini 2", 
        "status": "actif",
        "model": "gemini-2.0-flash-exp",
        "api_key_configuree": "OUI" if GEMINI_API_KEY else "NON"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "api_configured": bool(GEMINI_API_KEY),
        "service": "aeronautics-chatbot-gemini2"
    }

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Question: {request.question}")
        
        # 1. Récupère les documents
        retrieved_docs = mock_retriever.retrieve(request.question)
        
        # 2. Determine language and construct the prompt
        if request.language and request.language.lower() in ('fr', 'en'):
            lang = request.language.lower()
        else:
            lang = detect_language(request.question)

        prompt = build_prompt(request.question, retrieved_docs, language=lang, include_sources=bool(request.include_sources), brief=bool(request.brief))
        print(f"📝 Prompt construit ({len(prompt)} caractères)")

        # 3. Appelle Gemini
        answer = call_gemini_api(prompt)

        # 3.5 Fallback if Gemini failed (e.g., 429 quota)
        if isinstance(answer, str) and answer.strip().startswith("❌"):
            answer = fallback_answer_from_docs(
                request.question,
                retrieved_docs,
                language=lang,
                include_sources=bool(request.include_sources),
                brief=bool(request.brief)
            )
        else:
            # Sanitize answer if user requested no sources
            answer = sanitize_answer(answer, bool(request.include_sources))
            # If the client requested a brief answer, enforce a short reply server-side
            if bool(request.brief):
                answer = reduce_answer_to_brief(answer, max_sentences=1)

        # 4. Extrait les sources (only return sources when requested)
        if bool(request.include_sources):
            sources = list(set([doc["source"] for doc in retrieved_docs]))
        else:
            sources = []

        logger.info(f"✅ Réponse générée avec {len(sources)} sources")

        return ChatResponse(
            answer=answer,
            sources=sources
        )
        
    except Exception as e:
        logger.error(f"Erreur endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

# Endpoint de test
@app.get("/test")
async def test_endpoint():
    return {
        "message": "API Gemini 2 fonctionne!",
        "gemini_configure": "OUI" if GEMINI_API_KEY else "NON",
        "endpoint": GEMINI_API_URL
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)