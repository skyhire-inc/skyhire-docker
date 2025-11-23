"""
Script principal d'analyse de CV bilingues (français/anglais)
Version améliorée avec meilleure extraction pour hôtesses de l'air
"""
import argparse
import sys
import os
import logging
from typing import Dict, Any, List

# Fix pour l'encodage Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cv_processor.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Import des modules bilingues
from src.document_loader import CVDocumentLoader
from src.image_preprocessor import CVImagePreprocessor
from src.ocr_engine import MultilingualOCREngine
from src.text_processor import BilingualTextProcessor
from src.cv_parser import BilingualCVParser
from src.json_exporter import BilingualJSONExporter


def analyze_cv(cv_file_path: str, output_dir: str = './output', verbose: bool = True) -> Dict[str, Any]:
    """
    Analyse un CV (PDF/image) et extrait les données structurées en français et anglais
    """
    logger = logging.getLogger('analyze_cv')
    
    # Initialisation des composants bilingues
    loader = CVDocumentLoader()
    preprocessor = CVImagePreprocessor()
    ocr_engine = MultilingualOCREngine()
    text_processor = BilingualTextProcessor()
    cv_parser = BilingualCVParser()
    exporter = BilingualJSONExporter(output_dir)
    
    try:
        # 1. Chargement du document
        if verbose:
            print("Chargement du document...")
        logger.info(f"Chargement du document: {cv_file_path}")
        document = loader.load_document(cv_file_path)
        if not document:
            logger.error("Le document est vide ou n'a pas pu être chargé")
            raise RuntimeError("Le document est vide ou n'a pas pu être chargé.")
        
        if verbose:
            print(f"   OK {len(document)} page(s) chargee(s)")
        logger.info(f"Document chargé: {len(document)} page(s)")
        
        # 2. Prétraitement des images
        if verbose:
            print("Pretraitement des images...")
        logger.info("Prétraitement des images en cours...")
        processed_images: List = [preprocessor.preprocess_image(img) for img in document]
        if verbose:
            print(f"   OK {len(processed_images)} image(s) pretraitee(s)")
        logger.info(f"Images prétraitées: {len(processed_images)}")
        
        # 3. Extraction OCR avec détection de langue
        if verbose:
            print("Extraction OCR et detection de langue...")
        logger.info("Extraction OCR en cours...")
        ocr_data = ocr_engine.extract_text_with_language(processed_images[0])
        
        # Affichage des informations de langue détectée
        lang_info = ocr_data['language_info']
        if verbose:
            print(f"   Langue detectee: {lang_info['primary'].upper()}")
            print(f"   Score francais: {lang_info['french']:.1%}")
            print(f"   Score anglais: {lang_info['english']:.1%}")
            if 'total_blocks' in ocr_data:
                print(f"   Blocs de texte extraits: {ocr_data['total_blocks']}")
            if 'total_words' in ocr_data:
                print(f"   Mots totaux: {ocr_data['total_words']}")
        
        logger.info(f"OCR terminé - Langue: {lang_info['primary']}, Blocs: {ocr_data.get('total_blocks', 'N/A')}")
        
        # 4. Nettoyage et structuration du texte
        if verbose:
            print("Nettoyage et structuration du texte...")
        logger.info("Nettoyage et structuration du texte...")
        full_text = text_processor.clean_ocr_text(ocr_data['ocr_results'])
        structured_data = text_processor.extract_structured_sections(full_text)
        
        if verbose:
            sections_found = structured_data.get('sections', {})
            print(f"   OK {len(sections_found)} section(s) detectee(s): {', '.join(sections_found.keys())}")
        
        logger.info(f"Sections détectées: {list(structured_data.get('sections', {}).keys())}")
        
        # 5. Analyse sémantique bilingue
        if verbose:
            print("Analyse semantique des donnees...")
        logger.info("Analyse sémantique en cours...")
        cv_data = cv_parser.parse_bilingual_cv(structured_data)
        
        # Afficher un résumé rapide
        if verbose:
            print(f"   OK Nom: {cv_data.get('nom_complet', 'Non detecte')}")
            print(f"   OK Poste: {cv_data.get('intitule_poste', 'Non detecte')}")
            print(f"   OK Experiences: {len(cv_data.get('experiences', []))}")
            print(f"   OK Formations: {len(cv_data.get('formations', []))}")
            print(f"   OK Competences: {len(cv_data.get('competences', []))}")
            print(f"   OK Langues: {len(cv_data.get('langues', []))}")
        
        logger.info(f"Analyse terminée - Nom: {cv_data.get('nom_complet', 'N/A')}")
        
        # 6. Export des résultats
        if verbose:
            print("Export des donnees...")
        logger.info("Export des données en cours...")
        
        base_filename = os.path.splitext(os.path.basename(cv_file_path))[0]
        output_filename = f"{base_filename}_analyzed.json"
        
        output_file = exporter.export_cv_data(cv_data, output_filename)
        
        if verbose:
            print(f"OK Analyse terminee. Fichier exporte: {output_file}")
        
        logger.info(f"Export réussi: {output_file}")
        return cv_data
        
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse du CV {cv_file_path}: {str(e)}", exc_info=True)
        if verbose:
            print(f"ERREUR lors de l'analyse du CV: {str(e)}")
        raise RuntimeError(f"Erreur lors de l'analyse du CV: {str(e)}")


