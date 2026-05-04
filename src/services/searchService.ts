/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Fuse from 'fuse.js';
import { IndexedDocument } from '../types';

export function searchDocuments(query: string, documents: IndexedDocument[]) {
  if (!query) return documents.map(doc => ({ item: doc, score: 0 }));

  const options = {
    keys: ['recognizedText'],
    includeScore: true,
    threshold: 0.4, // Balanced threshold for handwriting variations
    ignoreLocation: true,
    minMatchCharLength: 2,
  };

  const fuse = new Fuse(documents, options);
  return fuse.search(query);
}
