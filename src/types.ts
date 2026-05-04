/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IndexedDocument {
  id: string;
  originalUrl: string;
  base64: string;
  recognizedText: string;
  confidence: number;
  metadata: {
    createdAt: number;
    fileName: string;
  };
}

export interface SearchResult {
  item: IndexedDocument;
  score: number; // For fuzzy matching
}

export enum OCRStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
}
