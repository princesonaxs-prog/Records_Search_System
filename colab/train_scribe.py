
# =================================================================
# Arabic Scribe: Google Colab Training Script (V2.0 - Robust Version)
# Purpose: Fine-tune EasyOCR Recognizer for Arabic Handwriting
# Hardware: Optimized for T4 GPU
# =================================================================

import os
from google.colab import drive

# 1. Mount Google Drive
print("[*] Connecting to Google Drive...")
drive.mount('/content/drive', force_remount=True)

# 2. Setup Paths
DATA_PATH = "/content/drive/MyDrive/OCR_Training_Data"
SAVE_PATH = "/content/drive/MyDrive/OCR_Scribe_Checkpoints"
if not os.path.exists(SAVE_PATH):
    os.makedirs(SAVE_PATH)

# 3. Install Dependencies
print("[*] Installing Training Dependencies...")
!pip install -q git+https://github.com/JaidedAI/EasyOCR.git
!pip install -q lmdb nltk natsort fire

# 4. Clone Training Benchmark
%cd /content
if not os.path.exists('/content/deep-text-recognition-benchmark'):
    !git clone https://github.com/ku-nlp/deep-text-recognition-benchmark.git
else:
    print("[!] Benchmark already exists.")

%cd /content/deep-text-recognition-benchmark

# 5. Data Conversion Script
def prepare_data():
    print("[*] Preparing Labels and Images...")
    if not os.path.exists(DATA_PATH):
        print(f"[!] Error: {DATA_PATH} doesn't exist.")
        return False
        
    img_list = [f for f in os.listdir(DATA_PATH) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    with open('/content/gt.txt', 'w', encoding='utf-8') as f:
        for img in img_list:
            txt_file = os.path.splitext(img)[0] + ".txt"
            txt_path = os.path.join(DATA_PATH, txt_file)
            if os.path.exists(txt_path):
                with open(txt_path, 'r', encoding='utf-8') as t:
                    label = t.read().strip()
                    f.write(f"{img}\t{label}\n")
    
    print("[+] gt.txt generated. Creating LMDB dataset...")
    !python3 /content/deep-text-recognition-benchmark/create_lmdb_dataset.py \
        --inputPath {DATA_PATH} \
        --gtFile /content/gt.txt \
        --outputPath /content/train_data
    return True

if prepare_data():
    # 6. Launch Training
    print("[*] Starting Training Process...")
    !python3 /content/deep-text-recognition-benchmark/train.py \
        --train_data /content/train_data \
        --valid_data /content/train_data \
        --select_data / \
        --batch_ratio 1 \
        --Transformation TPS --FeatureExtraction ResNet --SequenceModeling BiLSTM --Prediction CTC \
        --batch_size 8 \
        --num_iter 1200 \
        --valInterval 100 \
        --save_interval 200 \
        --saved_model "" \
        --FT \
        --lan_list ar \
        --exp_name Scribe_Arabic_Model \
        --output_dir {SAVE_PATH}

    print(f"\n[SUCCESS] Training finished. Checkpoints saved to: {SAVE_PATH}")
    print("[!] Download 'best_accuracy.pth' to use in your local Lenovo P53 script.")
else:
    print("[!] Training aborted.")
