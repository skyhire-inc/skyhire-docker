"""
Module de chargement des documents CV standard
"""
import os
import fitz  # PyMuPDF
from PIL import Image
import io

class CVDocumentLoader:
    def __init__(self):
        self.supported_formats = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp']
    
    def load_document(self, file_path):
        """
        Charge un document CV et le convertit en images
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Fichier introuvable: {file_path}")
            
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.pdf':
            return self._pdf_to_images(file_path)
        elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']:
            return self._load_image(file_path)
        else:
            raise ValueError(f"Format non supporté: {file_ext}. Formats supportés: {self.supported_formats}")
    
    def _pdf_to_images(self, pdf_path):
        """
        Convertit un PDF en liste d'images en utilisant PyMuPDF (fitz)
        """
        try:
            # Ouvrir le document PDF
            pdf_document = fitz.open(pdf_path)
            images = []
            
            # Convertir chaque page en image
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                # Rendre la page en image avec un zoom de 300 DPI (300/72 = 4.17)
                mat = fitz.Matrix(300/72, 300/72)  # 300 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # Convertir en PIL Image
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))
                images.append(image)
            
            pdf_document.close()
            return images
        except Exception as e:
            raise Exception(f"Erreur conversion PDF: {str(e)}")
    
    def _load_image(self, image_path):
        """
        Charge une image unique avec gestion des formats différents
        """
        try:
            image = Image.open(image_path)
            
            # Conversion en RGB si nécessaire (pour PNG avec alpha)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Créer un fond blanc pour les images avec transparence
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
                
            return [image]
        except Exception as e:
            raise Exception(f"Erreur chargement image {image_path}: {str(e)}")