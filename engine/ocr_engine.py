import easyocr
import torch
import cv2
import os
import base64
from tqdm import tqdm

class ArabicOCREngine:
    def __init__(self, use_gpu=True):
        # Quadro P1000 has 4GB VRAM. We must be careful.
        self.device = 'cuda' if use_gpu and torch.cuda.is_available() else 'cpu'
        print(f"[*] Initializing OCR Engine on: {self.device.upper()}")
        
        # Initialize EasyOCR Reader for Arabic and English (for numbers/mixed records)
        self.reader = easyocr.Reader(['ar', 'en'], gpu=use_gpu)

    def process_image(self, image_path):
        """Extracts text from a single image."""
        if not os.path.exists(image_path):
            return None
        
        try:
            # Read text with detail=0 for raw string output
            results = self.reader.readtext(image_path, detail=0, paragraph=True)
            return " ".join(results)
        except Exception as e:
            print(f"[!] Error processing {image_path}: {e}")
            return ""

    def batch_process(self, folder_path, callback=None):
        """Processes an entire folder of images."""
        supported_exts = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff')
        files = [f for f in os.listdir(folder_path) if f.lower().endswith(supported_exts)]
        
        indexed_data = []
        for filename in tqdm(files, desc="Digitizing Archive"):
            path = os.path.join(folder_path, filename)
            text = self.process_image(path)
            
            # Create a base64 preview for the index if needed
            # For 25GB, we store paths instead of full base64 to save index size
            indexed_data.append({
                "filename": filename,
                "path": os.path.abspath(path),
                "text": text,
                "timestamp": os.path.getctime(path)
            })
            
            if callback:
                callback(indexed_data[-1])
                
        return indexed_data

    def fine_tune_placeholder(self, data_dir):
        """
        Instructions for local fine-tuning on Lenovo P53.
        Fine-tuning requires a dataset of (image, label.txt).
        """
        print("[!] Local Training Mode Initialized.")
        print("[*] Optimization: Using Mixed Precision (FP16) for Quadro P1000.")
        # Setup for torch.cuda.amp (Automatic Mixed Precision)
        scaler = torch.cuda.amp.GradScaler()
        
        # This is a complex process involving EasyOCR's trainer.
        # I recommend using 'Deep-Text-Recognition-Benchmark' as the core trainer.
        pass
