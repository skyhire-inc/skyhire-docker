"""
Module de nettoyage et structuration du texte pour CV bilingues
Version corrigée avec meilleure détection de sections
"""
import re
from typing import List, Dict


class BilingualTextProcessor:
    def __init__(self):
        # Mots-clés des sections - version stricte
        self.section_keywords = {
            'profil': {
                'fr': ['profil', 'à propos', 'résumé', 'objectif'],
                'en': ['profile', 'about', 'summary', 'objective']
            },
            'experience': {
                'fr': ['expérience professionnelle', 'expérience', 'parcours professionnel'],
                'en': ['work experience', 'professional experience', 'experience', 'employment']
            },
            'formation': {
                'fr': ['formation', 'éducation', 'études', 'diplômes'],
                'en': ['education', 'training', 'academic background']
            },
            'competences': {
                'fr': ['compétence', 'compétences', 'savoir-faire', 'aptitudes'],
                'en': ['skills', 'competencies', 'abilities']
            },
            'langues': {
                'fr': ['langue', 'langues', 'maîtrise linguistique'],
                'en': ['language', 'languages', 'linguistic skills']
            },
            'centres_interet': {
                'fr': ['centre d\'intérêt', 'centres d\'intérêt', 'intérêt', 'intérêts', 'loisir', 'loisirs'],
                'en': ['interest', 'interests', 'hobby', 'hobbies', 'activities']
            },
            'informations': {
                'fr': ['informations personnelles', 'contact', 'coordonnées'],
                'en': ['personal information', 'contact', 'contact information']
            }
        }

    def clean_ocr_text(self, ocr_results: List[dict]) -> str:
        """Nettoie et assemble le texte extrait par l'OCR"""
        if not ocr_results:
            return ""
        
        # Tri par position verticale puis horizontale
        sorted_results = sorted(
            ocr_results,
            key=lambda x: (x['bbox'][0][1], x['bbox'][0][0])
        )

        # Assemblage intelligent du texte
        lines = []
        current_line = []
        current_y = None
        y_threshold = 15

        for result in sorted_results:
            text = result['text'].strip()
            if not text:
                continue
                
            y_pos = result['bbox'][0][1]

            # Nouvelle ligne si le Y est trop différent
            if current_y is None or abs(y_pos - current_y) > y_threshold:
                if current_line:
                    line_text = ' '.join(current_line)
                    lines.append(line_text)
                    current_line = []
                current_y = y_pos

            current_line.append(text)

        # Ajouter la dernière ligne
        if current_line:
            lines.append(' '.join(current_line))

        full_text = '\n'.join(lines)
        
        return self._apply_text_corrections(full_text)

    def _apply_text_corrections(self, text: str) -> str:
        """Applique des corrections OCR courantes"""
        # Corrections de caractères mal reconnus
        corrections = {
            r'\bO\b': '0',
            r'\bl\b': '1',
            r'(\d)O(\d)': r'\g<1>0\g<2>',
            r'(\d)l(\d)': r'\g<1>1\g<2>',
        }
        
        for pattern, replacement in corrections.items():
            text = re.sub(pattern, replacement, text)
        
        # Nettoyer les espaces
        text = re.sub(r' +', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        return text.strip()

    def detect_document_language(self, text: str) -> str:
        """Détecte la langue principale du document"""
        if not text:
            return 'fr'
        
        text_lower = text.lower()

        fr_indicators = 0
        for section in self.section_keywords.values():
            for keyword in section['fr']:
                pattern = r'\b' + re.escape(keyword) + r'\b'
                fr_indicators += len(re.findall(pattern, text_lower))

        en_indicators = 0
        for section in self.section_keywords.values():
            for keyword in section['en']:
                pattern = r'\b' + re.escape(keyword) + r'\b'
                en_indicators += len(re.findall(pattern, text_lower))

        if fr_indicators > en_indicators * 1.2:
            return 'fr'
        elif en_indicators > fr_indicators * 1.2:
            return 'en'
        else:
            return 'mixed'

    def extract_structured_sections(self, text: str, language: str = 'auto') -> Dict[str, str]:
        """Identifie les sections principales du CV avec meilleure précision"""
        if language == 'auto':
            language = self.detect_document_language(text)

        sections = {}
        lines = text.split('\n')

        # Détecter les titres de section (lignes courtes avec mots-clés)
        section_positions = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped or len(line_stripped) > 40:  # Titre pas trop long
                continue
            
            line_lower = line_stripped.lower()
            
            # Vérifier chaque type de section
            for section_name, keywords in self.section_keywords.items():
                lang_keywords = keywords.get(language, [])
                
                if language == 'mixed':
                    lang_keywords = keywords['fr'] + keywords['en']
                
                # Chercher si un mot-clé correspond EXACTEMENT
                for keyword in lang_keywords:
                    # Le titre doit être le mot-clé seul ou avec ":"
                    if (line_lower == keyword or 
                        line_lower == keyword + ':' or
                        line_lower == keyword + ' :' or
                        line_lower.startswith(keyword + ' ') and len(line_stripped.split()) <= 4):
                        
                        section_positions.append({
                            'line_index': i,
                            'section_name': section_name,
                            'matched_keyword': keyword
                        })
                        break
                
                if section_positions and section_positions[-1]['line_index'] == i:
                    break
        
        # Extraire le contenu de chaque section
        if section_positions:
            for i, section_info in enumerate(section_positions):
                start_line = section_info['line_index'] + 1
                
                # Trouver la ligne de fin
                if i + 1 < len(section_positions):
                    end_line = section_positions[i + 1]['line_index']
                else:
                    end_line = len(lines)
                
                # Extraire le contenu
                section_content = '\n'.join(lines[start_line:end_line]).strip()
                
                if section_content:
                    sections[section_info['section_name']] = section_content
            
            # Extraire le header (avant la première section)
            if section_positions:
                first_section_line = section_positions[0]['line_index']
                header_content = '\n'.join(lines[:first_section_line]).strip()
                if header_content:
                    sections['header'] = header_content
        else:
            # Pas de sections détectées, extraire un header basique
            header_lines = []
            for i, line in enumerate(lines[:20]):
                line_stripped = line.strip()
                if not line_stripped:
                    continue
                
                # Arrêter si on trouve un indicateur de section
                is_section = False
                for section_keywords in self.section_keywords.values():
                    all_keywords = section_keywords.get('fr', []) + section_keywords.get('en', [])
                    if any(kw in line_stripped.lower() for kw in all_keywords):
                        if len(line_stripped.split()) <= 4:  # Titre court
                            is_section = True
                            break
                
                if is_section:
                    break
                
                header_lines.append(line_stripped)
            
            if header_lines:
                sections['header'] = '\n'.join(header_lines)
            else:
                sections['header'] = '\n'.join(lines[:10])

        return {
            'sections': sections,
            'detected_language': language,
            'full_text': text
        }