def analyze_multiple_cvs(cv_files: List[str], output_dir: str = './output') -> Dict[str, Dict[str, Any]]:
    """
    Analyse plusieurs CV en lot
    """
    logger = logging.getLogger('batch_analysis')
    results = {}
    total = len(cv_files)
    
    logger.info(f"Début de l'analyse en lot de {total} fichiers")
    
    for idx, cv_file in enumerate(cv_files, 1):
        try:
            print(f"\n{'='*60}")
            print(f"Fichier {idx}/{total}: {os.path.basename(cv_file)}")
            print(f"{'='*60}")
            
            logger.info(f"Traitement du fichier {idx}/{total}: {cv_file}")
            result = analyze_cv(cv_file, output_dir, verbose=True)
            results[cv_file] = {
                'status': 'success',
                'data': result
            }
            
        except Exception as e:
            logger.error(f"Erreur avec le fichier {cv_file}: {str(e)}", exc_info=True)
            print(f"ERREUR Erreur avec {cv_file}: {e}")
            results[cv_file] = {
                'status': 'error',
                'error': str(e)
            }
    
    logger.info(f"Analyse en lot terminée - Réussis: {sum(1 for r in results.values() if r.get('status') == 'success')}/{total}")
    return results


def display_detailed_summary(cv_data: Dict[str, Any]):
    """
    Affiche un résumé détaillé des données extraites
    """
    print("\n" + "="*70)
    print(" RÉSUMÉ DÉTAILLÉ DE L'ANALYSE".center(70))
    print("="*70)
    
    print(f"Nom complet      : {cv_data.get('nom_complet', 'Non détecté')}")
    print(f"Poste actuel     : {cv_data.get('intitule_poste', 'Non détecté')}")
    
    contact = cv_data.get('contact', {})
    print(f"Téléphone        : {contact.get('telephone', 'Non détecté')}")
    print(f"Email            : {contact.get('email', 'Non détecté')}")
    print(f"Adresse          : {contact.get('adresse', 'Non détecté')}")
    
    profil = cv_data.get('profil', '')
    if profil:
        print(f"\n PROFIL")
        print("-" * 70)
        profil_display = profil[:200] + "..." if len(profil) > 200 else profil
        print(profil_display)
    
    experiences = cv_data.get('experiences', [])
    print(f"\n EXPÉRIENCES PROFESSIONNELLES ({len(experiences)})")
    print("-" * 70)
    for idx, exp in enumerate(experiences, 1):
        print(f"\n{idx}. {exp.get('poste', 'Poste non spécifié')}")
        if exp.get('entreprise'):
            print(f"   Entreprise: {exp['entreprise']}")
        if exp.get('periode'):
            print(f"   Période: {exp['periode']}")
        if exp.get('details'):
            print(f"   Détails: {len(exp['details'])} tâche(s)")
    
    formations = cv_data.get('formations', [])
    print(f"\n FORMATIONS ({len(formations)})")
    print("-" * 70)
    for idx, form in enumerate(formations, 1):
        print(f"{idx}. {form.get('diplome', 'Diplôme non spécifié')}")
    
    competences = cv_data.get('competences', [])
    print(f"\n  COMPÉTENCES ({len(competences)})")
    print("-" * 70)
    if competences:
        for i in range(0, len(competences), 3):
            batch = competences[i:i+3]
            print("• " + " | ".join(batch))
    
    langues = cv_data.get('langues', [])
    print(f"\n LANGUES ({len(langues)})")
    print("-" * 70)
    for langue in langues:
        print(f"• {langue}")
    
    interets = cv_data.get('centres_interet', [])
    if interets:
        print(f"\n CENTRES D'INTÉRÊT ({len(interets)})")
        print("-" * 70)
        for interet in interets:
            print(f"• {interet}")
    
    metadata = cv_data.get('metadata', {})
    print(f"\n MÉTADONNÉES")
    print("-" * 70)
    print(f"Langue détectée  : {metadata.get('detected_language', 'Inconnue').upper()}")
    
    print("\n" + "="*70 + "\n")


