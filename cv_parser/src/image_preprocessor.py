"""
Module de prétraitement d'images pour CV standard
Compatible JPG et PNG (canal alpha géré)
Amélioration OCR : contraste, débruitage, binarisation adaptative
"""

import cv2
import numpy as np
from PIL import Image

class CVImagePreprocessor:
    def __init__(self):
        self.preprocessing_steps = []

    def preprocess_image(self, image):
        """
        Prétraitement amélioré pour OCR, compatible JPG et PNG
        """
        try:
            # Conversion PIL → OpenCV
            if isinstance(image, Image.Image):
                image = np.array(image)
                # Gestion canal alpha (PNG)
                if len(image.shape) == 3 and image.shape[2] == 4:
                    # Image avec transparence (PNG)
                    alpha = image[:, :, 3] / 255.0
                    rgb = image[:, :, :3].astype(float)
                    # Fond blanc pour la transparence
                    image = rgb * alpha[:, :, None] + 255 * (1 - alpha[:, :, None])
                    image = image.astype(np.uint8)
                    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                elif len(image.shape) == 3 and image.shape[2] == 3:
                    # Image RGB standard (JPG)
                    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                else:
                    # Image niveau de gris
                    image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            else:
                image = image.copy()
                # Vérifier si 4 canaux (alpha)
                if len(image.shape) == 3 and image.shape[2] == 4:
                    alpha = image[:, :, 3] / 255.0
                    rgb = image[:, :, :3].astype(float)
                    image = rgb * alpha[:, :, None] + 255 * (1 - alpha[:, :, None])
                    image = image.astype(np.uint8)
                    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            # Conversion en niveaux de gris
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image

            # Amélioration contraste CLAHE
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)

            # Réduction du bruit
            gray = cv2.medianBlur(gray, 3)

            # Optionnel : légère dilatation pour renforcer texte fin
            kernel = np.ones((1, 1), np.uint8)
            gray = cv2.dilate(gray, kernel, iterations=1)

            # Binarisation adaptative pour fond inégal
            processed = cv2.adaptiveThreshold(
                gray, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                15, 10
            )

            return processed

        except Exception as e:
            print(f"Erreur prétraitement image: {str(e)}")
            # Fallback: retourner l'image originale en niveaux de gris
            if isinstance(image, np.ndarray):
                if len(image.shape) == 3:
                    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                else:
                    return image
            else:
                return np.array(image.convert('L'))