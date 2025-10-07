import * as Minio from 'minio';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  forcePathStyle: boolean;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  originalUrl: string;
  size?: number;
  contentType?: string;
}

export class StorageService {
  private minioClient: Minio.Client;
  private config: StorageConfig;
  private bucketName: string;

  constructor() {
    this.config = {
      endpoint: process.env.STORAGE_ENDPOINT || 'https://minio-storage.automscc.com',
      region: process.env.STORAGE_REGION || 'us-east-1',
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || 'admin',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || 'password',
      bucketName: process.env.STORAGE_BUCKET_NAME || 'adfinderpro',
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true'
    };

    this.bucketName = this.config.bucketName;

    this.minioClient = new Minio.Client({
      endPoint: this.config.endpoint.replace(/^https?:\/\//, ''),
      port: this.config.endpoint.includes('https') ? 443 : 80,
      useSSL: this.config.endpoint.includes('https'),
      accessKey: this.config.accessKeyId,
      secretKey: this.config.secretAccessKey,
      region: this.config.region
    });

    this.initializeBucket();
  }

  private async initializeBucket(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, this.config.region);
        console.log(`✅ Created bucket: ${this.bucketName}`);
      } else {
        console.log(`✅ Bucket exists: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('❌ Error initializing bucket:', error);
    }
  }

  /**
   * Upload a media file from URL to MinIO
   */
  async uploadMediaFromUrl(originalUrl: string, folder: string = 'media'): Promise<UploadResult> {
    try {
      console.log(`📤 Uploading media from URL: ${originalUrl}`);

      // Download the file
      const response = await fetch(originalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.buffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = buffer.length;

      // Generate unique filename
      const fileExtension = this.getFileExtension(originalUrl, contentType);
      const fileName = `${uuidv4()}${fileExtension}`;
      const objectKey = `${folder}/${fileName}`;

      // Upload to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        objectKey,
        buffer,
        contentLength,
        {
          'Content-Type': contentType,
          'Original-URL': originalUrl,
          'Upload-Date': new Date().toISOString()
        }
      );

      const publicUrl = this.getPublicUrl(objectKey);
      
      console.log(`✅ Media uploaded successfully: ${publicUrl}`);
      
      return {
        success: true,
        url: publicUrl,
        key: objectKey
      };

    } catch (error) {
      console.error('❌ Error uploading media:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload multiple media files
   */
  async uploadMultipleMedia(mediaItems: MediaItem[], folder: string = 'media'): Promise<{
    successful: UploadResult[];
    failed: UploadResult[];
  }> {
    const successful: UploadResult[] = [];
    const failed: UploadResult[] = [];

    for (const item of mediaItems) {
      const result = await this.uploadMediaFromUrl(item.originalUrl, folder);
      
      if (result.success) {
        successful.push(result);
      } else {
        failed.push({
          success: false,
          error: result.error || 'Upload failed',
          key: item.originalUrl
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Get public URL for an object
   */
  getPublicUrl(objectKey: string): string {
    if (this.config.forcePathStyle) {
      return `${this.config.endpoint}/${this.bucketName}/${objectKey}`;
    } else {
      return `${this.config.endpoint}/${objectKey}`;
    }
  }

  /**
   * Delete an object from storage
   */
  async deleteObject(objectKey: string): Promise<boolean> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectKey);
      console.log(`✅ Object deleted: ${objectKey}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting object:', error);
      return false;
    }
  }

  /**
   * Check if an object exists
   */
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, objectKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(objectKey: string): Promise<any> {
    try {
      const stat = await this.minioClient.statObject(this.bucketName, objectKey);
      return stat;
    } catch (error) {
      console.error('❌ Error getting object metadata:', error);
      return null;
    }
  }

  /**
   * Extract file extension from URL or content type
   */
  private getFileExtension(url: string, contentType: string): string {
    // Try to get extension from URL
    const urlExtension = url.split('.').pop()?.split('?')[0];
    if (urlExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'].includes(urlExtension.toLowerCase())) {
      return `.${urlExtension}`;
    }

    // Fallback to content type
    const typeMap: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi'
    };

    return typeMap[contentType] || '.bin';
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    bucketName: string;
    totalObjects: number;
    totalSize: number;
  }> {
    try {
      let totalObjects = 0;
      let totalSize = 0;

      const objectsList = this.minioClient.listObjects(this.bucketName, '', true);
      
      for await (const obj of objectsList) {
        totalObjects++;
        totalSize += obj.size || 0;
      }

      return {
        bucketName: this.bucketName,
        totalObjects,
        totalSize
      };
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      return {
        bucketName: this.bucketName,
        totalObjects: 0,
        totalSize: 0
      };
    }
  }
}

// Global instance
export const storageService = new StorageService();