def main():
    """
    Fonction principale avec interface en ligne de commande améliorée
    """
    logger = logging.getLogger('main')
    
    parser = argparse.ArgumentParser(
        description="Analyseur de CV bilingue (français/anglais) optimisé pour l'aviation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples d'utilisation:
  %(prog)s cv_hotesse.pdf                    # Analyse simple
  %(prog)s cv_hotesse.pdf -s                 # Avec résumé détaillé
  %(prog)s cv_hotesse.pdf -o ./exports       # Dossier de sortie personnalisé
  %(prog)s ./cvs -b                          # Analyse en lot d'un dossier
  %(prog)s cv.pdf -l                         # Afficher seulement la langue détectée
        """
    )
    
    parser.add_argument("input", nargs='?', default=None, 
                       help="Chemin du fichier CV (PDF, JPG, PNG) ou répertoire pour analyse en lot")
    parser.add_argument("--output-dir", "-o", default="./output", 
                       help="Répertoire de sortie pour les fichiers JSON (défaut: ./output)")
    parser.add_argument("--batch", "-b", action="store_true",
                       help="Traiter tous les CV d'un répertoire en lot")
    parser.add_argument("--summary", "-s", action="store_true",
                       help="Afficher un résumé détaillé après l'analyse")
    parser.add_argument("--language-info", "-l", action="store_true",
                       help="Afficher uniquement les informations de langue détectée")
    parser.add_argument("--quiet", "-q", action="store_true",
                       help="Mode silencieux (affichage minimal)")
    
    args = parser.parse_args()

    if args.input is None:
        parser.print_help()
        print("\nERREUR Erreur: aucun fichier ou répertoire fourni en entrée.")
        sys.exit(1)
    
    if not os.path.exists(args.input):
        print(f"ERREUR Erreur: le chemin '{args.input}' n'existe pas.")
        sys.exit(1)
    
    try:
        logger.info(f"Démarrage de l'analyse avec args: {args}")
        
        # Mode analyse de langue uniquement
        if args.language_info:
            print(" Analyse linguistique du document...\n")
            
            loader = CVDocumentLoader()
            preprocessor = CVImagePreprocessor()
            ocr_engine = MultilingualOCREngine()
            
            if os.path.isfile(args.input):
                document = loader.load_document(args.input)
                processed_images = [preprocessor.preprocess_image(img) for img in document]
                ocr_data = ocr_engine.extract_text_with_language(processed_images[0])
                lang_info = ocr_data['language_info']
                
                print(f" Fichier: {os.path.basename(args.input)}")
                print(f" Langue principale: {lang_info['primary'].upper()}")
                print(f"FR Score français: {lang_info['french']:.2%}")
                print(f"EN Score anglais: {lang_info['english']:.2%}")
                print(f" Blocs de texte: {ocr_data['total_blocks']}")
                print(f" Mots totaux: {ocr_data['total_words']}")
            else:
                print("ERREUR L'option --language-info nécessite un fichier, pas un répertoire.")
            return
        
        # Mode traitement par lot
        if args.batch and os.path.isdir(args.input):
            print(f" Analyse en lot du répertoire: {args.input}\n")
            
            supported_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif']
            cv_files = []
            
            for ext in supported_extensions:
                cv_files.extend([
                    os.path.join(args.input, f) for f in os.listdir(args.input) 
                    if f.lower().endswith(ext)
                ])
            
            if not cv_files:
                print("ERREUR Aucun fichier CV trouvé dans le répertoire.")
                return
            
            print(f"✓ {len(cv_files)} fichier(s) CV trouvé(s)")
            results = analyze_multiple_cvs(cv_files, args.output_dir)
            
            successful = sum(1 for r in results.values() if r.get('status') == 'success')
            failed = len(results) - successful
            
            print(f"\n{'='*60}")
            print(f" RÉSUMÉ DU TRAITEMENT PAR LOT".center(60))
            print(f"{'='*60}")
            print(f"OK Analyses réussies: {successful}/{len(cv_files)}")
            if failed > 0:
                print(f"ERREUR Analyses échouées: {failed}/{len(cv_files)}")
            print(f" Fichiers exportés dans: {args.output_dir}")
            
        # Mode fichier unique
        elif os.path.isfile(args.input):
            verbose = not args.quiet
            structured_data = analyze_cv(args.input, args.output_dir, verbose=verbose)
            
            if args.summary:
                display_detailed_summary(structured_data)
            elif not args.quiet:
                print(f"\n{'='*60}")
                print("OK ANALYSE TERMINÉE")
                print(f"{'='*60}")
                print(f" Nom: {structured_data.get('nom_complet', 'N/A')}")
                print(f" Poste: {structured_data.get('intitule_poste', 'N/A')}")
                print(f" Email: {structured_data.get('contact', {}).get('email', 'N/A')}")
                print(f" Téléphone: {structured_data.get('contact', {}).get('telephone', 'N/A')}")
                print(f" Expériences: {len(structured_data.get('experiences', []))}")
                print(f" Formations: {len(structured_data.get('formations', []))}")
                print(f"  Compétences: {len(structured_data.get('competences', []))}")
                print(f" Langues: {len(structured_data.get('langues', []))}")
                metadata = structured_data.get('metadata', {})
                print(f" Langue: {metadata.get('detected_language', 'N/A').upper()}")
                print(f"{'='*60}")
        
        else:
            print(f"ERREUR Erreur: '{args.input}' n'est ni un fichier ni un répertoire valide.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\nATTENTION  Analyse interrompue par l'utilisateur.")
        logger.info("Analyse interrompue par l'utilisateur")
        sys.exit(130)
    except Exception as e:
        error_msg = f"Erreur fatale: {e}"
        print(f"\nERREUR {error_msg}")
        logger.error(error_msg, exc_info=True)
        if not args.quiet:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()