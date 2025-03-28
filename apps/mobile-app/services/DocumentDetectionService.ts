import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';

export class DocumentDetectionService {
  private static instance: DocumentDetectionService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DocumentDetectionService {
    if (!DocumentDetectionService.instance) {
      DocumentDetectionService.instance = new DocumentDetectionService();
    }
    return DocumentDetectionService.instance;
  }

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public async detectDocument(cameraImage: { uri: string; base64?: string }): Promise<{
    isDetected: boolean;
    confidence: number;
    corners?: [[number, number], [number, number], [number, number], [number, number]];
    scannedImage?: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Document detection service not initialized');
    }

    try {
      const scanResult = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        responseType: ResponseType.Base64,
        maxNumDocuments: 1,
      });

      if (scanResult.scannedImages?.[0]) {
        return {
          isDetected: true,
          confidence: 1.0,
          corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
          scannedImage: scanResult.scannedImages[0]
        };
      }

      return {
        isDetected: false,
        confidence: 0
      };

    } catch (error) {
      console.error('Document detection failed:', error);
      return {
        isDetected: false,
        confidence: 0
      };
    }
  }

  public async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
} 