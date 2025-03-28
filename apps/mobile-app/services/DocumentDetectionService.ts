import * as tf from '@tensorflow/tfjs';
import * as tfjsReactNative from '@tensorflow/tfjs-react-native';
import { bundleResourceIO, fetch } from '@tensorflow/tfjs-react-native';
import { Platform } from 'react-native';

// Model configuration
const MODEL_CONFIG = {
  inputSize: [224, 224] as [number, number],
  confidenceThreshold: 0.7,
  iouThreshold: 0.5,
};

export class DocumentDetectionService {
  private static instance: DocumentDetectionService;
  private model: tf.LayersModel | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DocumentDetectionService {
    if (!DocumentDetectionService.instance) {
      DocumentDetectionService.instance = new DocumentDetectionService();
    }
    return DocumentDetectionService.instance;
  }

  /**
   * Initialize TensorFlow.js and load the model
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize TensorFlow.js
      await tf.ready();
      await tf.setBackend('rn-webgl');

      // Load the model
      const modelJson = require('../assets/models/document_detector/model.json');
      const modelWeights = require('../assets/models/document_detector/weights.bin');

      this.model = await tf.loadLayersModel(
        bundleResourceIO(modelJson, modelWeights)
      );

      this.isInitialized = true;
      console.log('Document detection model loaded successfully');
    } catch (error) {
      console.error('Failed to initialize document detection:', error);
      throw error;
    }
  }

  /**
   * Detect document edges in a camera frame
   * @param cameraImage Camera picture data
   * @returns Detection result with confidence and corners
   */
  public async detectDocument(cameraImage: { uri: string; base64?: string }): Promise<{
    isDetected: boolean;
    confidence: number;
    corners?: [[number, number], [number, number], [number, number], [number, number]];
  }> {
    if (!this.model || !this.isInitialized) {
      throw new Error('Document detection service not initialized');
    }

    try {
      // Convert image data to tensor using React Native method
      const response = await fetch(cameraImage.uri);
      const imageBuffer = await response.arrayBuffer();
      const tensor = await tfjsReactNative.decodeJpeg(new Uint8Array(imageBuffer));
      
      // Resize to model input size
      const resized = tf.image.resizeBilinear(tensor, MODEL_CONFIG.inputSize);
      
      // Normalize to [0, 1]
      const normalized = resized.div(255.0);
      
      // Add batch dimension
      const batched = normalized.expandDims(0);
      
      // Run inference
      const prediction = this.model.predict(batched) as tf.Tensor;
      
      // Get confidence and corners
      const [confidence, corners] = await Promise.all([
        prediction.data() as Promise<Float32Array>,
        prediction.array() as Promise<[[number, number], [number, number], [number, number], [number, number]][]>
      ]);

      // Clean up tensors
      tf.dispose([tensor, resized, normalized, batched, prediction]);

      // Check if detection meets confidence threshold
      const isDetected = confidence[0] > MODEL_CONFIG.confidenceThreshold;

      return {
        isDetected,
        confidence: confidence[0],
        corners: isDetected ? corners[0] : undefined
      };
    } catch (error) {
      console.error('Document detection failed:', error);
      return {
        isDetected: false,
        confidence: 0
      };
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
} 