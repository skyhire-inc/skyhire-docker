"""
Module d'interface avec EasyOCR pour CV multilingues (FR + EN)
Version compatible avec l'ancien et le nouveau code
"""
import easyocr
import cv2
import numpy as np
from typing import List, Dict

class MultilingualOCREngine:
    def __init__(self):
        """
        Initialise le lecteur EasyOCR avec français et anglais
        """
        self.reader = easyocr.Reader(
            ['fr', 'en'],  # Français et anglais simultanément
            gpu=False,
            model_storage_directory='./models',
            download_enabled=True,
            detector=True,
            recognizer=True
        )
        self.min_confidence = 0.6
    
    def detect_language(self, text: str) -> Dict[str, float]:
        """
        Détecte la langue dominante du texte
        """
        # Mots-clés français
        fr_keywords = ['profil', 'expérience', 'formation', 'compétences', 
                      'langues', 'centres d\'intérêt', 'chez', 'rue', 'boulevard']
        
        # Mots-clés anglais
        en_keywords = ['profile', 'experience', 'education', 'skills', 
                      'languages', 'interests', 'at', 'street', 'avenue']
        
        text_lower = text.lower()
        fr_score = sum(1 for keyword in fr_keywords if keyword in text_lower)
        en_score = sum(1 for keyword in en_keywords if keyword in text_lower)
        
        total = fr_score + en_score if (fr_score + en_score) > 0 else 1
        
        return {
            'french': fr_score / total,
            'english': en_score / total,
            'primary': 'french' if fr_score >= en_score else 'english'
        }
    
    def extract_text(self, image) -> List[dict]:
        """
        Extrait le texte d'une image avec détection multilingue
        """
        # Conversion pour EasyOCR
        if isinstance(image, np.ndarray):
            ocr_image = image
        else:
            ocr_image = np.array(image)
            if len(ocr_image.shape) == 3:
                ocr_image = cv2.cvtColor(ocr_image, cv2.COLOR_RGB2BGR)
        
        # Extraction OCR avec les deux langues
        results = self.reader.readtext(
            ocr_image,
            paragraph=True,
            min_size=10,
            text_threshold=0.7,
            low_text=0.4,
            link_threshold=0.4
        )
        
        # Formatage des résultats
        formatted_results = []
        for result in results:
            # EasyOCR peut retourner soit (bbox, text, confidence) soit (bbox, text) avec paragraph=True
            if len(result) == 3:
                bbox, text, confidence = result
            elif len(result) == 2:
                bbox, text = result
                confidence = 1.0  # Confiance par défaut si non fournie
            else:
                continue  # Ignorer les formats inattendus
            
            if confidence >= self.min_confidence:
                formatted_results.append({
                    'bbox': bbox,
                    'text': text.strip(),
                    'confidence': round(confidence, 3),
                    'word_count': len(text.split())
                })
        
        return formatted_results
    
    def extract_text_with_language(self, image) -> Dict:
        """
        Extrait le texte et détecte la langue
        Compatible avec l'ancien et le nouveau code
        """
        results = self.extract_text(image)
        full_text = ' '.join([r['text'] for r in results])
        language_info = self.detect_language(full_text)
        
        # Retourner avec tous les champs pour compatibilité
        return {
            'ocr_results': results,
            'language_info': language_info,
            'full_text': full_text,
            'total_words': len(full_text.split()),  # Ajouté pour nouveau code
            'total_blocks': len(results)  # Ajouté pour nouveau code
        }