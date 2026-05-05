
import { IndexedDocument } from '../types';

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '115Lneu3eNx1m8pxQO4X5aKPVl1tZe807';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

/**
 * Service to interact with Google Drive API from the client side.
 * Requires user authentication/access token.
 */
export const driveService = {
  /**
   * Fetches all original images and their corresponding .txt transcription files from the specific folder.
   */
  async listFiles(accessToken: string): Promise<{ images: DriveFile[], texts: Map<string, string> }> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&pageSize=1000`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch files from Drive');
    
    const data = await response.json();
    const files: DriveFile[] = data.files || [];
    
    const images = files.filter(f => f.mimeType.startsWith('image/'));
    const textFiles = files.filter(f => f.name.endsWith('.txt'));
    
    // Create a map of baseName -> fileId for text files
    const texts = new Map<string, string>();
    textFiles.forEach(f => {
      const baseName = f.name.replace('.txt', '').toLowerCase();
      texts.set(baseName, f.id);
    });

    return { images, texts };
  },

  /**
   * Downloads the content of a specific file (used for loading existing transcriptions).
   */
  async getFileContent(accessToken: string, fileId: string): Promise<string> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) return '';
    return await response.text();
  },

  /**
   * Uploads or updates a .txt file in the Google Drive folder.
   */
  async saveTranscription(accessToken: string, fileName: string, content: string): Promise<void> {
    // 1. Check if file already exists
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+name='${fileName}'+and+trashed=false`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const searchData = await searchResponse.json();
    const existingFile = searchData.files?.[0];

    const metadata = {
      name: fileName,
      mimeType: 'text/plain',
      parents: existingFile ? undefined : [FOLDER_ID],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'text/plain' }));

    const url = existingFile 
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    
    const method = existingFile ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!response.ok) throw new Error('Failed to save to Drive');
  }
};
