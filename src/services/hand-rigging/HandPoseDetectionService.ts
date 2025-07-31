/**
 * Hand Pose Detection Service
 * Uses TensorFlow.js and MediaPipe Hands to detect hand landmarks in 2D/3D
 */

import * as tf from '@tensorflow/tfjs'
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection'
import '@tensorflow/tfjs-backend-webgl'
import '@mediapipe/hands'
import * as THREE from 'three'
import { TensorFlowHand, TensorFlowKeypoint } from '../../types/service-types'
import { HAND_LANDMARKS, FINGER_JOINTS } from '../../constants'

export interface Point2D {
  x: number
  y: number
}

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface HandLandmarks {
  landmarks: Point3D[]
  handedness: 'Left' | 'Right'
  confidence: number
  worldLandmarks?: Point3D[]
}

export interface HandDetectionResult {
  hands: HandLandmarks[]
  imageWidth: number
  imageHeight: number
}

export interface FingerJoints {
  thumb: number[]
  index: number[]
  middle: number[]
  ring: number[]
  pinky: number[]
}

export class HandPoseDetectionService {
  private detector: handPoseDetection.HandDetector | null = null
  private isInitialized = false
  

  
  /**
   * Initialize the hand pose detection model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    console.log('🤖 Initializing hand pose detection...')
    
    try {
      // Wait for TensorFlow.js to be ready
      await tf.ready()
      console.log('✅ TensorFlow.js ready, backend:', tf.getBackend())
      
      // Create the detector with MediaPipe Hands
      const model = handPoseDetection.SupportedModels.MediaPipeHands
      const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeModelConfig = {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
        modelType: 'full',
        maxHands: 2
      }
      
      this.detector = await handPoseDetection.createDetector(model, detectorConfig)
      this.isInitialized = true
      
      console.log('✅ Hand pose detector initialized')
    } catch (error) {
      console.error('❌ Failed to initialize hand pose detection:', error)
      throw error
    }
  }
  
  /**
   * Detect hands in an image
   */
  async detectHands(imageData: ImageData | HTMLCanvasElement): Promise<HandDetectionResult> {
    if (!this.isInitialized || !this.detector) {
      await this.initialize()
    }
    
    if (!this.detector) {
      throw new Error('Hand detector not initialized')
    }
    
    try {
      // Convert ImageData to canvas if needed
      let input: HTMLCanvasElement
      if (imageData instanceof ImageData) {
        const canvas = document.createElement('canvas')
        canvas.width = imageData.width
        canvas.height = imageData.height
        const ctx = canvas.getContext('2d')!
        ctx.putImageData(imageData, 0, 0)
        input = canvas
      } else {
        input = imageData
      }
      
      // Detect hands
      const hands = await this.detector.estimateHands(input)
      
      // Convert to our format
      const result: HandDetectionResult = {
        hands: hands.map((hand) => {
          const tfHand = hand as TensorFlowHand
          const keypoints = tfHand.keypoints
          const keypoints3D = tfHand.keypoints3D
          
          return {
            landmarks: keypoints.map((kp: TensorFlowKeypoint, i: number) => ({
              x: kp.x,
              y: kp.y,
              z: keypoints3D ? keypoints3D[i].z || 0 : 0
            })),
            worldLandmarks: keypoints3D ? keypoints3D.map((kp: TensorFlowKeypoint) => ({
              x: kp.x,
              y: kp.y,
              z: kp.z || 0
            })) : undefined,
            handedness: tfHand.handedness,
            confidence: hand.score || 0
          }
        }),
        imageWidth: input.width,
        imageHeight: input.height
      }
      
      console.log(`🤚 Detected ${result.hands.length} hand(s)`)
      return result
    } catch (error) {
      console.error('❌ Hand detection failed:', error)
      throw error
    }
  }
  
  /**
   * Convert 2D landmarks to 3D coordinates using camera projection
   */
  convertTo3DCoordinates(
    landmarks2D: Point2D[],
    cameraMatrix: THREE.Matrix4,
    projectionMatrix: THREE.Matrix4,
    depthEstimates?: number[]
  ): Point3D[] {
    const landmarks3D: Point3D[] = []
    
    // Create inverse projection matrix
    const invProjection = projectionMatrix.clone().invert()
    const invCamera = cameraMatrix.clone().invert()
    
    landmarks2D.forEach((point2D, i) => {
      // Normalize to NDC space (-1 to 1)
      const ndcX = (point2D.x * 2) - 1
      const ndcY = 1 - (point2D.y * 2) // Flip Y
      
      // Use depth estimate or default
      const depth = depthEstimates?.[i] || 0.5
      
      // Create point in clip space
      const clipSpace = new THREE.Vector4(ndcX, ndcY, depth, 1)
      
      // Transform to world space
      clipSpace.applyMatrix4(invProjection)
      clipSpace.divideScalar(clipSpace.w)
      clipSpace.applyMatrix4(invCamera)
      
      landmarks3D.push({
        x: clipSpace.x,
        y: clipSpace.y,
        z: clipSpace.z
      })
    })
    
    return landmarks3D
  }
  
