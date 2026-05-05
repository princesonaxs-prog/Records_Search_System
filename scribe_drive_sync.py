
# =================================================================
# Arabic Scribe: Drive Automator (v3.0)
# Purpose: Deep OCR for Handwritten Arabic - Syncs Drive Images to TXT
# Instructions:
# 1. Open this in Google Colab.
# 2. Add your GEMINI_API_KEY.
# 3. Paste the Folder ID from your Google Drive link.
# =================================================================

import os
import time
import base64
from tqdm import tqdm
try:
    from google.colab import drive, auth
    import google.auth
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
    HAS_COLAB = True
except ImportError:
    HAS_COLAB = False

import google.generativeai as genai
from PIL import Image
import io

# --- CONFIGURATION ---
# Replace with your actual Gemini API Key
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
# The ID is the last part of your Drive URL: 115Lneu3eNx1m8pxQO4X5aKPVl1tZe807
TARGET_FOLDER_ID = "115Lneu3eNx1m8pxQO4X5aKPVl1tZe807"

def setup_scribe():
    if HAS_COLAB:
        print("[*] Setting up Colab environment...")
        auth.authenticate_user()
        drive.mount('/content/drive')
    
    genai.configure(api_key=GEMINI_API_KEY)
    creds, _ = google.auth.default()
    return build('drive', 'v3', credentials=creds)

def scribe_ocr(image_bytes):
    """Deep Gemini OCR for handwritten Arabic."""
    model = genai.GenerativeModel('gemini-3-flash-preview')
    
    prompt = """
    Analyze this handwritten Arabic document with extreme precision.
    Perform OCR for handwritten Arabic legal/historical scripts.
    
    CONTEXT: Formal archival documents (محاضر, عقود, اتفاقيات). 
    
    INSTRUCTIONS:
    1. Extract ALL text exactly as written verbatim.
    2. Maintain spatial layout and Right-to-Left order.
    3. Do NOT skip faint or overlapping words.
    4. Output ONLY the extracted Arabic text. No commentary.
    """
    
    img = Image.open(io.BytesIO(image_bytes))
    response = model.generate_content([prompt, img])
    return response.text

def process_folder(service, folder_id):
    print(f"[*] Scanning folder: {folder_id}")
    
    # 1. List all files in folder
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed = false",
        fields="files(id, name, mimeType)"
    ).execute()
    files = results.get('files', [])
    
    # 2. Identify images and existing txt files
    images = []
    existing_txts = set()
    
    for f in files:
        name = f['name']
        if f['mimeType'].startswith('image/'):
            images.append(f)
        elif name.lower().endswith('.txt'):
            # Store base name without extension
            existing_txts.add(os.path.splitext(name.lower())[0])
            
    print(f"[+] Found {len(images)} images. (Already processed: {len(existing_txts)})")
    
    # 3. Process new images
    for img_file in tqdm(images, desc="Scribe Progress"):
        base_name = os.path.splitext(img_file['name'])[0]
        
        if base_name.lower() in existing_txts:
            continue
            
        try:
            print(f"\n[*] Processing: {img_file['name']}")
            
            # Download image
            request = service.files().get_media(fileId=img_file['id'])
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            
            # OCR
            extracted_text = scribe_ocr(fh.getvalue())
            
            # Create TXT file
            txt_name = f"{base_name}.txt"
            file_metadata = {
                'name': txt_name,
                'parents': [folder_id]
            }
            
            media = MediaFileUpload(
                io.BytesIO(extracted_text.encode('utf-8')),
                mimetype='text/plain'
            )
            
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            print(f"[SUCCESS] Saved {txt_name}")
            
            # Respect rate limits
            time.sleep(1)
            
        except Exception as e:
            print(f"[!] Error processing {img_file['name']}: {e}")

if __name__ == "__main__":
    if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
        print("[!] ERROR: Please set your GEMINI_API_KEY inside the script first.")
    else:
        drive_service = setup_scribe()
        process_folder(drive_service, TARGET_FOLDER_ID)
        print("\n[FINISH] All images synchronized. Check your Google Drive.")
