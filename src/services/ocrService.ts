/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { createWorker } from 'tesseract.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * High-accuracy OCR using Gemini (Requires Internet)
 */
export async function recognizeHandwrittenArabic(base64Image: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  // Clean base64 string to get only the data part
  const data = base64Image.split(',')[1] || base64Image;

  const prompt = `
    Analyze this handwritten Arabic document. 
    Perform extremely high-accuracy Optical Character Recognition (OCR) for handwritten Arabic legal scripts.
    
    CONTEXT: These are formal legal contracts, land sale agreements, or settlement documents (محضر اتفاق, عقد بيع, تنازل). 
    They often include:
    - Parties: (المقابل, المؤجر, المستأجر, البائع, المشتري)
    - Names: Pay extreme attention to dots and tooth counting in names (e.g., عزي vs فوزي, عبيد vs عبد).
    - Witness section: (الشهود, الشاهد, يوقع أدناه).
    - Numbers: Often dates or land areas.
    
    CRITICAL INSTRUCTIONS:
    1. Extract ALL text verbatim.
    2. Pay extremely close attention to legal roles (e.g., المؤجر vs المذكور). Do NOT confuse them.
    3. Maintain Right-to-Left reading order strictly.
    4. Do not interpret or summarize, just provide the exact characters recognized.
    5. Output ONLY the recognized Arabic text.
  `;

  try {
    const response = await ai.models.generateContent({
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

    return response.text || "";
  } catch (error) {
    console.error("OCR Recognition Error:", error);
    throw new Error("Failed to recognize text in image.");
  }
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
