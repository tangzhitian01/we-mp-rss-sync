import { Notice } from 'obsidian';

export interface DBGPTConfig {
  enabled: boolean;
  apiUrl: string;
  spaceName: string;
  apiKey: string;
}

export interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class DBGPTClient {
  private config: DBGPTConfig;

  constructor(config: DBGPTConfig) {
    this.config = config;
  }

  updateConfig(config: DBGPTConfig): void {
    this.config = config;
  }

  /**
   * Test connection to DB-GPT server
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/space/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error('[We-MP-RSS Sync] DB-GPT connection test failed:', error);
      return false;
    }
  }

  /**
   * Ensure the knowledge space exists, create if not
   */
  async ensureSpace(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Check if space exists
      const response = await fetch(
        `${this.config.apiUrl}/api/space/${this.config.spaceName}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (response.status === 404) {
        // Create space
        const createResponse = await fetch(
          `${this.config.apiUrl}/api/space/create`,
          {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              name: this.config.spaceName,
              type: 'knowledge'
            })
          }
        );
        return createResponse.ok;
      }

      return response.ok;
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to ensure DB-GPT space:', error);
      return false;
    }
  }

  /**
   * Upload a document to DB-GPT knowledge space
   */
  async uploadDocument(content: string, filename: string, metadata?: Record<string, string>): Promise<UploadResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'DB-GPT is not enabled' };
    }

    try {
      // Create form data with the document
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/markdown' });
      formData.append('file', blob, filename);
      formData.append('space_name', this.config.spaceName);

      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      const response = await fetch(`${this.config.apiUrl}/api/knowledge/document/upload`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }

      const result = await response.json();
      return { success: true, message: result.message || 'Document uploaded successfully' };
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to upload document to DB-GPT:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Upload multiple documents in batch
   */
  async uploadDocuments(documents: Array<{ content: string; filename: string; metadata?: Record<string, string> }>): Promise<{ success: number; failed: number; results: UploadResult[] }> {
    let success = 0;
    let failed = 0;
    const results: UploadResult[] = [];

    for (const doc of documents) {
      const result = await this.uploadDocument(doc.content, doc.filename, doc.metadata);
      results.push(result);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed, results };
  }

  /**
   * Search knowledge base
   */
  async search(query: string, topK: number = 5): Promise<any> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/knowledge/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query,
          space_name: this.config.spaceName,
          top_k: topK
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[We-MP-RSS Sync] DB-GPT search failed:', error);
      return null;
    }
  }

  /**
   * Delete a document from knowledge space
   */
  async deleteDocument(docId: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/knowledge/document/${docId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to delete document:', error);
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }
}
