"""
Module d’analyse avancée pour CV bilingues FR/EN
Version 2.1 – Corrigée et enrichie

Auteur : MEDASH
"""

import re
from typing import List, Dict
from datetime import datetime


class BilingualCVParser:
    """
    Classe principale pour analyser un CV bilingue.
    Combine analyse structurée + textuelle (hybride).
    """

    def __init__(self):
        """Initialisation des dictionnaires, regex et mots-clés."""

        # Patrons de dates
        self.date_patterns = [
            r'\b(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?\s*\d{4}\b',
            r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s*\d{4}\b',
            r'\b\d{4}\s*[-–—]\s*(?:présent|aujourd\'hui|present|today|current)\b',
            r'\b\d{4}\s*[-–—]\s*\d{4}\b',
            r'\b\d{1,2}/\d{4}\b'
        ]

        # Mots-clés métiers
        self.job_keywords = {
            'fr': [
                'responsable', 'ingénieur', 'développeur', 'manager', 'consultant',
                'technicien', 'analyste', 'chef', 'directeur', 'spécialiste',
                'hôtesse', 'steward', 'agent', 'coordinateur', 'superviseur',
                'commercial', 'assistant', 'adjoint', 'chargé', 'représentant'
            ],
            'en': [
                'manager', 'engineer', 'developer', 'consultant', 'technician',
                'analyst', 'director', 'specialist', 'attendant', 'sales',
                'agent', 'coordinator', 'supervisor', 'crew', 'assistant',
                'officer', 'representative'
            ]
        }

        # Mots-clés formations
        self.education_keywords = {
            'fr': [
                'licence', 'master', 'bachelor', 'diplôme', 'université',
                'école', 'bac', 'baccalauréat', 'dut', 'bts', 'doctorat', 'ingénieur'
            ],
            'en': [
                'degree', 'master', 'bachelor', 'university', 'school',
                'diploma', 'phd', 'mba', 'certification'
            ]
        }

        # Mots-clés compétences spécifiques
        self.skills_keywords = {
            "informatique": [
                "python", "java", "c++", "sql", "html", "css", "javascript",
                "git", "docker", "linux", "windows", "api", "node.js",
                "react", "vue", "angular", "machine learning", "data analysis",
                "cloud", "cybersecurity", "devops", "scrum", "agile", "jira"
            ],
            "hotess_air": [
                "service à bord", "sécurité des passagers", "communication",
                "hospitalité", "gestion de stress", "multilingue",
                "gestion des urgences", "présentation soignée",
                "travail en équipe", "empathie", "ponctualité", "orientation client"
            ]
        }

        # Mots-clés centres d’intérêt
        self.interest_keywords = [
            "sport", "voyage", "lecture", "musique", "cinéma", "art",
            "bénévolat", "danse", "théâtre", "technologie", "gastronomie",
            "photographie", "randonnée", "yoga", "plongée", "natation",
            "mode", "culture", "histoire", "langues", "service client",
            "aventure", "bien-être", "fitness", "volontariat", "écologie", "innovation"
        ]

    # ==============================================================
    # MÉTHODE PRINCIPALE
    # ==============================================================
    def parse_bilingual_cv(self, structured_data: Dict) -> Dict:
        """Analyse complète du CV bilingue."""

        sections = structured_data.get('sections', {})
        language = structured_data.get('detected_language', 'fr')
        full_text = structured_data.get('full_text', '')

        if not full_text:
            full_text = "\n".join(sections.values())

        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        parsed_data = {
            "nom_complet": self._extract_name_from_text(lines, language),
            "intitule_poste": self._extract_job_title_from_text(lines, language),
            "contact": self._extract_contact_hybrid(full_text),
            "profil": self._extract_profile_v5(full_text),
            "experiences": self._extract_experiences_v6(full_text),
            "formations": self._extract_education_v5(full_text),
            "competences": self._extract_skills_v6(full_text),
            "langues": self._extract_languages_v5(full_text),
            "centres_interet": self._extract_interests_v6(full_text),
        }

        return parsed_data

    # ==============================================================
    # NOM COMPLET — corrigé
    # ==============================================================
    def _extract_name_from_text(self, lines: List[str], language: str) -> str:
        header_zone = lines[:10]
        blacklist = ["adresse", "email", "profil", "experience", "formation"]

        for line in header_zone:
            if any(b in line.lower() for b in blacklist):
                continue
            match = re.match(r"\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:[-\s][A-ZÀ-Ÿ][a-zà-ÿ]+)+)\b", line)
            if match:
                name = match.group(1)
                for kw in self.job_keywords["fr"] + self.job_keywords["en"]:
                    name = re.sub(rf"\b{kw}\b", "", name, flags=re.IGNORECASE)
                return name.strip()
        return ""

    # ==============================================================
    # POSTE
    # ==============================================================
    def _extract_job_title_from_text(self, lines: List[str], language: str) -> str:
        zone = " ".join(lines[:15]).lower()
        for kw in self.job_keywords["fr"] + self.job_keywords["en"]:
            if kw in zone:
                return kw.capitalize()
        return ""

    # ==============================================================
    # CONTACT
    # ==============================================================
    def _extract_contact_hybrid(self, text: str) -> Dict:
        phone = re.search(r"\b0[1-9](?:[\s.-]?\d{2}){4}\b", text)
        email = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
        addr = re.search(r"\b\d{5}\s+[A-ZÀ-Ÿ][\w\-]+", text)
        return {
            "telephone": phone.group() if phone else "",
            "email": email.group() if email else "",
            "adresse": addr.group() if addr else ""
        }

    # ==============================================================
    # PROFIL
    # ==============================================================
    def _extract_profile_v5(self, text: str) -> str:
        m = re.search(r"(profil|summary|about|objective).*?\n(.*?)\n\n", text, re.IGNORECASE | re.DOTALL)
        return m.group(2).strip() if m else ""

    # ==============================================================
    # EXPERIENCES – VERSION AMÉLIORÉE (entreprise + période)
    # ==============================================================
    def _extract_experiences_v6(self, text: str) -> List[Dict]:
        experiences = []
        blocks = re.split(r"(?i)(?:expérience|experience)\s*[:\-]?", text)

        for block in blocks[1:]:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            for i, line in enumerate(lines):
                if any(kw in line.lower() for kw in self.job_keywords["fr"] + self.job_keywords["en"]):
                    exp = {"poste": line, "entreprise": "", "periode": "", "details": []}

                    # entreprise (mot "chez" ou "at")
                    m_ent = re.search(r"(?:chez|at)\s+([A-Z][A-Za-z&\s]+)", line)
                    if m_ent:
                        exp["entreprise"] = m_ent.group(1).strip()

                    # période (date début-fin)
                    m_date = re.search(r"(\d{4})\s*[-–—]\s*(\d{4}|présent|present)", line.lower())
                    if m_date:
                        exp["periode"] = f"{m_date.group(1)} - {m_date.group(2).capitalize()}"

                    # détail supplémentaire
                    for j in range(i + 1, min(i + 4, len(lines))):
                        if not re.search(r"\d{4}", lines[j]):
                            exp["details"].append(lines[j])

                    experiences.append(exp)
        return experiences

    # ==============================================================
    # FORMATIONS
    # ==============================================================
    def _extract_education_v5(self, text: str) -> List[Dict]:
        lines = text.split("\n")
        formations = [ {"diplome": l.strip()} for l in lines
                      if any(k in l.lower() for k in self.education_keywords["fr"] + self.education_keywords["en"])]
        return formations

    # ==============================================================
    # COMPÉTENCES — enrichie avec dictionnaire
    # ==============================================================
    def _extract_skills_v6(self, text: str) -> List[str]:
        found = set()
        for domain, keywords in self.skills_keywords.items():
            for kw in keywords:
                if re.search(rf"\b{re.escape(kw)}\b", text.lower()):
                    found.add(kw.capitalize())
        return sorted(found)

    # ==============================================================
    # LANGUES
    # ==============================================================
    def _extract_languages_v5(self, text: str) -> List[Dict]:
        langs = []
        for lang in ["français", "anglais", "arabe", "espagnol", "allemand", "italien"]:
            if lang in text.lower():
                langs.append({"langue": lang.capitalize(), "niveau": "Courant"})
        return langs

    # ==============================================================
    # INTÉRÊTS — enrichi
    # ==============================================================
    def _extract_interests_v6(self, text: str) -> List[str]:
        found = []
        for kw in self.interest_keywords:
            if re.search(rf"\b{re.escape(kw)}\b", text.lower()):
                found.append(kw.capitalize())
        return sorted(found)
