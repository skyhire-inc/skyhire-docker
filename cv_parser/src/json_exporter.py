"""
Module d'export des données au format JSON avec support multilingue
"""
import json
import os
from datetime import datetime
from typing import Dict

class BilingualJSONExporter:
    def __init__(self, output_dir: str = './output'):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def export_cv_data(self, cv_data: Dict, filename: str = None) -> str:
        """
        Exporte les données CV au format JSON avec métadonnées multilingues
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cv_analysis_{timestamp}.json"
        
        filepath = os.path.join(self.output_dir, filename)
        
        # Extraire la langue détectée
        detected_lang = cv_data.get('metadata', {}).get('detected_language', 'unknown')
        if detected_lang == 'unknown' or not detected_lang:
            detected_lang = 'fr'  # Par défaut
        
        # Construire cv_data sans metadata
        cv_data_clean = {
            'nom_complet': cv_data.get('nom_complet', ''),
            'intitule_poste': cv_data.get('intitule_poste', ''),
            'contact': cv_data.get('contact', {
                'telephone': '',
                'email': '',
                'adresse': ''
            }),
            'profil': cv_data.get('profil', ''),
            'experiences': cv_data.get('experiences', []),
            'formations': cv_data.get('formations', []),
            'competences': cv_data.get('competences', []),
            'langues': cv_data.get('langues', []),
            'centres_interet': cv_data.get('centres_interet', [])
        }
        
        export_data = {
            'metadata': {
                'export_date': datetime.now().isoformat(),
                'version': '2.0',
                'source': 'Bilingual_CV_Analyzer',
                'language_support': ['fr', 'en'],
                'detected_language': detected_lang
            },
            'cv_data': cv_data_clean
        }
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            return filepath
        except Exception as e:
            raise Exception(f"Erreur lors de l'export JSON: {str(e)}")