  /**
   * Get normalized landmarks (0-1 range)
   */
  getNormalizedLandmarks(hand: HandLandmarks, imageWidth: number, imageHeight: number): Point3D[] {
    return hand.landmarks.map(landmark => ({
      x: landmark.x / imageWidth,
      y: landmark.y / imageHeight,
      z: landmark.z
    }))
  }
  
  /**
   * Get finger segments for masking
   */
  getFingerSegments(hand: HandLandmarks): Record<string, Point3D[]> {
    const segments: Record<string, Point3D[]> = {
      palm: [],
      thumb: [],
      index: [],
      middle: [],
      ring: [],
      pinky: []
    }
    
    // Palm includes wrist and all MCPs
    segments.palm = [
      hand.landmarks[HAND_LANDMARKS.WRIST],
      hand.landmarks[HAND_LANDMARKS.THUMB_CMC],
      hand.landmarks[HAND_LANDMARKS.INDEX_MCP],
      hand.landmarks[HAND_LANDMARKS.MIDDLE_MCP],
      hand.landmarks[HAND_LANDMARKS.RING_MCP],
      hand.landmarks[HAND_LANDMARKS.PINKY_MCP]
    ]
    
    // Extract each finger
    Object.entries(FINGER_JOINTS).forEach(([finger, joints]) => {
      segments[finger] = joints.map((idx: number) => hand.landmarks[idx])
    })
    
    return segments
  }
  
  /**
   * Calculate hand bounding box
   */
  getHandBounds(landmarks: Point3D[]): { min: Point3D, max: Point3D } {
    const xs = landmarks.map(p => p.x)
    const ys = landmarks.map(p => p.y)
    const zs = landmarks.map(p => p.z)
    
    return {
      min: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        z: Math.min(...zs)
      },
      max: {
        x: Math.max(...xs),
        y: Math.max(...ys),
        z: Math.max(...zs)
      }
    }
  }
  
  /**
   * Validate hand detection quality
   */
  validateHandDetection(hand: HandLandmarks): { isValid: boolean, issues: string[] } {
    const issues: string[] = []
    
    // Check confidence
    if (hand.confidence < 0.7) {
      issues.push(`Low confidence: ${(hand.confidence * 100).toFixed(1)}%`)
    }
    
    // Check if all landmarks are present
    if (hand.landmarks.length !== 21) {
      issues.push(`Missing landmarks: ${hand.landmarks.length}/21`)
    }
    
    // Check for reasonable hand size (not too small)
    const bounds = this.getHandBounds(hand.landmarks)
    const width = bounds.max.x - bounds.min.x
    const height = bounds.max.y - bounds.min.y
    
    if (width < 0.05 || height < 0.05) {
      issues.push('Hand too small in image')
    }
    
    // Check for reasonable proportions
    const aspectRatio = width / height
    if (aspectRatio < 0.5 || aspectRatio > 2.0) {
      issues.push(`Unusual proportions: ${aspectRatio.toFixed(2)}`)
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }
  
  /**
   * Calculate finger bone positions from landmarks
   */
  calculateBonePositions(hand: HandLandmarks, handSide: 'left' | 'right'): Record<string, Point3D[]> {
    const bones: Record<string, Point3D[]> = {}
    
    // Add wrist as root
    bones.wrist = [hand.landmarks[HAND_LANDMARKS.WRIST]]
    
    // Calculate positions for each finger
    Object.entries(FINGER_JOINTS).forEach(([finger, joints]) => {
      const positions: Point3D[] = []
      
      // Add base connection from wrist/palm
      if (finger === 'thumb') {
        positions.push(hand.landmarks[HAND_LANDMARKS.WRIST]) // Wrist to thumb
      } else {
        // Calculate palm position for this finger
        const mcp = hand.landmarks[joints[0]]
        const wrist = hand.landmarks[HAND_LANDMARKS.WRIST]
        const palmPos = {
          x: (wrist.x + mcp.x) / 2,
          y: (wrist.y + mcp.y) / 2,
          z: (wrist.z + mcp.z) / 2
        }
        positions.push(palmPos)
      }
      
      // Add all joint positions
      joints.forEach((idx: number) => {
        positions.push(hand.landmarks[idx])
      })
      
      bones[finger] = positions
    })
    
    return bones
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.detector) {
      this.detector.dispose()
      this.detector = null
      this.isInitialized = false
    }
  }
} 