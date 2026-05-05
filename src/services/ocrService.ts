/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { createWorker } from 'tesseract.js';

const getApiKey = () => {
  try {
    // @ts-ignore
    return process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";
  } catch {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY || "";
  }
};

let ai: GoogleGenAI | null = null;
const getAI = () => {
  if (!ai) {
    const key = getApiKey();
    if (!key) {
      console.warn("GEMINI_API_KEY is missing. Online OCR will fail.");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
};

/**
 * High-accuracy OCR using Gemini (Requires Internet)
 */
export async function recognizeHandwrittenArabic(base64Image: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  const genAI = getAI();
  
  // Clean base64 string to get only the data part
  const data = base64Image.split(',')[1] || base64Image;

  const prompt = `
    Analyze this handwritten Arabic document. 
    Perform extremely high-accuracy Optical Character Recognition (OCR) for handwritten Arabic legal scripts.
    
    CONTEXT: These are formal legal documents from a family or court archive (محاضر, عقود, اتفاقيات). 
    They are often written in old style handwriting with specific legal terminology.
    
    TARGET ENTITIES:
    - Names: (e.g. احمد, محمد, فوزي, عزي, عبيد, صالح)
    - Locations: (e.g. قرية, عزلة, مديرية, محافظة)
    - Numbers: (e.g. 1345 هـ, 2024 م, مبالغ مالية)
    - Relationships: (المقر, المذكور, الشهود)
    
    INSTRUCTIONS:
    1. Extract ALL text exactly as written.
    2. Maintain spatial layout and reading order (Right-to-Left).
    3. Do NOT skip any words, even if they are faint.
    4. Pay special attention to the difference between letters like (ف and ق) or (ن and ي).
    5. Output ONLY the extracted Arabic text verbatim.
  `;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: data,
            },
          },
          { text: prompt },
        ],
      },
    });

    const result = await response.response;
    return result.text() || "";
  } catch (error) {
    console.error("OCR Recognition Error:", error);
    throw new Error("Failed to recognize text in image.");
  }
}

/**
 * Wrapper for Drive integration to handle Blobs directly
 */
export async function performOCR(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const text = await recognizeHandwrittenArabic(base64);
        resolve(text);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Local OCR using Tesseract.js (Fully Offline after initial load)
 * Note: Lower accuracy for complex handwriting compared to Gemini.
 */
export async function recognizeArabicLocally(base64Image: string, onProgress?: (progress: number) => void): Promise<string> {
  const worker = await createWorker('ara', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress?.(m.progress);
      }
    }
  });

  try {
    const { data: { text } } = await worker.recognize(base64Image);
    await worker.terminate();
    return text;
  } catch (error) {
    console.error("Local OCR Error:", error);
    await worker.terminate();
    throw new Error("Local OCR failed.");
  }
}
